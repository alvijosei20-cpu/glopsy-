import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, Loader2, Check, X, RefreshCw, Users, Inbox, Search, CreditCard,
  Wallet, KeyRound, Trash2, Bell, Image as ImageIcon, Percent, Server, GitBranch,
  Power, Activity, ExternalLink, Truck, MapPin,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';
const GH_REPO = 'alvijosei20-cpu/glopsy-';

const NAV = [
  { k: 'overview', label: 'Servidor', Icon: Server },
  { k: 'requests', label: 'Solicitudes', Icon: Inbox },
  { k: 'sellers', label: 'Vendedores', Icon: Users },
  { k: 'notifications', label: 'Notificaciones', Icon: Bell },
  { k: 'banners', label: 'Banners', Icon: ImageIcon },
  { k: 'commissions', label: 'Comisiones', Icon: Percent },
  { k: 'integrations', label: 'Integraciones', Icon: CreditCard },
  { k: 'auth', label: 'Auth', Icon: KeyRound },
  { k: 'tracking', label: 'Rastreo', Icon: Truck },
  { k: 'repo', label: 'Repositorio', Icon: GitBranch },
];

const PROVIDERS = [
  { key: 'mercadopago', label: 'Mercado Pago', fields: ['public_key', 'access_token', 'webhook_secret'] },
  { key: 'bold', label: 'Bold', fields: ['public_key', 'access_token', 'webhook_secret'] },
  { key: 'envia', label: 'ENVIA', fields: ['access_token', 'webhook_secret'] },
];
const FIELD_LABEL = { public_key: 'Public Key', access_token: 'Access Token', webhook_secret: 'Webhook Secret' };
const BANNER_FIELDS = ['title', 'highlight', 'badge', 'desc', 'cta', 'to', 'bgFrom', 'bgVia', 'bgTo', 'btnBg', 'btnText', 'glow'];
const NOTIF_TYPES = [['aviso', 'Aviso'], ['link', 'Enlace'], ['app', 'App']];

const Card = ({ className = '', children }) => (
  <div className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl ${className}`}>{children}</div>
);
const Btn = ({ variant = 'primary', className = '', children, ...p }) => {
  const styles = {
    primary: 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white hover:opacity-90',
    dark: 'bg-slate-900 text-white hover:opacity-90 dark:bg-white dark:text-slate-900',
    soft: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-slate-200',
    danger: 'bg-rose-100 text-rose-700 hover:bg-rose-200',
    ok: 'bg-emerald-600 text-white hover:opacity-90',
  }[variant];
  return <button {...p} className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-bold px-3 py-2 text-sm transition-colors disabled:opacity-50 ${styles} ${className}`}>{children}</button>;
};
const Field = ({ label, children }) => (
  <label className="block">
    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);
const inputCls = 'w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-fuchsia-400';

