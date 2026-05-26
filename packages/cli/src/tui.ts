import { spawn } from 'child_process';
import blessed from 'blessed';
import { api, Broker, Discovered, Profile, Run } from './api';

const STATUS_COLOR: Record<string, string> = {
  confirmed:  '{green-fg}',
  completed:  '{green-fg}',
  submitted:  '{cyan-fg}',
  running:    '{blue-fg}',
  queued:     '{white-fg}',
  failed:     '{red-fg}',
  manual:     '{yellow-fg}',
  skipped:    '{grey-fg}',
  pending:    '{grey-fg}',
};

function colorStatus(status: string): string {
  const display = status === 'manual' ? 'action required' : status;
  const tag = STATUS_COLOR[(status ?? 'pending').toLowerCase()] ?? '{grey-fg}';
  return `${tag}${display}{/}`;
}

function fmtDuration(start: string, end: string | null): string {
  if (!end) return '';
  const s = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
}

function openUrl(url: string) {
  spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
}

export async function launchTUI(): Promise<void> {
  const screen = blessed.screen({ smartCSR: true, title: 'Scrubbed', fullUnicode: true, mouse: true });

  // ── Header ────────────────────────────────────────────────────────────────
  const header = blessed.box({
    top: 0, left: 0,
    width: '100%', height: 1,
    tags: true,
    style: { fg: 'white', bg: '#5E81AC', bold: true },
  });

  // ── Brokers panel (left, upper) ───────────────────────────────────────────
  const brokersList = blessed.list({
    top: 1, left: 0,
    width: '60%', height: '50%-1',
    label: ' {cyan-fg}{bold}Brokers{/bold}{/}  {grey-fg}• = URL found, Enter to open{/} ',
    tags: true,
    border: { type: 'line' },
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    mouse: true,
    scrollbar: { ch: '▐', style: { fg: 'cyan' } },
    style: {
      border: { fg: 'cyan' },
      scrollbar: { fg: 'cyan' },
      selected: { bg: 'navy', bold: true },
      focus: { border: { fg: 'white' } },
    } as any,
  });

  // ── Status panel (right, upper) ───────────────────────────────────────────
  const statusBox = blessed.box({
    top: 1, right: 0,
    width: '40%', height: '50%-1',
    label: ' {cyan-fg}{bold}Status{/bold}{/} ',
    tags: true,
    border: { type: 'line' },
    padding: { left: 1, right: 1, top: 0, bottom: 0 },
    style: { border: { fg: 'cyan' }, label: { fg: 'cyan' } },
  });

  // ── Logs panel (lower) ────────────────────────────────────────────────────
  const logsBox = blessed.log({
    top: '50%', bottom: 1, left: 0,
    width: '100%',
    label: ' {cyan-fg}{bold}Logs{/bold}{/} (tab to focus, ↑↓ to scroll)',
    tags: true,
    border: { type: 'line' },
    scrollable: true,
    alwaysScroll: true,
    scrollOnInput: false,
    mouse: true,
    keys: true,
    vi: true,
    scrollbar: { ch: '▐', style: { fg: 'cyan' } },
    style: {
      border: { fg: 'cyan' },
      label: { fg: 'cyan' },
      scrollbar: { fg: 'cyan' },
      focus: { border: { fg: 'white' } },
    },
  });

  // ── Key hints bar ─────────────────────────────────────────────────────────
  const keyBar = blessed.box({
    bottom: 0, left: 0,
    width: '100%', height: 1,
    tags: true,
    content: '  {bold}:{/bold} Cmd  {bold}s{/bold} Scan  {bold}p{/bold} Profile  {bold}⏎{/bold} Open  {bold}tab{/bold} Logs  {bold}esc{/bold} Back  {bold}r{/bold} Refresh  {bold}?{/bold} Help  {bold}q{/bold} Quit',
    style: { fg: 'white', bg: 'black' },
  });

  // ── Help overlay ──────────────────────────────────────────────────────────
  const helpBox = blessed.box({
    top: 'center', left: 'center',
    width: 62, height: 28,
    label: ' {cyan-fg}{bold}Help{/bold}{/} ',
    tags: true,
    border: { type: 'line' },
    padding: { left: 2, right: 2, top: 1, bottom: 1 },
    hidden: true,
    style: { border: { fg: 'cyan' }, bg: 'black' },
    content: [
      '{cyan-fg}{bold}Terminal UI{/bold}{/}',
      '  Run {bold}scrubbed{/bold} with no arguments to open this UI.',
      '',
      '{cyan-fg}{bold}Key Bindings{/bold}{/}',
      '  {bold}s{/bold}       Start a new scan',
      '  {bold}p{/bold}       View / edit your profile',
      '  {bold}r{/bold}       Refresh all data',
      '  {bold}tab{/bold}     Focus log panel',
      '  {bold}esc{/bold}     Unfocus / back to brokers',
      '  {bold}↑ ↓{/bold}     Navigate brokers list',
      '  {bold}enter{/bold}   Open broker URL in browser',
      '  {bold}:{/bold}       Command prompt',
      '  {bold}?{/bold}       Toggle this help screen',
      '  {bold}q{/bold}       Quit',
      '',
      '{cyan-fg}{bold}Commands (press :){/bold}{/}',
      '  scan · refresh · clear · profile · profile edit · help · quit',
      '',
      '{cyan-fg}{bold}CLI Commands{/bold}{/}',
      '  scrubbed status',
      '  scrubbed profile show / setup',
      '  scrubbed scan start / watch / status / results',
      '  scrubbed brokers / logs / logs --follow / discovered',
      '',
      '{cyan-fg}{bold}Tips{/bold}{/}',
      '  {cyan-fg}•{/} = broker has a discovered URL (press enter to open)',
      '  Run {bold}scrubbed help{/bold} in terminal for full reference',
      '',
      '{grey-fg}Press ? or esc to close{/}',
    ].join('\n'),
  });

  // ── Profile overlay ───────────────────────────────────────────────────────
  const profileBox = blessed.box({
    top: 'center', left: 'center',
    width: 66, height: 30,
    label: ' {cyan-fg}{bold}Profile{/bold}{/} ',
    tags: true,
    border: { type: 'line' },
    padding: { left: 2, right: 2, top: 1, bottom: 1 },
    hidden: true,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    mouse: true,
    scrollbar: { ch: '▐', style: { fg: 'cyan' } },
    style: { border: { fg: 'cyan' }, bg: 'black', scrollbar: { fg: 'cyan' } },
  });

  // ── Command prompt ────────────────────────────────────────────────────────
  const cmdPrompt = blessed.prompt({
    top: 'center', left: 'center',
    width: 54, height: 8,
    label: ' {cyan-fg}{bold}Command{/bold}{/} ',
    tags: true,
    border: { type: 'line' },
    style: { border: { fg: 'cyan' }, bg: 'black' },
  });

  screen.append(header);
  screen.append(brokersList);
  screen.append(statusBox);
  screen.append(logsBox);
  screen.append(keyBar);
  screen.append(helpBox);
  screen.append(profileBox);
  screen.append(cmdPrompt);

  let lastLogSeen: string | null = null;
  let startingRun = false;
  let brokerItems: Array<{ broker: Broker; url: string | null }> = [];
  let currentRun: Run | null = null;
  let currentDiscoveredCount = 0;
  let selectedBrokerIdx = 0;
  let currentProfile: Profile | null = null;

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderHeader(name: string, loc: string) {
    const right = loc ? `{grey-fg}${name}  ${loc}{/}` : `{grey-fg}${name}{/}`;
    header.setContent(`  ╱ {bold}scrubbed{/bold}{|}${right}  `);
  }

  function renderBrokers(brokers: Broker[], discovered: Discovered[]) {
    brokerItems = brokers.map(b => ({
      broker: b,
      url: discovered.find(d => d.broker_id === b.id)?.profile_url ?? null,
    }));

    const items = brokerItems.map(({ broker, url }) => {
      const name = broker.name.padEnd(22);
      const dot = url ? '{cyan-fg}•{/} ' : '  ';
      return ` ${dot}${name} ${colorStatus(broker.status)}`;
    });

    brokersList.setItems(items as any);
  }

  function renderStatus() {
    const lines: string[] = [];

    if (currentRun) {
      lines.push(`{bold}Run{/bold}      ${colorStatus(currentRun.status)}`);
      lines.push('');
      lines.push(`{bold}Total{/bold}    ${currentRun.total_brokers}`);
      lines.push(`{green-fg}Done{/green-fg}     ${currentRun.completed}`);
      if (currentRun.failed > 0)  lines.push(`{red-fg}Failed{/red-fg}   ${currentRun.failed}`);
      if (currentRun.skipped > 0) lines.push(`{yellow-fg}Skipped{/yellow-fg}  ${currentRun.skipped}`);
      const dur = fmtDuration(currentRun.started_at, currentRun.completed_at);
      if (dur) lines.push(`\n{grey-fg}Duration: ${dur}{/}`);
    } else {
      lines.push('{grey-fg}No runs yet{/}');
    }

    lines.push('');
    lines.push(
      currentDiscoveredCount > 0
        ? `{bold}Exposed{/bold}  {yellow-fg}${currentDiscoveredCount} profile${currentDiscoveredCount !== 1 ? 's' : ''}{/}`
        : `{bold}Exposed{/bold}  {green-fg}none found{/}`
    );

    if (startingRun) {
      lines.push('');
      lines.push('{yellow-fg}Queuing scan...{/}');
    }

    const selected = brokerItems[selectedBrokerIdx];
    if (selected) {
      lines.push('');
      lines.push(`{bold}Selected:{/bold} ${selected.broker.name}`);
      if (selected.url) {
        lines.push(`{grey-fg}${selected.url}{/}`);
        lines.push('{cyan-fg}Press Enter to open in browser{/}');
      } else {
        lines.push('{grey-fg}No URL discovered yet{/}');
      }
    }

    statusBox.setContent(lines.join('\n'));
  }

  function renderProfileOverlay() {
    const p = currentProfile;
    if (!p) {
      profileBox.setContent(
        '{yellow-fg}No profile set up yet.{/}\n\n' +
        '{grey-fg}Press {bold}e{/bold} to create your profile.{/}\n\n' +
        '{grey-fg}Press {bold}esc{/bold} or {bold}p{/bold} to close.{/}'
      );
      return;
    }

    const na = '{grey-fg}not set{/}';
    const masked = (v: string | null) => (v ? '••••••••' : na);
    const val = (v: string | number | null | undefined) => (v != null && v !== '' ? String(v) : na);
    const aliases = p.aliases?.length ? p.aliases.map(a => `    • ${a}`).join('\n') : `    ${na}`;
    const addresses = p.address_history?.length ? p.address_history.map(a => `    • ${a}`).join('\n') : `    ${na}`;

    profileBox.setContent([
      '{cyan-fg}{bold}Identity{/bold}{/}',
      `  {bold}Name:{/bold}      ${val(p.first_name)} ${val(p.last_name)}`,
      `  {bold}Email:{/bold}     ${val(p.email)}`,
      `  {bold}Phone:{/bold}     ${val(p.phone)}`,
      '',
      '{cyan-fg}{bold}Location{/bold}{/}',
      `  {bold}City:{/bold}      ${val(p.city)}`,
      `  {bold}State:{/bold}     ${val(p.state)}`,
      `  {bold}Zip:{/bold}       ${val(p.zip)}`,
      '',
      '{cyan-fg}{bold}Date of Birth{/bold}{/}',
      `  {bold}Month/Year:{/bold} ${val(p.dob_month)}/${val(p.dob_year)}`,
      '',
      '{cyan-fg}{bold}Aliases{/bold}{/}',
      aliases,
      '',
      '{cyan-fg}{bold}Address History{/bold}{/}',
      addresses,
      '',
      '{cyan-fg}{bold}Email Confirmation (IMAP){/bold}{/}',
      `  {bold}Host:{/bold}      ${val(p.imap_host)}`,
      `  {bold}User:{/bold}      ${val(p.imap_user)}`,
      `  {bold}Pass:{/bold}      ${masked(p.imap_pass)}`,
      '',
      '{cyan-fg}{bold}CAPTCHA{/bold}{/}',
      `  {bold}Provider:{/bold}  ${val(p.captcha_provider)}`,
      `  {bold}API Key:{/bold}   ${masked(p.captcha_api_key)}`,
      '',
      '{grey-fg}Press {bold}e{/bold} to edit  •  {bold}↑↓{/bold} scroll  •  {bold}esc{/bold} or {bold}p{/bold} to close{/}',
    ].join('\n'));
  }

  // ── Profile edit (sequential prompts) ────────────────────────────────────

  type Field = { label: string; key: keyof Profile; current: () => string };

  async function promptField(label: string, current: string): Promise<string | null> {
    return new Promise(resolve => {
      cmdPrompt.input(label, current, (_err: any, value: string | null) => {
        resolve(value ?? null);
      });
    });
  }

  async function editProfile() {
    profileBox.hide();
    screen.render();

    const p = currentProfile;
    const updates: Partial<Profile> = {};

    const fields: Field[] = [
      { label: 'First name', key: 'first_name', current: () => p?.first_name ?? '' },
      { label: 'Last name',  key: 'last_name',  current: () => p?.last_name ?? '' },
      { label: 'Email',      key: 'email',       current: () => p?.email ?? '' },
      { label: 'Phone',      key: 'phone',       current: () => p?.phone ?? '' },
      { label: 'City',       key: 'city',        current: () => p?.city ?? '' },
      { label: 'State',      key: 'state',       current: () => p?.state ?? '' },
      { label: 'Zip',        key: 'zip',         current: () => p?.zip ?? '' },
      { label: 'DOB month (1-12)', key: 'dob_month', current: () => String(p?.dob_month ?? '') },
      { label: 'DOB year',   key: 'dob_year',    current: () => String(p?.dob_year ?? '') },
      { label: 'Aliases (comma-separated)', key: 'aliases', current: () => (p?.aliases ?? []).join(', ') },
      { label: 'IMAP host',  key: 'imap_host',   current: () => p?.imap_host ?? '' },
      { label: 'IMAP user',  key: 'imap_user',   current: () => p?.imap_user ?? '' },
      { label: 'IMAP password', key: 'imap_pass', current: () => p?.imap_pass ?? '' },
      { label: 'CAPTCHA provider (2captcha/capsolver)', key: 'captcha_provider', current: () => p?.captcha_provider ?? '' },
      { label: 'CAPTCHA API key', key: 'captcha_api_key', current: () => p?.captcha_api_key ?? '' },
    ];

    for (const field of fields) {
      const value = await promptField(`${field.label}:`, field.current());
      if (value === null) {
        // User pressed escape — abort
        statusBox.setContent('{yellow-fg}Profile edit cancelled.{/}');
        brokersList.focus();
        screen.render();
        return;
      }
      const trimmed = value.trim();
      if (field.key === 'aliases') {
        (updates as any)[field.key] = trimmed ? trimmed.split(',').map(s => s.trim()).filter(Boolean) : [];
      } else if (field.key === 'dob_month' || field.key === 'dob_year') {
        const n = parseInt(trimmed, 10);
        (updates as any)[field.key] = isNaN(n) ? null : n;
      } else {
        (updates as any)[field.key] = trimmed || null;
      }
    }

    try {
      await api.setProfile(updates);
      statusBox.setContent('{green-fg}Profile saved.{/}');
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      statusBox.setContent(`{red-fg}Save failed: ${msg}{/}`);
    }

    brokersList.focus();
    screen.render();
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  async function pollLogs() {
    try {
      const logs = await api.getLogs();
      let startIdx = 0;
      if (lastLogSeen) {
        const idx = logs.lastIndexOf(lastLogSeen);
        startIdx = idx === -1 ? 0 : idx + 1;
      }
      const newLogs = logs.slice(startIdx);
      if (newLogs.length > 0) {
        newLogs.forEach(l => logsBox.log(l));
        lastLogSeen = logs[logs.length - 1];
        screen.render();
      }
    } catch { /* silent */ }
  }

  async function refresh() {
    try {
      const [profile, brokers, runs, discovered] = await Promise.all([
        api.getProfile().catch(() => null),
        api.getBrokers().catch((): Broker[] => []),
        api.getRuns().catch((): Run[] => []),
        api.getDiscovered().catch((): Discovered[] => []),
      ]);

      currentProfile = profile;

      if (profile) {
        const name = `${profile.first_name} ${profile.last_name}`;
        const loc = [profile.city, profile.state].filter(Boolean).join(', ');
        renderHeader(name, loc);
      } else {
        header.setContent('  ╱ {bold}scrubbed{/bold}{|}{yellow-fg}No profile — press p to set up{/}  ');
      }

      currentRun = (runs as Run[])[0] ?? null;
      currentDiscoveredCount = discovered.length;

      renderBrokers(brokers as Broker[], discovered as Discovered[]);
      renderStatus();

      if (!profileBox.hidden) renderProfileOverlay();

      startingRun = false;
      screen.render();
    } catch {
      header.setContent('  ╱ {bold}scrubbed{/bold}{|}{red-fg}Cannot reach API at localhost:3001{/}  ');
      screen.render();
    }
  }

  // ── Key bindings ──────────────────────────────────────────────────────────

  screen.key(['q', 'C-c'], () => {
    screen.destroy();
    process.exit(0);
  });

  screen.key('r', () => { refresh(); });

  screen.key('?', () => {
    if (helpBox.hidden) {
      helpBox.show();
      helpBox.focus();
    } else {
      helpBox.hide();
      brokersList.focus();
    }
    screen.render();
  });

  helpBox.key(['escape', '?'], () => {
    helpBox.hide();
    brokersList.focus();
    screen.render();
  });

  screen.key('p', () => {
    if (!profileBox.hidden) {
      profileBox.hide();
      brokersList.focus();
      screen.render();
      return;
    }
    helpBox.hide();
    renderProfileOverlay();
    profileBox.show();
    profileBox.focus();
    screen.render();
  });

  profileBox.key(['escape', 'p'], () => {
    profileBox.hide();
    brokersList.focus();
    screen.render();
  });

  profileBox.key('e', () => {
    editProfile();
  });

  screen.key('tab', () => {
    logsBox.focus();
    screen.render();
  });

  screen.key('escape', () => {
    if (!helpBox.hidden) helpBox.hide();
    if (!profileBox.hidden) profileBox.hide();
    brokersList.focus();
    screen.render();
  });

  // Command prompt - press : to open
  screen.key(':', () => {
    cmdPrompt.input('scan  profile  profile edit  refresh  quit', '', async (_err: any, value: string) => {
      if (!value) { brokersList.focus(); screen.render(); return; }
      const input = value.trim().toLowerCase();
      brokersList.focus();

      switch (input) {
        case 'scan':
        case 's':
          if (!startingRun) {
            startingRun = true;
            renderStatus();
            screen.render();
            await api.startRun().catch((e: unknown) => {
              const msg = e instanceof Error ? e.message : String(e);
              statusBox.setContent(`{red-fg}${msg}{/}`);
              startingRun = false;
            });
          }
          break;
        case 'refresh':
        case 'r':
          await refresh();
          break;
        case 'clear':
          logsBox.setContent('');
          lastLogSeen = null;
          break;
        case 'profile':
          renderProfileOverlay();
          profileBox.show();
          profileBox.focus();
          break;
        case 'profile edit':
        case 'pe':
          await editProfile();
          break;
        case 'help':
        case '?':
          helpBox.show();
          helpBox.focus();
          break;
        case 'quit':
        case 'q':
          screen.destroy();
          process.exit(0);
        default:
          if (input) {
            statusBox.setContent(`{red-fg}Unknown: ${input}{/}\n{grey-fg}Try: scan, refresh, clear, profile, profile edit, help, quit{/}`);
          }
      }
      screen.render();
    });
  });

  screen.key('s', async () => {
    if (startingRun) return;
    startingRun = true;
    renderStatus();
    screen.render();
    try {
      await api.startRun();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      statusBox.setContent(`{red-fg}${msg}{/}`);
      startingRun = false;
      screen.render();
    }
  });

  // Navigate brokers list and update status panel
  brokersList.on('select item', (_item: any, idx: number) => {
    selectedBrokerIdx = idx;
    renderStatus();
    screen.render();
  });

  // Open URL on Enter
  brokersList.key(['enter'], () => {
    const selected = brokerItems[selectedBrokerIdx];
    if (selected?.url) {
      openUrl(selected.url);
    }
  });

  // ── Boot ──────────────────────────────────────────────────────────────────

  header.setContent('  ╱ {bold}scrubbed{/bold}{|}{grey-fg}Loading...{/}  ');
  screen.render();

  brokersList.focus();

  await refresh();
  const initialLogs = await api.getLogs().catch((): string[] => []);
  lastLogSeen = initialLogs[initialLogs.length - 1] ?? null;
  setInterval(pollLogs, 750);
  setInterval(refresh, 3000);
}
