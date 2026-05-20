import cron from 'node-cron';
import Database from 'better-sqlite3';
import path from 'path';
import { setupScheduler } from './scheduler';
import { listenForEmails } from './email-listener';
import { run } from './orchestrator';

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/scrubbed.db');
console.log(`Runner database connected at: ${dbPath}`);
const db = new Database(dbPath);

async function checkAndRun() {
  console.log('Checking for queued runs...');
  const queuedRun = db.prepare('SELECT id FROM runs WHERE status = ? LIMIT 1').get('queued') as any;
  
  if (queuedRun) {
    try {
      await run(queuedRun.id);
    } catch (error) {
      console.error(`Run ${queuedRun.id} failed:`, error);
      db.prepare('UPDATE runs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('failed', queuedRun.id);
    }
  }
}

async function main() {
  console.log('Scrubbed Runner starting up...');

  
  setupScheduler();

  
  cron.schedule('*/15 * * * *', async () => {
    await listenForEmails();
  });

  
  cron.schedule('*/10 * * * * *', async () => {
    await checkAndRun();
  });

  
  await listenForEmails();
  await checkAndRun();

  console.log('Scrubbed Runner is active and waiting for tasks.');
}

main().catch(console.error);
