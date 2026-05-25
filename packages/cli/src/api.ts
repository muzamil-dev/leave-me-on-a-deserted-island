export interface Profile {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  dob_month: number | null;
  dob_year: number | null;
  aliases: string[];
  address_history: string[];
  imap_host: string | null;
  imap_user: string | null;
  imap_pass: string | null;
  captcha_api_key: string | null;
  captcha_provider: '2captcha' | 'capsolver' | null;
}

export interface Broker {
  id: string;
  name: string;
  method: string;
  recheck_days: number;
  requires_id: boolean;
  status: string;
  last_run: string | null;
}

export interface Run {
  id: string;
  status: string;
  total_brokers: number;
  completed: number;
  failed: number;
  skipped: number;
  started_at: string;
  completed_at: string | null;
}

export interface Result {
  id: number;
  run_id: string;
  broker_id: string;
  status: string;
  method: string | null;
  error: string | null;
  screenshot_path: string | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  next_recheck_at: string | null;
}

export interface Discovered {
  id: number;
  broker_id: string;
  profile_url: string;
  found_at: string;
}

const BASE = process.env.SCRUBBED_API_URL ?? 'http://localhost:3001';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Cannot reach API at ${BASE}. Is the API running?\n  ${msg}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = text;
    try { msg = (JSON.parse(text) as { error?: string }).error ?? text; } catch { /* use raw text */ }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => req<{ status: string }>('GET', '/health'),
  getProfile: () => req<Profile>('GET', '/api/profile'),
  setProfile: (data: Partial<Profile>) => req<{ success: boolean }>('POST', '/api/profile', data),
  getBrokers: () => req<Broker[]>('GET', '/api/brokers'),
  getRuns: () => req<Run[]>('GET', '/api/runs'),
  startRun: () => req<{ id: string; status: string }>('POST', '/api/runs/start'),
  getResults: (id: string) => req<Result[]>('GET', `/api/runs/${id}/results`),
  getLogs: () => req<string[]>('GET', '/api/logs'),
  getDiscovered: () => req<Discovered[]>('GET', '/api/discovered'),
};
