import { BrowserRouter as Router, Routes, Route, NavLink, Link } from 'react-router-dom';
import { Settings, Play, Search, Command, User, CheckCircle2, Loader2, HelpCircle, Mail, Shield, Zap, ExternalLink, Trash2, Terminal } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import axios from 'axios';
import clsx from 'clsx';

const API_URL = window.location.origin + '/api';

// ── Brand mark ────────────────────────────────────────────────────────────────
const INK = '#0E1013';
const PAPER = '#F2EFE9';
const BLUE = '#5E81AC';

function Mark({ size = 120, animate = false }: { size?: number; animate?: boolean }) {
  const clipId = useId();
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!animate) return;
    let raf: number;
    let start: number | null = null;
    const loop = (now: number) => {
      if (!start) start = now;
      const phase = ((now - start) / 1000 % 3.2) / 3.2;
      let v: number;
      if (phase < 0.5) v = phase / 0.5;
      else if (phase < 0.7) v = 1;
      else v = 1 - (phase - 0.7) / 0.3;
      setT(v);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  const dx = animate ? -180 + t * 180 : 0;

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ display: 'block', flexShrink: 0 }} aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="120" height="120" rx="14" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="120" height="120" rx="14" fill={INK} />
      <g clipPath={`url(#${clipId})`}>
        <rect x="22" y="22" width="76" height="14" rx="3" fill={PAPER} opacity={0.18} />
        <rect x="22" y="42" width="76" height="14" rx="3" fill={PAPER} opacity={0.36} />
        <rect x="22" y="62" width="76" height="14" rx="3" fill={PAPER} opacity={0.62} />
        <rect x="22" y="82" width="76" height="14" rx="3" fill={PAPER} />
        <g transform={`rotate(-18 60 60) translate(${dx} 0)`}>
          <rect x="-8" y="48" width="160" height="22" fill={BLUE} />
          <rect x="-8" y="48" width="160" height="2" fill={INK} opacity={0.35} />
          <rect x="-8" y="68" width="160" height="2" fill={INK} opacity={0.35} />
        </g>
      </g>
    </svg>
  );
}

