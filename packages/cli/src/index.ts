#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline';
import { api, Profile, Run, Discovered } from './api';
import { launchTUI } from './tui';

// ── Formatting helpers ────────────────────────────────────────────────────────

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function pad(s: string, w: number): string {
  return s + ' '.repeat(Math.max(0, w - stripAnsi(s).length));
}

function table(headers: string[], rows: string[][]): void {
  if (!rows.length) {
    console.log(chalk.gray('  (none)'));
    return;
  }
  const widths = headers.map((h, i) =>
    Math.max(stripAnsi(h).length, ...rows.map(r => stripAnsi(r[i] ?? '').length))
  );
  console.log('  ' + headers.map((h, i) => pad(chalk.bold(h), widths[i])).join('  '));
  console.log('  ' + widths.map(w => '-'.repeat(w)).join('  '));
  rows.forEach(row =>
    console.log('  ' + row.map((c, i) => pad(c ?? '-', widths[i])).join('  '))
  );
}

function badge(status: string): string {
  const s = (status ?? 'unknown').toLowerCase();
  if (s === 'confirmed' || s === 'completed') return chalk.green(status);
  if (s === 'submitted') return chalk.cyan(status);
  if (s === 'failed') return chalk.red(status);
  if (s === 'manual') return chalk.yellow('action required');
  if (s === 'skipped') return chalk.gray(status);
  if (s === 'running') return chalk.blue(status);
  if (s === 'queued') return chalk.gray(status);
  return chalk.gray(status);
}

function fmtDate(dt: string | null): string {
  if (!dt) return '-';
  return new Date(dt).toLocaleString();
}

function fmtDuration(start: string, end: string | null): string {
  if (!end) return '';
  const s = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
}

