import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import axios from 'axios';
import { launchBrowser } from './browser';
import { loadBrokers, BrokerDefinition } from './parser';
import { executeBroker } from './engine';

dotenv.config();

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/scrubbed.db');
const db = new Database(dbPath);
const API_URL = 'http://api:3001/api';

async function log(message: string) {
  console.log(`[ENGINE] ${message}`);
  try {
    await axios.post(`${API_URL}/logs`, { message });
  } catch (e) {
    // Silent fail
  }
}

async function simulateHuman(page: any) {
  await page.mouse.move(Math.random() * 800, Math.random() * 800);
  await page.waitForTimeout(1000 + Math.random() * 2000);
}

export async function run(runId: string) {
  await log(`Starting execution for run: ${runId}`);

  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get() as any;
  if (!profile) {
    await log('ERROR: No profile found. Please set up your profile in the dashboard.');
    db.prepare('UPDATE runs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?').run('failed', runId);
    return;
  }

  profile.aliases = profile.aliases ? JSON.parse(profile.aliases) : [];
  profile.address_history = profile.address_history ? JSON.parse(profile.address_history) : [];

  const brokersPath = '/app/broker-definitions';
  const brokers = loadBrokers(brokersPath);

  if (brokers.length === 0) {
    await log('ERROR: No broker definitions found.');
    db.prepare('UPDATE runs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?').run('completed', runId);
    return;
  }

  db.prepare('UPDATE runs SET status = ?, total_brokers = ? WHERE id = ?').run('running', brokers.length, runId);

  const { browser, context } = await launchBrowser();
  
  if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');

  let completed = 0;
  let failed = 0;

  for (const broker of brokers) {
    const page = await context.newPage();
    try {
      await log(`Processing broker: ${broker.name}`);

      const existing = db.prepare('SELECT profile_url FROM discovered_profiles WHERE broker_id = ?').get(broker.id) as any;
      let profileUrl = existing?.profile_url;

      if (!profileUrl) {
        await log(`[${broker.name}] Starting Scout phase...`);
        profileUrl = await scoutBroker(page, broker, profile);
      } else {
        await log(`[${broker.name}] Using cached profile URL: ${profileUrl}`);
      }
      
      if (profileUrl) {
        if (!existing) {
          await log(`[${broker.name}] Profile found: ${profileUrl}`);
          db.prepare('INSERT OR IGNORE INTO discovered_profiles (broker_id, profile_url) VALUES (?, ?)').run(broker.id, profileUrl);
        }
        
        await log(`[${broker.name}] Starting Scrub phase...`);
        const result = await executeBroker(page as any, broker, profile);
        
        db.prepare(`
          INSERT INTO opt_out_results (run_id, broker_id, status, submitted_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `).run(runId, broker.id, result.status);

        if (result.status === 'submitted') completed++; else failed++;
      } else {
        await log(`[${broker.name}] No profile detected for ${broker.name}. skipping.`);
        completed++;
        db.prepare(`
          INSERT INTO opt_out_results (run_id, broker_id, status, submitted_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `).run(runId, broker.id, 'skipped');
      }
    } catch (err: any) {
      await log(`[${broker.name}] ERROR: Run failed: ${err.message}`);
      failed++;
    } finally {
      await page.close();
    }

    db.prepare('UPDATE runs SET completed = ?, failed = ? WHERE id = ?').run(completed, failed, runId);
  }

  db.prepare('UPDATE runs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?').run('completed', runId);
  await browser.close();
  await log(`Run ${runId} finished.`);
}

async function scoutBroker(page: any, broker: BrokerDefinition, profile: any): Promise<string | null> {
  if (!broker.search_steps || broker.search_steps.length === 0) return broker.base_url;

  try {
    for (const step of broker.search_steps) {
      await simulateHuman(page);
      if (step.action === 'navigate') {
        const url = interpolateProfile(step.url, profile);
        await log(`  -> Navigating to: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      } else if (step.action === 'wait_for') {
        await log(`  -> Waiting for: ${step.selector}`);
        await page.waitForSelector(step.selector, { timeout: 25000 });
      } else {
        await executeStep(page, step, profile);
      }
      await page.waitForTimeout(2000);
    }

    const scoutScreenshot = `screenshots/scout_${broker.id}_${Date.now()}.png`;
    await page.screenshot({ path: scoutScreenshot });

    if (broker.result_list_selector) {
      await log(`  -> Analyzing result list...`);
      const results = await page.$$(broker.result_list_selector);
      await log(`  -> Identified ${results.length} possible matches.`);
      
      for (const result of results) {
        let text = (await result.textContent() || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const firstName = (profile.first_name || '').toLowerCase();
        const lastName = (profile.last_name || '').toLowerCase();
        const city = (profile.city || '').toLowerCase();
        
        await log(`    Checking text: "${text.substring(0, 150)}..."`);
        
        // Ultra-inclusive matching
        if (text.includes(firstName) && text.includes(lastName)) {
          if (text.includes(city) || text.includes('orlando') || text.includes('fl') || text.includes('florida')) {
            await log(`  -> MATCH IDENTIFIED!`);
            if (broker.result_link_selector) {
              const link = await result.$(broker.result_link_selector);
              if (link) {
                const href = await link.getAttribute('href');
                if (href) return href.startsWith('http') ? href : new URL(href, broker.base_url).href;
              }
            }
            return page.url();
          }
        }
      }
    }

    if (broker.find_indicator) {
      const isFound = await verifyFind(page, broker);
      if (isFound) return page.url();
    }
    
    return null;
  } catch (e: any) {
    await log(`  -> Scout failed: ${e.message}`);
    return null;
  }
}

function interpolateProfile(str: string, profile: any): string {
  const stateMap: { [key: string]: string } = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
  };

  return str.replace(/{{profile\.(.*?)}}/g, (_, key) => {
    let val = (profile as any)[key] || '';
    if (key === 'state' && stateMap[val]) return stateMap[val];
    return val;
  });
}

async function executeStep(page: any, step: any, profile: any) {
  switch (step.action) {
    case 'navigate': await page.goto(interpolateProfile(step.url, profile), { waitUntil: 'networkidle' }); break;
    case 'fill': await page.fill(step.selector, interpolateProfile(step.value, profile)); break;
    case 'click': await page.click(step.selector); break;
    case 'select': await page.selectOption(step.selector, interpolateProfile(step.value, profile)); break;
    case 'wait_for': await page.waitForSelector(step.selector, { timeout: 25000 }); break;
  }
}

async function verifyFind(page: any, broker: BrokerDefinition) {
  if (!broker.find_indicator) return true;
  const { type, value } = broker.find_indicator;
  try {
    if (type === 'text_contains') return (await page.textContent('body'))?.toLowerCase().includes(value.toLowerCase());
    if (type === 'url_contains') return page.url().includes(value);
    if (type === 'element_exists') { await page.waitForSelector(value, { timeout: 15000 }); return true; }
  } catch { return false; }
  return false;
}