export default function AdminPanel() {
  const [key, setKey] = useState(() => localStorage.getItem('glopsy_admin_key') || '');
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState('overview');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const call = useCallback(async (path, opts = {}) => {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...(opts.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
    return data;
  }, [key]);

  const pub = useCallback(async (path) => {
    const res = await fetch(`${API}${path}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
    return data;
  }, []);

  const enter = async () => {
    localStorage.setItem('glopsy_admin_key', key);
    setMsg('');
    try {
      await call('/admin/panic');
      setAuthed(true);
    } catch (e) {
      setAuthed(false);
      setMsg(e.message);
    }
  };

  // Auto-entrar si ya hay una clave guardada.
  useEffect(() => {
    if (key) enter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white flex items-center justify-center">
          <ShieldCheck size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Administración</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Monitoreo, vendedores, contenido e integraciones.</p>
        </div>
      </div>

      {!authed ? (
        <Card className="p-5 max-w-md">
          <Field label="Clave de administrador">
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enter()} placeholder="NOTIFICATIONS_ADMIN_KEY" className={inputCls} />
          </Field>
          {msg && <p className="text-xs mt-2 text-rose-600">{msg}</p>}
          <Btn className="mt-3 w-full" onClick={enter}>Entrar</Btn>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[200px_minmax(0,1fr)] gap-4 sm:gap-6">
          {/* Sidebar de vistas */}
          <nav className="flex flex-wrap lg:flex-col gap-1 lg:sticky lg:top-4 lg:self-start">
            {NAV.map(({ k, label, Icon }) => (
              <button
                key={k}
                type="button"
                onClick={() => { setView(k); setMsg(''); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-colors ${
                  view === k ? 'bg-fuchsia-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon size={16} className="shrink-0" /> {label}
              </button>
            ))}
          </nav>

          {/* Contenido */}
          <div className="min-w-0">
            {msg && <p className="text-xs mb-3 text-rose-600">{msg}</p>}
            {view === 'overview' && <Overview pub={pub} call={call} />}
            {view === 'requests' && <Requests call={call} setMsg={setMsg} />}
            {view === 'sellers' && <Sellers call={call} setMsg={setMsg} />}
            {view === 'notifications' && <Notifications call={call} setMsg={setMsg} />}
            {view === 'banners' && <Banners call={call} pub={pub} setMsg={setMsg} />}
            {view === 'commissions' && <Commissions call={call} setMsg={setMsg} />}
            {view === 'integrations' && <Integrations call={call} setMsg={setMsg} />}
            {view === 'auth' && <Auth call={call} setMsg={setMsg} />}
            {view === 'tracking' && <Tracking call={call} setMsg={setMsg} />}
            {view === 'repo' && <Repo />}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Vistas ----------------------------- */

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={18} className="text-fuchsia-600" />
      <div>
        <h2 className="font-extrabold text-slate-900 dark:text-white leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function Overview({ pub, call }) {
  const [health, setHealth] = useState(null);
  const [pool, setPool] = useState(null);
  const [panic, setPanic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    pub('/health').then(setHealth).catch(() => setHealth({ ok: false }));
    pub('/health/pool').then(setPool).catch(() => setPool(null));
    call('/admin/panic').then((d) => setPanic(d.panic === true)).catch(() => {});
  }, [pub, call]);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const togglePanic = async () => {
    setBusy(true); setErr('');
    try { const d = await call('/admin/panic', { method: 'POST', body: JSON.stringify({ on: !panic }) }); setPanic(d.panic === true); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const poolInfo = pool?.pool || {};
  const pg = pool?.pg || {};
  const cards = [
    {
      label: 'API',
      value: health ? (health.ok ? 'operativa' : 'con fallos') : '…',
      sub: health ? `BD: ${health.db} · Redis: ${health.redis}` : '',
      ok: health?.ok !== false,
      Icon: Activity,
    },
    {
      label: 'Pool',
      value: pool ? `${poolInfo.total ?? 0}/${poolInfo.max ?? '?'}` : '…',
      sub: pool ? `activos ${poolInfo.active ?? 0} · espera ${poolInfo.waiting ?? 0} · PG ${pg.total ?? 0}/${pg.max ?? '?'}` : '',
      ok: true,
      Icon: Server,
    },
  ];

  return (
    <div>
      <SectionTitle icon={Activity} title="Estado del servidor" subtitle="Datos en vivo (se actualiza cada 30s)." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-4 min-w-0">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold"><c.Icon size={14} className="shrink-0" /> {c.label}</div>
            <p className={`mt-1 text-2xl font-extrabold truncate ${c.ok ? 'text-emerald-600' : 'text-amber-600'}`}>{c.value}</p>
            {c.sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{c.sub}</p>}
          </Card>
        ))}
      </div>

      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><Power size={16} className={panic ? 'text-rose-600' : 'text-emerald-600'} /> Kill switch (pánico)</p>
          <p className="text-xs text-slate-500">Actívalo para poner la API pública en mantenimiento (503). El panel admin sigue disponible.</p>
        </div>
        <Btn variant={panic ? 'danger' : 'soft'} disabled={busy} onClick={togglePanic}>
          {panic ? 'Desactivar mantenimiento' : 'Activar mantenimiento'}
        </Btn>
      </Card>
      {err && <p className="text-xs mt-2 text-rose-600">{err}</p>}
    </div>
  );
}

function Requests({ call, setMsg }) {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await call(`/admin/seller-requests?status=${status}`); setRows(d.requests || []); }
    catch (e) { setMsg(e.message); } finally { setLoading(false); }
  }, [call, status, setMsg]);
  useEffect(() => { load(); }, [load]);

  const review = async (userId, approve) => {
    setBusy(userId);
    try { await call('/admin/seller-requests/review', { method: 'POST', body: JSON.stringify({ userId, approve }) }); await load(); }
    catch (e) { setMsg(e.message); } finally { setBusy(null); }
  };
  const fmt = (d) => (d ? new Date(d).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

  return (
    <div>
      <SectionTitle icon={Inbox} title="Solicitudes de vendedor" subtitle="Aprueba o rechaza el alta de tiendas." />
      <div className="flex flex-wrap gap-2 mb-4">
        {['pending', 'approved', 'rejected'].map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${status === s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>
            {s === 'pending' ? 'Pendientes' : s === 'approved' ? 'Aprobadas' : 'Rechazadas'}
          </button>
        ))}
      </div>
      {loading ? <Loader text="Cargando…" /> : rows.length === 0 ? <Empty text="Sin solicitudes." /> : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white truncate">{r.name || r.email}</p>
                <p className="text-xs text-slate-500">{r.email} · {fmt(r.sell_requested_at)}</p>
                {r.sell_note && <p className="text-xs text-slate-500 mt-1 italic">"{r.sell_note}"</p>}
              </div>
              {r.sell_status === 'pending' ? (
                <div className="flex flex-wrap gap-2">
                  <Btn variant="ok" disabled={busy === r.id} onClick={() => review(r.id, true)}><Check size={15} /> Aprobar</Btn>
                  <Btn variant="danger" disabled={busy === r.id} onClick={() => review(r.id, false)}><X size={15} /> Rechazar</Btn>
                </div>
              ) : (
                <span className={`text-xs font-bold ${r.sell_status === 'approved' ? 'text-emerald-600' : 'text-rose-600'}`}>{r.sell_status === 'approved' ? 'Aprobada' : 'Rechazada'}</span>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Sellers({ call, setMsg }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await call(`/admin/sellers?limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}`); setRows(d.users || []); }
    catch (e) { setMsg(e.message); } finally { setLoading(false); }
  }, [call, q, setMsg]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const toggle = async (email, canSell) => {
    setBusy(email);
    try { await call('/admin/sellers/set', { method: 'POST', body: JSON.stringify({ email, can_sell: canSell }) }); await load(); }
    catch (e) { setMsg(e.message); } finally { setBusy(null); }
  };

  return (
    <div>
      <SectionTitle icon={Users} title="Vendedores" subtitle="Quién puede crear tienda." />
      <div className="flex items-center gap-2 mb-4 rounded-xl border border-slate-200 dark:border-zinc-700 px-3">
        <Search size={15} className="text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por email o nombre" className="flex-1 bg-transparent py-2 text-sm outline-none" />
      </div>
      {loading ? <Loader text="Cargando…" /> : (
        <div className="space-y-2">
          {rows.map((u) => (
            <Card key={u.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white truncate text-sm">{u.name || u.email}</p>
                <p className="text-xs text-slate-500">{u.email}{u.store_name ? ` · ${u.store_name}` : ''}</p>
              </div>
              {u.can_sell
                ? <Btn variant="danger" disabled={busy === u.email} onClick={() => toggle(u.email, false)}>Quitar</Btn>
                : <Btn variant="ok" disabled={busy === u.email} onClick={() => toggle(u.email, true)}>Hacer vendedor</Btn>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Notifications({ call, setMsg }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ type: 'aviso', title: '', message: '', target: 'global', url: '', scheme: '', fallbackUrl: '', active: true, days: '' });
  const [user, setUser] = useState(null);
  const [userQ, setUserQ] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [sending, setSending] = useState(false);
  const [fmsg, setFmsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await call('/notifications/admin'); setRows(d.notifications || []); }
    catch (e) { setMsg(e.message); } finally { setLoading(false); }
  }, [call, setMsg]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userQ.trim()) { setUserResults([]); return; }
    const t = setTimeout(async () => {
      try { const d = await call(`/notifications/users?q=${encodeURIComponent(userQ)}`); setUserResults(d.users || []); } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [userQ, call]);

  const send = async () => {
    setFmsg('');
    if (!form.title.trim() || !form.message.trim()) { setFmsg('Título y mensaje son obligatorios.'); return; }
    const payload = { type: form.type, title: form.title, message: form.message, target: form.target, active: form.active };
    if (form.type === 'link') { if (!form.url.trim()) { setFmsg('La URL es obligatoria.'); return; } payload.url = form.url; }
    if (form.type === 'app') { if (!form.scheme.trim()) { setFmsg('El deep link es obligatorio.'); return; } payload.scheme = form.scheme; payload.fallbackUrl = form.fallbackUrl || null; }
    if (form.target === 'user') { if (!user) { setFmsg('Selecciona un usuario.'); return; } payload.userId = user.id; }
    const days = parseInt(form.days, 10); if (days > 0) payload.expiresAt = Date.now() + days * 86400000;
    setSending(true);
    try {
      await call('/notifications/', { method: 'POST', body: JSON.stringify(payload) });
      setFmsg('Notificación enviada.');
      setForm({ ...form, title: '', message: '', url: '', scheme: '', fallbackUrl: '' });
      setUser(null); setUserQ('');
      await load();
    } catch (e) { setFmsg(e.message); } finally { setSending(false); }
  };

  const del = async (id) => { try { await call(`/notifications/${id}`, { method: 'DELETE' }); await load(); } catch (e) { setMsg(e.message); } };
  const toggle = async (n) => { try { await call(`/notifications/${n.id}`, { method: 'PATCH', body: JSON.stringify({ active: !n.active }) }); await load(); } catch (e) { setMsg(e.message); } };

  return (
    <div>
      <SectionTitle icon={Bell} title="Notificaciones" subtitle="Envía avisos globales o a un usuario." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {NOTIF_TYPES.map(([v, l]) => (
              <button key={v} type="button" onClick={() => setForm({ ...form, type: v })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${form.type === v ? 'bg-fuchsia-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>{l}</button>
            ))}
          </div>
          <Field label="Título"><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Mensaje"><textarea rows={3} className={inputCls} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
          {form.type === 'link' && <Field label="URL"><input className={inputCls} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></Field>}
          {form.type === 'app' && (
            <>
              <Field label="Deep link (scheme)"><input className={inputCls} value={form.scheme} onChange={(e) => setForm({ ...form, scheme: e.target.value })} placeholder="glopsy://…" /></Field>
              <Field label="Fallback URL"><input className={inputCls} value={form.fallbackUrl} onChange={(e) => setForm({ ...form, fallbackUrl: e.target.value })} /></Field>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {['global', 'user'].map((t) => (
              <button key={t} type="button" onClick={() => setForm({ ...form, target: t })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${form.target === t ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>{t === 'global' ? 'Global' : 'Usuario'}</button>
            ))}
          </div>
          {form.target === 'user' && (
            <div>
              <input className={inputCls} value={userQ} onChange={(e) => setUserQ(e.target.value)} placeholder="Buscar usuario por email/nombre" />
              {user && <p className="text-xs text-emerald-600 mt-1">Seleccionado: {user.name || user.email}</p>}
              {userResults.length > 0 && (
                <div className="mt-1 border border-slate-200 dark:border-zinc-700 rounded-xl max-h-40 overflow-y-auto">
                  {userResults.map((u) => (
                    <button key={u.id} type="button" onClick={() => { setUser(u); setUserResults([]); setUserQ(u.email); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800">
                      {u.name || u.email} <span className="text-slate-400">· {u.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Activa
            </label>
            <Field label="Expira (días)"><input type="number" min="0" className={inputCls} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></Field>
          </div>
          {fmsg && <p className={`text-xs ${fmsg.includes('enviada') ? 'text-emerald-600' : 'text-rose-600'}`}>{fmsg}</p>}
          <Btn disabled={sending} onClick={send} className="w-full">{sending ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />} Enviar</Btn>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-bold text-sm text-slate-900 dark:text-white">Enviadas</p>
            <button type="button" onClick={load} className="text-slate-400 hover:text-slate-700"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
          </div>
          {rows.length === 0 ? <Empty text="Sin notificaciones." /> : (
            <div className="space-y-2 max-h-[28rem] overflow-y-auto">
              {rows.map((n) => (
                <div key={n.id} className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white flex-1 truncate">{n.title}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${n.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{n.active ? 'Activa' : 'Inactiva'}</span>
                    <button type="button" onClick={() => toggle(n)} className="text-slate-400 hover:text-slate-700" title="Activar/Desactivar"><Power size={14} /></button>
                    <button type="button" onClick={() => del(n.id)} className="text-rose-400 hover:text-rose-600" title="Eliminar"><Trash2 size={14} /></button>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{n.type} · {n.target === 'user' ? `usuario ${n.userId ?? ''}` : 'global'}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Banners({ call, pub, setMsg }) {
  const [banners, setBanners] = useState([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fmsg, setFmsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await pub('/home/banners'); setBanners((d.banners || []).slice(0, 4)); }
    catch (e) { setMsg(e.message); } finally { setLoading(false); }
  }, [pub, setMsg]);
  useEffect(() => { load(); }, [load]);

  const setField = (idx, f, v) => setBanners((prev) => prev.map((b, i) => (i === idx ? { ...b, [f]: v } : b)));

  const save = async () => {
    setSaving(true); setFmsg('');
    try {
      const payload = banners.map((b) => ({ ...b, to: b.to || '/listpr' }));
      const d = await call('/home/banners', { method: 'PUT', body: JSON.stringify({ banners: payload }) });
      setBanners((d.banners || payload).slice(0, 4));
      setFmsg('Banners guardados.');
    } catch (e) { setFmsg(e.message); } finally { setSaving(false); }
  };
  const reset = async () => {
    if (!window.confirm('¿Restaurar los banners originales?')) return;
    try { const d = await call('/home/banners/reset', { method: 'POST' }); setBanners((d.banners || []).slice(0, 4)); setFmsg('Banners restaurados.'); }
    catch (e) { setFmsg(e.message); }
  };

  const b = banners[active] || {};
  return (
    <div>
      <SectionTitle icon={ImageIcon} title="Banners del Home" subtitle="Hasta 4 banners de la portada." />
      <div className="flex flex-wrap gap-2 mb-4">
        {banners.map((_, i) => (
          <button key={i} type="button" onClick={() => setActive(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${active === i ? 'bg-fuchsia-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>Banner {i + 1}</button>
        ))}
      </div>
      {loading ? <Loader text="Cargando…" /> : !b.content && Object.keys(b).length === 0 ? <Empty text="No hay banners." /> : (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              {BANNER_FIELDS.map((f) => (
                <Field key={f} label={f}>
                  <input className={inputCls} value={b[f] ?? ''} onChange={(e) => setField(active, f, e.target.value)} />
                </Field>
              ))}
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mt-5">
                <input type="checkbox" checked={b.active !== false} onChange={(e) => setField(active, 'active', e.target.checked)} /> Activo
              </label>
            </div>
            {fmsg && <p className={`text-xs ${fmsg.includes('guard') || fmsg.includes('restaur') ? 'text-emerald-600' : 'text-rose-600'}`}>{fmsg}</p>}
            <div className="flex flex-wrap gap-2">
              <Btn disabled={saving} onClick={save}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Guardar</Btn>
              <Btn variant="soft" onClick={reset}><RefreshCw size={15} /> Restaurar</Btn>
            </div>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">Vista previa</p>
            <div className="rounded-2xl p-5 text-white min-h-[10rem]"
              style={{ background: `linear-gradient(120deg, ${b.bgFrom || '#7c3aed'}, ${b.bgVia || b.bgTo || '#db2777'})` }}>
              {b.badge && <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">{b.badge}</span>}
              <h3 className="text-lg font-extrabold mt-2">{b.title || 'Título'} <span className="opacity-80">{b.highlight || ''}</span></h3>
              {b.desc && <p className="text-xs mt-1 opacity-90">{b.desc}</p>}
              {b.cta && <span className="inline-block mt-3 text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: b.btnBg || '#ffffff', color: b.btnText || '#7c3aed' }}>{b.cta}</span>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Commissions({ call, setMsg }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ scope: 'global', categoria_id: '', porcentaje: '', activo: true });
  const [cats, setCats] = useState([]);
  const [fmsg, setFmsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await call('/admin/commissions'); setRows(d.commissions || d.rules || []); }
    catch (e) { setMsg(e.message); } finally { setLoading(false); }
  }, [call, setMsg]);
  useEffect(() => { load(); call('/admin/commissions').then(() => {}).catch(() => {}); }, [load, call]);

  const save = async () => {
    setFmsg('');
    const pct = Number(form.porcentaje);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) { setFmsg('Porcentaje inválido.'); return; }
    try {
      await call('/admin/commissions', { method: 'POST', body: JSON.stringify({ scope: form.scope, categoria_id: form.categoria_id || null, porcentaje: pct, activo: form.activo }) });
      setFmsg('Comisión guardada.'); setForm({ ...form, porcentaje: '', categoria_id: '' }); await load();
    } catch (e) { setFmsg(e.message); }
  };
  const del = async (id) => { try { await call(`/admin/commissions/${id}`, { method: 'DELETE' }); await load(); } catch (e) { setMsg(e.message); } };

  return (
    <div>
      <SectionTitle icon={Percent} title="Comisiones" subtitle="Porcentaje que cobra la plataforma." />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-4 space-y-3">
          <Field label="Alcance">
            <select className={inputCls} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
              <option value="global">Global</option>
              <option value="categoria">Categoría</option>
            </select>
          </Field>
          {form.scope === 'categoria' && (
            <Field label="Categoría (ID)"><input className={inputCls} value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })} placeholder="ID de categoría" /></Field>
          )}
          <Field label="Porcentaje (%)"><input type="number" className={inputCls} value={form.porcentaje} onChange={(e) => setForm({ ...form, porcentaje: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Activa
          </label>
          {fmsg && <p className={`text-xs ${fmsg.includes('guard') ? 'text-emerald-600' : 'text-rose-600'}`}>{fmsg}</p>}
          <Btn onClick={save} className="w-full"><Check size={15} /> Guardar</Btn>
        </Card>
        <Card className="p-4 lg:col-span-2">
          {loading ? <Loader text="Cargando…" /> : rows.length === 0 ? <Empty text="Sin reglas de comisión." /> : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-zinc-800">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white">{r.scope === 'categoria' || r.categoria_id ? `Categoría ${r.categoria_id ?? r.scope}` : 'Global'}</p>
                    <p className="text-xs text-slate-500">{r.porcentaje ?? r.pct ?? r.percent}% {r.activo === false ? '· inactiva' : ''}</p>
                  </div>
                  <button type="button" onClick={() => del(r.id)} className="text-rose-400 hover:text-rose-600"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Integrations({ call, setMsg }) {
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [im, setIm] = useState('');

  const loadStores = useCallback(async () => {
    try { const d = await call('/admin/stores'); setStores(d.stores || []); if (!storeId && d.stores?.[0]) setStoreId(d.stores[0].usrid); }
    catch (e) { setMsg(e.message); }
  }, [call, storeId, setMsg]);
  useEffect(() => { loadStores(); /* eslint-disable-next-line */ }, [call]);

  const loadIntegrations = useCallback(async (sid) => {
    if (!sid) return;
    setLoading(true);
    try { const d = await call(`/admin/stores/${sid}/checkout-integrations`); setIntegrations(d.integrations || []); }
    catch (e) { setMsg(e.message); } finally { setLoading(false); }
  }, [call, setMsg]);
  useEffect(() => { if (storeId) loadIntegrations(storeId); }, [storeId, loadIntegrations]);

  const find = (p, mode) => integrations.find((i) => i.provider === p && (i.mode || 'prueba') === mode) || null;

  const openModal = (provider) => {
    const prod = find(provider, 'produccion');
    const mode = prod ? 'produccion' : 'prueba';
    const cur = find(provider, mode);
    const f = { public_key: '', access_token: '', webhook_secret: '' };
    for (const k of Object.keys(f)) f[k] = cur?.[k] || '';
    setIm(''); setModal({ provider, mode, form: { ...f }, initial: { ...f }, exists: Boolean(cur) });
  };
  const switchMode = (mode) => setModal((m) => {
    const cur = find(m.provider, mode);
    const f = { public_key: '', access_token: '', webhook_secret: '' };
    for (const k of Object.keys(f)) f[k] = cur?.[k] || '';
    return { ...m, mode, form: { ...f }, initial: { ...f }, exists: Boolean(cur) };
  });

  const save = async () => {
    const { provider, mode, form, initial, exists } = modal;
    const body = { provider, mode };
    for (const f of ['public_key', 'access_token', 'webhook_secret']) if (form[f] !== initial[f] && String(form[f]).trim() !== '') body[f] = form[f];
    if ((provider === 'bold' || provider === 'mercadopago') && !exists && !String(form.public_key).trim()) { setIm('La Public Key es obligatoria.'); return; }
    setBusy(true); setIm('');
    try { await call(`/admin/stores/${storeId}/checkout-integrations`, { method: 'POST', body: JSON.stringify(body) }); await loadIntegrations(storeId); setIm('Guardado.'); setModal((m) => ({ ...m, exists: true, initial: { ...m.form } })); }
    catch (e) { setIm(e.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(`¿Eliminar ${modal.provider} (${modal.mode})?`)) return;
    setBusy(true); setIm('');
    try { await call(`/admin/stores/${storeId}/checkout-integrations/${modal.provider}?mode=${modal.mode}`, { method: 'DELETE' }); await loadIntegrations(storeId); setModal(null); }
    catch (e) { setIm(e.message); } finally { setBusy(false); }
  };
  const provLabel = (p) => PROVIDERS.find((x) => x.key === p)?.label || p;

  return (
    <div>
      <SectionTitle icon={CreditCard} title="Integraciones de pago/checkout" subtitle="Bold, Mercado Pago y ENVIA por tienda." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-slate-500">Tienda</span>
        <select value={storeId || ''} onChange={(e) => setStoreId(Number(e.target.value))} className={`${inputCls} max-w-xs`}>
          {stores.map((s) => <option key={s.usrid} value={s.usrid}>{s.nombres || `Tienda ${s.usrid}`}{s.slug ? ` (${s.slug})` : ''}</option>)}
        </select>
        <button type="button" onClick={() => loadIntegrations(storeId)} className="text-slate-400 hover:text-slate-700"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PROVIDERS.map((p) => {
          const prod = find(p.key, 'produccion'); const test = find(p.key, 'prueba'); const any = prod || test;
          return (
            <Card key={p.key} className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center"><Wallet size={18} /></div>
                <p className="font-bold text-slate-900 dark:text-white">{p.label}</p>
                <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${any ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{any ? (prod ? 'Producción' : 'Prueba') : 'Sin configurar'}</span>
              </div>
              <Btn variant="dark" onClick={() => openModal(p.key)}>Configurar</Btn>
            </Card>
          );
        })}
      </div>

      {modal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50" onClick={() => !busy && setModal(null)}>
          <Card className="w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2"><KeyRound size={18} className="text-fuchsia-600" /> {provLabel(modal.provider)}</h3>
              <button type="button" onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {['prueba', 'produccion'].map((m) => (
                <button key={m} type="button" onClick={() => switchMode(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${modal.mode === m ? 'bg-fuchsia-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>{m === 'prueba' ? 'Prueba' : 'Producción'}</button>
              ))}
            </div>
            <div className="space-y-3">
              {PROVIDERS.find((p) => p.key === modal.provider).fields.map((f) => (
                <Field key={f} label={FIELD_LABEL[f]}>
                  <input type="password" className={inputCls} value={modal.form[f] || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, [f]: e.target.value } }))} placeholder={modal.exists ? '•••• (vacío = no cambiar)' : FIELD_LABEL[f]} />
                </Field>
              ))}
              <p className="text-[11px] text-slate-400">Los valores se muestran enmascarados; deja vacío para conservarlos.</p>
              {im && <p className={`text-xs ${im === 'Guardado.' ? 'text-emerald-600' : 'text-rose-600'}`}>{im}</p>}
            </div>
            <div className="mt-5 flex items-center justify-between gap-2">
              {modal.exists ? <Btn variant="danger" disabled={busy} onClick={remove}><Trash2 size={15} /> Eliminar</Btn> : <div />}
              <div className="flex flex-wrap gap-2">
                <Btn variant="soft" onClick={() => setModal(null)}>Cancelar</Btn>
                <Btn disabled={busy} onClick={save}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Guardar</Btn>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Auth({ call, setMsg }) {
  const AUTH_PROVIDERS = [
    { key: 'google', label: 'Google', hint: 'Google Cloud → Credenciales OAuth 2.0.' },
    { key: 'discord', label: 'Discord', hint: 'Discord Developer Portal → OAuth2.' },
    { key: 'tiktok', label: 'TikTok', hint: 'TikTok for Developers → Login Kit.' },
  ];
  const [status, setStatus] = useState({});
  const [forms, setForms] = useState({});
  const [saving, setSaving] = useState({});
  const [msgs, setMsgs] = useState({});

  const load = useCallback(async (p) => {
    try {
      const d = await call(`/admin/auth/${p}`);
      setStatus((s) => ({ ...s, [p]: d.auth }));
      setForms((f) => ({
        ...f,
        [p]: {
          client_id: d.auth?.client_id || '',
          client_secret: '',
          redirect_uri: d.auth?.redirect_uri || '',
          scopes: d.auth?.scopes || '',
          enabled: d.auth?.enabled !== false,
        },
      }));
    } catch (e) { setMsg(e.message); }
  }, [call, setMsg]);
  useEffect(() => { AUTH_PROVIDERS.forEach((p) => load(p.key)); /* eslint-disable-next-line */ }, [load]);

  const setField = (p, f, v) => setForms((prev) => ({ ...prev, [p]: { ...prev[p], [f]: v } }));
  const save = async (p) => {
    setSaving((s) => ({ ...s, [p]: true })); setMsgs((m) => ({ ...m, [p]: '' }));
    try {
      const d = await call(`/admin/auth/${p}`, { method: 'POST', body: JSON.stringify(forms[p]) });
      setStatus((s) => ({ ...s, [p]: d.auth }));
      setForms((f) => ({ ...f, [p]: { ...f[p], client_secret: '' } }));
      setMsgs((m) => ({ ...m, [p]: 'Guardado.' }));
    } catch (e) { setMsgs((m) => ({ ...m, [p]: e.message })); } finally { setSaving((s) => ({ ...s, [p]: false })); }
  };

  return (
    <div>
      <SectionTitle icon={KeyRound} title="Auth" subtitle="Login social (OAuth) de la plataforma." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {AUTH_PROVIDERS.map((p) => {
          const st = status[p.key];
          const f = forms[p.key] || {};
          return (
            <Card key={p.key} className="p-4 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-bold text-slate-900 dark:text-white">{p.label}</p>
                {st && <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.configured ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{st.configured ? 'Configurado' : 'Sin configurar'}</span>}
              </div>
              <p className="text-xs text-slate-500 mb-3">{p.hint}{st?.source ? ` · fuente: ${st.source}` : ''}</p>
              <div className="space-y-2">
                <Field label={p.key === 'tiktok' ? 'Client Key (ID)' : 'Client ID'}>
                  <input className={inputCls} value={f.client_id || ''} onChange={(e) => setField(p.key, 'client_id', e.target.value)} />
                </Field>
                <Field label="Client Secret">
                  <input type="password" className={inputCls} value={f.client_secret || ''} onChange={(e) => setField(p.key, 'client_secret', e.target.value)} placeholder={st?.client_secret || '•••• (vacío = no cambiar)'} />
                </Field>
                <Field label="Redirect URI">
                  <input className={inputCls} value={f.redirect_uri || ''} onChange={(e) => setField(p.key, 'redirect_uri', e.target.value)} placeholder="https://…/callback" />
                </Field>
                <Field label="Scopes (opcional)">
                  <input className={inputCls} value={f.scopes || ''} onChange={(e) => setField(p.key, 'scopes', e.target.value)} />
                </Field>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={f.enabled !== false} onChange={(e) => setField(p.key, 'enabled', e.target.checked)} /> Habilitado
                </label>
              </div>
              {msgs[p.key] && <p className={`text-xs mt-2 ${msgs[p.key] === 'Guardado.' ? 'text-emerald-600' : 'text-rose-600'}`}>{msgs[p.key]}</p>}
              <Btn className="mt-3" disabled={saving[p.key]} onClick={() => save(p.key)}>
                {saving[p.key] ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Guardar
              </Btn>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Tracking({ call, setMsg }) {
  const [input, setInput] = useState('');
  const [storeId, setStoreId] = useState('');
  const [stores, setStores] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    call('/admin/stores').then((d) => setStores(d.stores || [])).catch(() => {});
  }, [call]);

  const submit = async () => {
    const nums = input.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (nums.length === 0) { setErr('Ingresa al menos una guía.'); return; }
    setLoading(true); setErr(''); setResults(null);
    try {
      const d = await call('/admin/tracking', { method: 'POST', body: JSON.stringify({ trackingNumbers: nums, storeId: storeId || undefined }) });
      setResults(d.tracking || []);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  };

  return (
    <div>
      <SectionTitle icon={Truck} title="Rastreo de guías" subtitle="Consulta el estado y el recorrido del paquete (ENVIA)." />
      <Card className="p-4 mb-4">
        <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end">
          <Field label="Números de guía (separados por coma o salto de línea)">
            <textarea rows={2} className={inputCls} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ej. INTESBX136230, 7520610403" />
          </Field>
          <Btn onClick={submit} disabled={loading} className="h-10">{loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Rastrear</Btn>
        </div>
        {stores.length > 0 && (
          <div className="mt-3">
            <Field label="Tienda (credenciales ENVIA)">
              <select className={`${inputCls} max-w-xs`} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                <option value="">Tienda principal</option>
                {stores.map((s) => <option key={s.usrid} value={s.usrid}>{s.nombres || `Tienda ${s.usrid}`}</option>)}
              </select>
            </Field>
          </div>
        )}
        {err && <p className="text-xs mt-2 text-rose-600">{err}</p>}
      </Card>

      {results && results.length === 0 && <Empty text="Sin resultados." />}
      {Array.isArray(results) && results.map((t, i) => (
        <Card key={i} className="p-4 mb-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-mono text-xs bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{t.trackingNumber || t.tracking_number}</span>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: t.statusColor || '#7e22ce' }}>{t.status || '—'}</span>
            {t.serviceDescription && <span className="text-xs text-slate-500">{t.carrierDescription || t.carrier} · {t.serviceDescription}</span>}
            {t.estimatedDelivery && <span className="text-xs text-slate-500 ml-auto">ETA: {String(t.estimatedDelivery).slice(0, 16)}</span>}
          </div>
          {t.destination && (
            <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={12} /> {t.destination.name} · {t.destination.city}, {t.destination.state} ({t.destination.country})</p>
          )}
          {(t.trackUrlSite || t.trackUrl) && (
            <a href={t.trackUrlSite || t.trackUrl} target="_blank" rel="noreferrer" className="text-xs text-fuchsia-600 hover:underline inline-flex items-center gap-1 mt-1">
              Ver en el transportador <ExternalLink size={12} />
            </a>
          )}
          {Array.isArray(t.eventHistory) && t.eventHistory.length > 0 && (
            <ol className="border-l-2 border-fuchsia-200 dark:border-fuchsia-900 ml-1.5 pl-3 space-y-1.5 mt-2">
              {t.eventHistory.slice(0, 8).map((ev, j) => (
                <li key={j} className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">{ev.status || ev.status_translation || ev.name || 'Evento'}</span>
                  {(ev.date || ev.createdAt || ev.datetime) && <span className="text-slate-400"> · {String(ev.date || ev.createdAt || ev.datetime).slice(0, 16)}</span>}
                  {(ev.content || ev.description || ev.location) && <span className="block text-slate-400">{ev.content || ev.description || ev.location}</span>}
                </li>
              ))}
            </ol>
          )}
        </Card>
      ))}
    </div>
  );
}

function Repo() {
  const [commits, setCommits] = useState([]);
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const headers = { Accept: 'application/vnd.github+json' };
    Promise.all([
      fetch(`https://api.github.com/repos/${GH_REPO}/commits?per_page=8`, { headers }).then((r) => r.json()).catch(() => []),
      fetch(`https://api.github.com/repos/${GH_REPO}/actions/runs?per_page=8`, { headers }).then((r) => r.json()).catch(() => ({})),
    ]).then(([c, r]) => {
      if (Array.isArray(c)) setCommits(c);
      if (Array.isArray(r?.workflow_runs)) setRuns(r.workflow_runs);
    }).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <SectionTitle icon={GitBranch} title="Repositorio y CI" subtitle={GH_REPO} />
      {error && <p className="text-xs text-rose-600 mb-2 break-words">{error}</p>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 min-w-0 overflow-hidden">
          <p className="font-bold text-sm text-slate-900 dark:text-white mb-2">Últimos commits</p>
          {commits.length === 0 ? <Empty text="Sin datos." /> : (
            <div className="space-y-2">
              {commits.map((c) => (
                <a key={c.sha} href={c.html_url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-col p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800">
                  <span className="text-sm text-slate-800 dark:text-slate-200 truncate">{c.commit?.message?.split('\n')[0]}</span>
                  <span className="text-[11px] text-slate-400 truncate">{c.sha?.slice(0, 7)} · {c.commit?.author?.name}</span>
                </a>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-4 min-w-0 overflow-hidden">
          <p className="font-bold text-sm text-slate-900 dark:text-white mb-2">Workflows</p>
          {runs.length === 0 ? <Empty text="Sin datos." /> : (
            <div className="space-y-2">
              {runs.map((r) => (
                <a key={r.id} href={r.html_url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800">
                  <span className={`w-2 h-2 shrink-0 rounded-full ${r.conclusion === 'success' ? 'bg-emerald-500' : r.conclusion === 'failure' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                  <span className="text-sm text-slate-800 dark:text-slate-200 flex-1 min-w-0 truncate">{r.name}</span>
                  <span className="text-[11px] text-slate-400 shrink-0">{r.event}</span>
                  <ExternalLink size={12} className="text-slate-400 shrink-0" />
                </a>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Loader({ text }) {
  return <p className="text-sm text-slate-500 py-8 text-center"><Loader2 className="inline animate-spin" size={16} /> {text}</p>;
}
function Empty({ text }) {
  return <p className="text-sm text-slate-500 py-6 text-center">{text}</p>;
}