const Dashboard = () => {
  const [stats, setStats] = useState({ brokers: 0, submissions: 0, confirmed: 0, manual: 0 });
  const [activeRun, setActiveRun] = useState<any>(null);
  const [discovered, setDiscovered] = useState<any[]>([]);
  const [manualQueue, setManualQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchStatus = async () => {
    try {
      const [brokersRes, runsRes, discoveredRes, logsRes, manualRes] = await Promise.allSettled([
        axios.get(`${API_URL}/brokers`),
        axios.get(`${API_URL}/runs`),
        axios.get(`${API_URL}/discovered`),
        axios.get(`${API_URL}/logs`),
        axios.get(`${API_URL}/manual`),
      ]);

      if (brokersRes.status === 'fulfilled') setStats(prev => ({ ...prev, brokers: brokersRes.value.data.length }));
      if (discoveredRes.status === 'fulfilled') setDiscovered(discoveredRes.value.data);
      if (logsRes.status === 'fulfilled') setLogs(logsRes.value.data);
      if (manualRes.status === 'fulfilled') {
        const unresolved = manualRes.value.data.filter((m: any) => !m.resolved);
        setManualQueue(manualRes.value.data);
        setStats(prev => ({ ...prev, manual: unresolved.length }));
      }
      if (runsRes.status === 'fulfilled') {
        const latestRun = runsRes.value.data[0];
        if (latestRun && (latestRun.status === 'running' || latestRun.status === 'queued')) {
          setActiveRun(latestRun);
        } else {
          setActiveRun(null);
          if (latestRun) setStats(prev => ({ ...prev, submissions: latestRun.completed || 0 }));
        }
      }
    } catch (e) { console.error('UI Status Fetch Failed', e); }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStartScan = async () => {
    setLoading(true); setFeedback(null);
    try {
      await axios.post(`${API_URL}/runs/start`);
      setFeedback("Scan initialized.");
      setTimeout(() => setFeedback(null), 3000);
      fetchStatus();
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to start scan.'); }
    finally { setLoading(false); }
  };

  const removeDiscovered = async (id: number) => {
    await axios.delete(`${API_URL}/discovered/${id}`);
    fetchStatus();
  };

  const resolveManual = async (id: number) => {
    await axios.patch(`${API_URL}/manual/${id}/resolve`);
    fetchStatus();
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-6">
      <div className="bg-surface border border-border rounded-xl p-10 mb-10 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
        <div className="flex items-center gap-6">
          <Mark size={52} animate={!!activeRun} />
          <div>
            <h1 className="text-2xl text-nord6 tracking-tight mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, letterSpacing: '-0.03em' }}>{activeRun ? 'Automation Active' : 'Privacy Command Center'}</h1>
            <p className="text-nord4 font-light text-sm max-w-sm">Broker removal engine is currently {activeRun ? 'scouting and scrubbing.' : 'idle. Start a scan to begin.'}</p>
          </div>
        </div>
        <div className="flex flex-col items-center md:items-end gap-3">
          <button onClick={handleStartScan} disabled={!!activeRun || loading} className="bg-primary hover:bg-nord9 text-white px-10 py-4 rounded-lg font-bold transition-all uppercase tracking-widest text-xs shadow-lg shadow-primary/20 flex items-center gap-3 disabled:opacity-50 min-w-[200px] justify-center">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
            {activeRun ? 'Scan Running' : 'Start New Scan'}
          </button>
          {feedback && <div className="text-[10px] font-bold text-primary uppercase tracking-[0.1em] animate-pulse">{feedback}</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        <FlatStat title="Brokers" value={stats.brokers.toString()} />
        <FlatStat title="Exposures" value={discovered.length.toString()} color={discovered.length > 0 ? "text-nord11" : "text-nord14"} />
        <FlatStat title="Removed" value={stats.submissions.toString()} />
        <FlatStat title="Confirmed" value={stats.confirmed.toString()} color="text-nord14" />
      </div>

      {activeRun && (
        <div className="mb-10 bg-primary/5 border border-primary/20 rounded-xl p-6 shadow-inner animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <Mark size={28} animate />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Live Progress</span>
            </div>
            <span className="text-xs text-nord4 font-mono">{activeRun.completed} / {activeRun.total_brokers}</span>
          </div>
          <div className="w-full bg-nord1 rounded-full h-1.5 overflow-hidden">
            <div className="bg-primary h-full transition-all duration-1000 ease-out" style={{ width: `${(activeRun.completed / (activeRun.total_brokers || 1)) * 100}%` }}></div>
          </div>
        </div>
      )}

      <div className="mb-10 bg-[#0d1117] border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-64">
        <div className="bg-black/20 px-4 py-2 border-b border-border flex items-center gap-2">
          <Terminal size={12} className="text-nord3" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-nord3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Live Engine Stream</span>
        </div>
        <div className="flex-1 overflow-auto p-4 text-[10px] space-y-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {logs.length === 0 ? <div className="text-nord3 italic opacity-50">Waiting for engine handshake...</div> : logs.map((log, i) => <div key={i} className={clsx("whitespace-pre-wrap break-all", log.includes('ERROR') ? 'text-nord11' : log.includes('found') ? 'text-nord14' : 'text-nord4')}>{log}</div>)}
          <div ref={logEndRef} />
        </div>
      </div>

      {manualQueue.filter(m => !m.resolved).length > 0 && (
        <div className="mb-10">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-nord13 mb-4 ml-1">Manual Action Required</h3>
          <div className="bg-surface border border-nord13/30 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-nord13/5 border-b border-nord13/20"><tr><th className="px-6 py-4 font-bold text-nord4 uppercase text-[10px] tracking-widest">Broker</th><th className="px-6 py-4 font-bold text-nord4 uppercase text-[10px] tracking-widest">Reason</th><th className="px-6 py-4 font-bold text-nord4 uppercase text-[10px] tracking-widest">Instructions</th><th className="px-6 py-4 font-bold text-nord4 uppercase text-[10px] tracking-widest text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-border/30">
                {manualQueue.filter(m => !m.resolved).map(m => (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-medium text-nord6 uppercase text-[11px] tracking-wider">{m.broker_id}</td>
                    <td className="px-6 py-4 text-[10px] text-nord13">{m.reason}</td>
                    <td className="px-6 py-4 text-[10px] text-nord4 max-w-sm">
                      <a href={m.opt_out_url} target="_blank" rel="noreferrer" className="text-primary hover:text-nord9 flex items-center gap-1 mb-1">{m.opt_out_url}<ExternalLink size={10} /></a>
                      {m.instructions}
                    </td>
                    <td className="px-6 py-4 text-right"><button onClick={() => resolveManual(m.id)} className="text-[9px] font-bold uppercase tracking-widest border border-nord14/40 text-nord14 hover:bg-nord14/10 px-3 py-1.5 rounded transition-colors"><CheckCircle2 size={12} className="inline mr-1" />Done</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mb-10">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-nord3 mb-4 ml-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Live Exposures Found</h3>
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden min-h-[100px]">
          {discovered.length === 0 ? (
            <div className="p-16 flex flex-col items-center gap-5 bg-black/5">
              <Mark size={40} />
              <span className="text-nord4 italic font-light text-sm">No exposures found. Start a scan to search brokers.</span>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-black/10 border-b border-border"><tr><th className="px-6 py-4 font-bold text-nord4 uppercase text-[10px] tracking-widest">Broker</th><th className="px-6 py-4 font-bold text-nord4 uppercase text-[10px] tracking-widest">Live Profile URL</th><th className="px-6 py-4 font-bold text-nord4 uppercase text-[10px] tracking-widest text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-border/30">
                {discovered.map(p => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-medium text-nord6 uppercase text-[11px] tracking-wider">{p.broker_id}</td>
                    <td className="px-6 py-4 font-mono text-[10px]"><a href={p.profile_url} target="_blank" rel="noreferrer" className="text-primary hover:text-nord9 flex items-center gap-2 truncate max-w-lg">{p.profile_url}<ExternalLink size={10} /></a></td>
                    <td className="px-6 py-4 text-right"><button onClick={() => removeDiscovered(p.id)} className="text-nord3 hover:text-nord11 transition-colors p-2"><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const Profile = () => {
  const [profile, setProfile] = useState<any>({ first_name: '', last_name: '', email: '', phone: '', city: '', state: '', zip: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => { axios.get(`${API_URL}/profile`).then(res => setProfile(res.data)).catch(() => {}).finally(() => setLoading(false)); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMessage(null);
    try {
      await axios.post(`${API_URL}/profile`, profile);
      setMessage({ type: 'success', text: 'Profile Updated.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) { setMessage({ type: 'error', text: 'Update Failed.' }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-20 text-center text-nord4 animate-pulse">Initializing...</div>;

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-center gap-4 mb-8">
        <Mark size={28} />
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, letterSpacing: '-0.03em', fontSize: '1.5rem', color: '#eceff4', margin: 0 }}>Identity Profile</h2>
      </div>
      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-10 shadow-sm space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input label="First Name" value={profile.first_name || ''} onChange={(v: string) => setProfile({...profile, first_name: v})} required />
          <Input label="Last Name" value={profile.last_name || ''} onChange={(v: string) => setProfile({...profile, last_name: v})} required />
          <div className="md:col-span-2"><Input label="Search Email" type="email" value={profile.email || ''} onChange={(v: string) => setProfile({...profile, email: v})} required /></div>
          <Input label="Phone" value={profile.phone || ''} onChange={(v: string) => setProfile({...profile, phone: v})} />
          <Input label="Current City" value={profile.city || ''} onChange={(v: string) => setProfile({...profile, city: v})} />
          <Input label="State Abbr (FL)" value={profile.state || ''} onChange={(v: string) => setProfile({...profile, state: v})} />
          <Input label="Zip Code" value={profile.zip || ''} onChange={(v: string) => setProfile({...profile, zip: v})} />
        </div>
        <div className="pt-6 border-t border-border flex items-center justify-between">
          <button type="submit" disabled={saving} className="bg-primary hover:bg-nord9 text-white px-10 py-3 rounded-md font-bold uppercase tracking-widest text-xs disabled:opacity-50">{saving ? 'Syncing...' : 'Save Profile'}</button>
          {message && <div className={clsx("flex items-center gap-2 text-xs font-bold uppercase tracking-widest", message.type === 'success' ? 'text-nord14' : 'text-nord11')}>{message.text}</div>}
        </div>
      </form>
    </div>
  );
};

const Brokers = () => {
  const [brokers, setBrokers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { axios.get(`${API_URL}/brokers`).then(res => setBrokers(res.data)).catch(console.error).finally(() => setLoading(false)); }, []);
  return (
    <div className="max-w-6xl mx-auto py-12 px-6">
      <div className="flex items-center justify-center gap-4 mb-8">
        <Mark size={28} />
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, letterSpacing: '-0.03em', fontSize: '1.5rem', color: '#eceff4', margin: 0 }}>Broker Directory</h2>
      </div>
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/20 border-b border-border"><tr><th className="px-6 py-4 font-bold text-nord4 uppercase text-[10px]">Broker</th><th className="px-6 py-4 font-bold text-nord4 uppercase text-[10px] text-center">Status</th><th className="px-6 py-4 font-bold text-nord4 uppercase text-[10px]">Method</th><th className="px-6 py-4 font-bold text-nord4 uppercase text-[10px] text-right">Last Scan</th></tr></thead>
          <tbody className="divide-y divide-border/50">{loading ? null : brokers.map(broker => (<tr key={broker.id} className="hover:bg-white/5 transition-colors"><td className="px-6 py-4 font-medium text-nord6 uppercase text-xs">{broker.name}</td><td className="px-6 py-4 text-center"><StatusBadge status={broker.status} /></td><td className="px-6 py-4 text-[10px] text-nord4 font-bold uppercase tracking-widest">{broker.method}</td><td className="px-6 py-4 text-xs text-nord4 text-right">{broker.last_run ? new Date(broker.last_run).toLocaleDateString() : 'Never'}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
};

const Help = () => (
  <div className="max-w-4xl mx-auto py-12 px-6 space-y-12">
    <div className="flex flex-col items-center gap-5">
      <Mark size={64} />
      <div className="text-center">
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, letterSpacing: '-0.03em', fontSize: '2rem', color: '#eceff4', margin: '0 0 6px' }}>scrubbed</h2>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6B6F76', margin: 0 }}>self-hosted privacy</p>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <DocCard icon={<User className="text-primary" />} title="1. Identity" content="Ensure your city and state are accurate. The engine uses your profile to identify your listings on each broker." />
      <DocCard icon={<Mail className="text-nord14" />} title="2. Email" content="Verification links from brokers arrive via your configured email. IMAP credentials let the engine auto-confirm." />
      <DocCard icon={<Zap className="text-nord13" />} title="3. Scans" content="The engine searches each broker, fuzzy-matches your profile, and submits opt-out requests automatically." />
      <DocCard icon={<Shield className="text-nord10" />} title="4. Privacy" content="Your data never leaves your machine. All profile info is stored locally in an encrypted SQLite database." />
    </div>
  </div>
);

const DocCard = ({ icon, title, content }: any) => (
  <div className="bg-surface border border-border p-8 rounded-xl shadow-sm hover:border-primary/40 transition-colors">
    <div className="mb-4">{icon}</div>
    <h3 className="text-xs font-bold uppercase tracking-widest text-nord6 mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{title}</h3>
    <p className="text-sm text-nord4 font-light leading-relaxed">{content}</p>
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const styles = {
    submitted: "bg-nord10/20 text-nord10 border-nord10/30",
    confirmed: "bg-nord14/20 text-nord14 border-nord14/30",
    failed: "bg-nord11/20 text-nord11 border-nord11/30",
    pending: "bg-nord3/20 text-nord3 border-nord3/30",
    skipped: "bg-nord2/20 text-nord4 border-nord2/30",
    manual: "bg-nord13/20 text-nord13 border-nord13/30",
  }[status] || "bg-nord3/20 text-nord3 border-nord3/30";
  const display = status === 'manual' ? 'action required' : status;
  return <span className={clsx("px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border", styles)}>{display}</span>;
};

const Input = ({ label, value, onChange, type = "text", required = false }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-bold uppercase tracking-widest text-nord4 ml-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{label}{required && '*'}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} className="w-full bg-background border border-border rounded-md px-4 py-2 text-sm text-nord6 focus:outline-none focus:ring-1 focus:ring-primary transition-all" style={{ fontFamily: "'JetBrains Mono', monospace" }} />
  </div>
);

const FlatStat = ({ title, value, color = "text-nord6" }: { title: string, value: string, color?: string }) => (
  <div className="bg-surface border border-border p-6 text-center rounded-xl shadow-sm">
    <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2 opacity-40" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#6B6F76' }}>{title}</div>
    <div className={clsx("text-3xl font-light", color)} style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}>{value}</div>
  </div>
);

const NavItem = ({ to, label }: { to: string, label: string }) => (
  <NavLink to={to} style={{ fontFamily: "'JetBrains Mono', monospace" }} className={({ isActive }) => clsx("px-5 py-4 text-[11px] font-bold uppercase tracking-[0.2em] transition-all border-b-2", isActive ? "border-primary text-primary" : "border-transparent text-nord4 hover:text-nord6")}>{label}</NavLink>
);

function App() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchInputRef.current?.focus(); } };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-background font-sans text-nord6 overflow-x-hidden selection:bg-primary/30">
        <header className="bg-surface text-nord6 border-b border-border shadow-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
            <div className="flex items-center gap-10">
              <Link to="/" className="flex items-center gap-5 py-4 hover:opacity-80 transition-opacity" aria-label="Scrubbed">
                  <Mark size={32} />
                  <div className="flex flex-col gap-0.5">
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: '1.05rem', letterSpacing: '-0.03em', color: '#eceff4', lineHeight: 1 }}>scrubbed</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6B6F76', lineHeight: 1 }}>self-hosted privacy</span>
                  </div>
                </Link>
              <nav className="hidden md:flex"><NavItem to="/profile" label="Profile" /><NavItem to="/brokers" label="Brokers" /><NavItem to="/help" label="Help" /></nav>
            </div>
            <div className="flex-1 max-w-md mx-8">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={14} className="text-nord3 group-focus-within:text-primary transition-colors" /></div>
                <input ref={searchInputRef} type="text" className="block w-full bg-background border border-border rounded-md py-1.5 pl-10 pr-12 text-xs text-nord6 placeholder-nord3 focus:outline-none focus:ring-1 focus:ring-primary transition-all shadow-inner" placeholder="Search brokers, status..." style={{ fontFamily: "'JetBrains Mono', monospace" }} />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"><div className="flex items-center gap-1 bg-border/50 px-1.5 py-0.5 rounded text-[10px] text-nord3 font-medium border border-border"><Command size={10} /><span>K</span></div></div>
              </div>
            </div>
            <div className="flex items-center gap-4"><Link to="/help" className="text-nord4 hover:text-nord6 transition-colors opacity-60 hover:opacity-100"><HelpCircle size={18} /></Link><button className="text-nord4 hover:text-nord6 transition-colors opacity-60 hover:opacity-100"><Settings size={18} /></button></div>
          </div>
        </header>
        <main className="pb-20"><Routes><Route path="/" element={<Dashboard />} /><Route path="/profile" element={<Profile />} /><Route path="/brokers" element={<Brokers />} /><Route path="/help" element={<Help />} /></Routes></main>
      </div>
    </Router>
  );
}

export default App;