function die(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  console.error('\n' + chalk.red('Error: ') + msg + '\n');
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrap(fn: (...args: any[]) => Promise<void>) {
  return (...args: any[]) => fn(...args).catch(die);
}

// ── status ────────────────────────────────────────────────────────────────────

async function cmdStatus(): Promise<void> {
  const profile = await api.getProfile().catch(() => null);
  const runs = await api.getRuns().catch((): Run[] => []);
  const discovered = await api.getDiscovered().catch((): Discovered[] => []);

  console.log();

  if (!profile) {
    console.log(chalk.yellow('  No profile set up yet.') + chalk.gray(' Run: scrubbed profile setup'));
  } else {
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
    const loc = [profile.city, profile.state].filter(Boolean).join(', ');
    console.log(chalk.bold('  Profile   ') + [name, profile.email, loc].filter(Boolean).join(chalk.gray(' · ')));
  }

  const latest = runs[0];
  if (latest) {
    const dur = fmtDuration(latest.started_at, latest.completed_at);
    const parts = [
      badge(latest.status),
      chalk.gray(`${latest.total_brokers} brokers`),
      chalk.green(`${latest.completed} done`),
      latest.failed > 0 ? chalk.red(`${latest.failed} failed`) : null,
      latest.skipped > 0 ? chalk.yellow(`${latest.skipped} skipped`) : null,
      dur ? chalk.gray(dur) : null,
    ].filter(Boolean);
    console.log(chalk.bold('  Last run  ') + parts.join(chalk.gray(' · ')));
    console.log('            ' + chalk.gray(fmtDate(latest.started_at)));
  } else {
    console.log(chalk.bold('  Last run  ') + chalk.gray('none yet'));
  }

  const count = discovered.length;
  console.log(
    chalk.bold('  Exposed   ') +
    (count > 0
      ? chalk.yellow(`${count} profile${count !== 1 ? 's' : ''} found across brokers`)
      : chalk.green('none found'))
  );
  console.log();
}

// ── profile show ──────────────────────────────────────────────────────────────

async function cmdProfileShow(): Promise<void> {
  const p = await api.getProfile();
  const loc = [p.city, p.state, p.zip].filter(Boolean).join(', ');
  const dob =
    p.dob_month && p.dob_year
      ? `${String(p.dob_month).padStart(2, '0')}/${p.dob_year}`
      : '-';

  const rows: [string, string][] = [
    ['Name', [p.first_name, p.last_name].filter(Boolean).join(' ')],
    ['Email', p.email],
    ['Phone', p.phone ?? '-'],
    ['Location', loc || '-'],
    ['DOB', dob],
    ['Aliases', p.aliases?.length ? p.aliases.join(', ') : '-'],
    ['Address history', p.address_history?.length ? p.address_history.join(', ') : '-'],
    ['IMAP', p.imap_host ? `${p.imap_host} (${p.imap_user})` : '-'],
    ['CAPTCHA', p.captcha_provider ?? '-'],
  ];

  const w = Math.max(...rows.map(([l]) => l.length));
  console.log();
  rows.forEach(([label, val]) =>
    console.log('  ' + chalk.bold(label.padEnd(w)) + '  ' + val)
  );
  console.log();
}

// ── profile setup ─────────────────────────────────────────────────────────────

function ask(rl: readline.Interface, q: string, hint?: string): Promise<string> {
  return new Promise(resolve => {
    const h = hint ? chalk.gray(` [${hint}]`) : '';
    rl.question(`  ${q}${h}: `, ans => resolve(ans.trim()));
  });
}

async function cmdProfileSetup(): Promise<void> {
  let current: Profile | null = null;
  try { current = await api.getProfile(); } catch { /* no existing profile */ }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log();
  console.log(chalk.bold('  Profile Setup'));
  console.log(chalk.gray('  Press Enter to keep the current value.\n'));

  try {
    const first = (await ask(rl, 'First name', current?.first_name)) || current?.first_name || '';
    const last = (await ask(rl, 'Last name', current?.last_name)) || current?.last_name || '';
    const email = (await ask(rl, 'Email', current?.email)) || current?.email || '';
    const phone = (await ask(rl, 'Phone', current?.phone ?? '')) || current?.phone || null;
    const city = (await ask(rl, 'City', current?.city ?? '')) || current?.city || null;
    const state = (await ask(rl, 'State (2-letter)', current?.state ?? '')) || current?.state || null;
    const zip = (await ask(rl, 'Zip', current?.zip ?? '')) || current?.zip || null;
    const dobM = (await ask(rl, 'Birth month (1-12)', current?.dob_month?.toString())) || current?.dob_month?.toString() || '';
    const dobY = (await ask(rl, 'Birth year (YYYY)', current?.dob_year?.toString())) || current?.dob_year?.toString() || '';
    const aliasStr = (await ask(rl, 'Aliases (comma-separated)', current?.aliases?.join(', '))) || current?.aliases?.join(', ') || '';
    rl.close();

    await api.setProfile({
      first_name: first,
      last_name: last,
      email,
      phone: phone || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
      dob_month: dobM ? parseInt(dobM, 10) : null,
      dob_year: dobY ? parseInt(dobY, 10) : null,
      aliases: aliasStr ? aliasStr.split(',').map(s => s.trim()).filter(Boolean) : [],
      address_history: current?.address_history ?? [],
    });

    console.log('\n' + chalk.green('  Profile saved.') + '\n');
  } catch (e) {
    rl.close();
    throw e;
  }
}

// ── scan start ────────────────────────────────────────────────────────────────

async function cmdScanStart(): Promise<void> {
  const run = await api.startRun();
  console.log('\n' + chalk.green('  Scan queued'));
  console.log('  ID: ' + chalk.bold(run.id));
  console.log(chalk.gray('\n  scrubbed scan status        check progress'));
  console.log(chalk.gray('  scrubbed logs --follow      watch live\n'));
}

// ── scan watch ────────────────────────────────────────────────────────────────

async function cmdScanWatch(): Promise<void> {
  const initial = await api.getLogs();
  let seen = initial.length;

  const run = await api.startRun();
  console.log('\n' + chalk.green('  Run queued: ') + chalk.bold(run.id));
  console.log(chalk.gray('  Watching... (Ctrl+C stops watching, scan continues)\n'));

  while (true) {
    await new Promise(r => setTimeout(r, 2000));

    const [logs, runs] = await Promise.all([api.getLogs(), api.getRuns()]);
    logs.slice(seen).forEach(l => console.log(l));
    seen = logs.length;

    const current = runs.find(r => r.id === run.id);
    if (current?.status === 'completed' || current?.status === 'failed') {
      const dur = fmtDuration(current.started_at, current.completed_at);
      const parts = [
        badge(current.status),
        chalk.green(`${current.completed} done`),
        current.failed > 0 ? chalk.red(`${current.failed} failed`) : null,
        current.skipped > 0 ? chalk.yellow(`${current.skipped} skipped`) : null,
        dur ? chalk.gray(dur) : null,
      ].filter(Boolean);
      console.log('\n  ' + parts.join(chalk.gray(' · ')) + '\n');
      break;
    }
  }
}

// ── scan status ───────────────────────────────────────────────────────────────

async function cmdScanStatus(opts: { id?: string }): Promise<void> {
  const runs = await api.getRuns();
  const run = opts.id ? runs.find(r => r.id === opts.id) : runs[0];

  if (!run) {
    console.log(chalk.gray('\n  No runs found.\n'));
    return;
  }

  const dur = fmtDuration(run.started_at, run.completed_at);
  const rows: [string, string][] = [
    ['ID', run.id],
    ['Status', badge(run.status)],
    ['Progress', `${run.total_brokers} total  ${run.completed} done  ${run.failed} failed  ${run.skipped} skipped`],
    ['Started', fmtDate(run.started_at)],
  ];
  if (run.completed_at) {
    rows.push(['Finished', fmtDate(run.completed_at) + (dur ? chalk.gray(` (${dur})`) : '')]);
  }

  const w = Math.max(...rows.map(([k]) => k.length));
  console.log();
  rows.forEach(([k, v]) => console.log('  ' + chalk.bold(k.padEnd(w)) + '  ' + v));
  console.log();
}

// ── scan results ──────────────────────────────────────────────────────────────

async function cmdScanResults(runId: string): Promise<void> {
  const results = await api.getResults(runId);
  if (!results.length) {
    console.log(chalk.gray('\n  No results for this run.\n'));
    return;
  }
  console.log();
  table(
    ['Broker', 'Status', 'Method', 'Error'],
    results.map(r => [
      r.broker_id,
      badge(r.status),
      r.method ?? '-',
      r.error ? chalk.red(r.error.slice(0, 60)) : '-',
    ])
  );
  console.log();
}

// ── brokers ───────────────────────────────────────────────────────────────────

async function cmdBrokers(): Promise<void> {
  const brokers = await api.getBrokers();
  console.log();
  table(
    ['Name', 'Status', 'Method', 'Last Run'],
    brokers.map(b => [b.name, badge(b.status), b.method, fmtDate(b.last_run)])
  );
  console.log();
}

// ── logs ──────────────────────────────────────────────────────────────────────

async function cmdLogs(opts: { follow?: boolean }): Promise<void> {
  const logs = await api.getLogs();
  if (!logs.length) console.log(chalk.gray('No logs yet.'));
  logs.forEach(l => console.log(l));
  let seen = logs.length;

  if (opts.follow) {
    console.log(chalk.gray('\n  Following... (Ctrl+C to stop)\n'));
    while (true) {
      await new Promise(r => setTimeout(r, 2000));
      const next = await api.getLogs();
      next.slice(seen).forEach(l => console.log(l));
      seen = next.length;
    }
  }
}

// ── discovered ────────────────────────────────────────────────────────────────

async function cmdDiscovered(): Promise<void> {
  const profiles = await api.getDiscovered();
  if (!profiles.length) {
    console.log(chalk.gray('\n  No exposed profiles discovered yet.\n'));
    return;
  }
  console.log();
  table(
    ['Broker', 'Profile URL', 'Found'],
    profiles.map(p => [p.broker_id, p.profile_url, fmtDate(p.found_at)])
  );
  console.log();
}

// ── program ───────────────────────────────────────────────────────────────────

program
  .name('scrubbed')
  .description('Automated personal data removal from people-search brokers')
  .version('0.1.0');

program
  .command('status')
  .description('Overview of your profile and latest run')
  .action(wrap(cmdStatus));

const profile = program.command('profile').description('Manage your profile');
profile.command('show').description('Show current profile').action(wrap(cmdProfileShow));
profile.command('setup').description('Interactive profile setup').action(wrap(cmdProfileSetup));

const scan = program.command('scan').description('Manage scans');
scan.command('start').description('Queue a new scan').action(wrap(cmdScanStart));
scan.command('watch').description('Start a scan and follow logs until done').action(wrap(cmdScanWatch));
scan
  .command('status')
  .description('Show the latest run (or a specific one)')
  .option('-i, --id <runId>', 'Run ID')
  .action(wrap(cmdScanStatus));
scan
  .command('results <runId>')
  .description('Show per-broker results for a run')
  .action(wrap(cmdScanResults));

program
  .command('brokers')
  .description('List all brokers with current status')
  .action(wrap(cmdBrokers));

program
  .command('logs')
  .description('Show recent logs')
  .option('-f, --follow', 'Poll for new logs every 2 seconds')
  .action(wrap(cmdLogs));

program
  .command('discovered')
  .description('List discovered profile URLs')
  .action(wrap(cmdDiscovered));

program
  .command('help')
  .description('Show this help reference')
  .action(cmdHelp);

function cmdHelp() {
  const c = chalk;
  const h = (s: string) => console.log('\n' + c.cyan.bold(s));
  const cmd = (name: string, desc: string) =>
    console.log('  ' + c.bold(name.padEnd(36)) + c.gray(desc));
  const key = (k: string, desc: string) =>
    console.log('  ' + c.bold(k.padEnd(12)) + c.gray(desc));

  console.log('\n' + c.blue.bold('  SCRUBBED') + c.gray('  Automated personal data removal from people-search brokers'));

  h('TERMINAL UI');
  console.log(c.gray('  Run with no arguments to open the interactive terminal UI:'));
  console.log('  ' + c.bold('scrubbed'));

  h('TUI KEY BINDINGS');
  key('s', 'Start a new scan');
  key('r', 'Refresh all data');
  key('tab', 'Focus the log panel (then use arrow keys to scroll)');
  key('esc', 'Unfocus log panel / back to brokers');
  key('↑ ↓', 'Navigate brokers list');
  key('enter', 'Open selected broker\'s discovered URL in browser');
  key('q', 'Quit');

  h('COMMANDS');
  cmd('scrubbed status', 'Overview of profile and latest run');
  cmd('scrubbed profile show', 'Display current profile');
  cmd('scrubbed profile setup', 'Interactive profile setup');
  cmd('scrubbed scan start', 'Queue a new scan');
  cmd('scrubbed scan watch', 'Start a scan and stream logs until done');
  cmd('scrubbed scan status', 'Show latest run progress');
  cmd('scrubbed scan status --id <runId>', 'Show a specific run');
  cmd('scrubbed scan results <runId>', 'Per-broker results for a run');
  cmd('scrubbed brokers', 'List all brokers with current status');
  cmd('scrubbed logs', 'Show recent logs');
  cmd('scrubbed logs --follow', 'Tail logs live');
  cmd('scrubbed discovered', 'List all discovered profile URLs');

  h('ENVIRONMENT');
  cmd('SCRUBBED_API_URL', 'API base URL (default: http://localhost:3001)');

  h('TIPS');
  console.log(c.gray('  - The API must be running before using any command (docker compose up api)'));
  console.log(c.gray('  - Start a full scan with the runner: docker compose up api runner'));
  console.log(c.gray('  - Your profile data is stored locally and never sent to third-party servers'));
  console.log(c.gray('  - Brokers marked with a dot (') + c.cyan('•') + c.gray(') in the TUI have a discovered profile URL'));
  console.log();
}

if (process.argv.length <= 2) {
  launchTUI().catch(die);
} else {
  program.parse();
}
