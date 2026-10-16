import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Megaphone, Sparkles, Tag, Send, Mail, RefreshCw,
  CheckCircle2, XCircle, Clock, Search, Copy, ExternalLink, Pencil, Info,
  Package, Users,
} from 'lucide-react';
import { Card } from '../../components/tremor/Card';
import { Badge } from '../../components/tremor/Badge';
import api from '../../services/api';

const TABS = [
  { id: 'all', label: 'Todas', icon: Sparkles },
  { id: 'seo', label: 'SEO', icon: Search },
  { id: 'promo', label: 'Promociones', icon: Tag },
  { id: 'social', label: 'Social', icon: Send },
  { id: 'email', label: 'Email / Push', icon: Mail },
];

const TIPO_LABEL = { seo: 'SEO', promo: 'Promoción', stock: 'Stock', social: 'Social', email: 'Email / Push' };
const TIPO_ICON = { seo: Search, promo: Tag, stock: Package, social: Megaphone, email: Mail };
const TIPO_TONE = {
  seo: 'bg-violet-50 text-violet-600',
  promo: 'bg-fuchsia-50 text-fuchsia-600',
  stock: 'bg-amber-50 text-amber-600',
  social: 'bg-sky-50 text-sky-600',
  email: 'bg-pink-50 text-pink-600',
};

const ESTADO = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  aplicada: { label: 'Aplicada', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  descartada: { label: 'Descartada', cls: 'bg-slate-50 text-slate-500 ring-slate-200' },
};

const BTN = {
  primary: 'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-fuchsia-600 px-3.5 text-xs font-bold text-white transition-colors hover:bg-fuchsia-700 disabled:opacity-60 disabled:cursor-not-allowed',
  ghost: 'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed',
  subtle: 'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed',
  dark: 'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed',
};

const RELATIVE = (ts) => {
  if (!ts) return 'nunca';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
};

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const TikTokGlyph = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16 8.245a5.5 5.5 0 0 0 3.5 1.255V7.02A3.5 3.5 0 0 1 16 3.5h-2.5v9.75A2.25 2.25 0 1 1 11.25 11v-2.6a4.85 4.85 0 1 0 4.75 4.85V8.245Z" />
  </svg>
);

const KpiChip = ({ icon: Icon, label, value, sub, accent }) => (
  <Card className="!rounded-2xl !border-fuchsia-100 !shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-extrabold text-slate-900 tracking-tight">{value}</p>
        {sub && <p className="mt-1 text-[11px] font-medium text-slate-400">{sub}</p>}
      </div>
      <div className={`p-2.5 rounded-xl ${accent === 'emerald' ? 'bg-emerald-50 text-emerald-600' : accent === 'amber' ? 'bg-amber-50 text-amber-600' : accent === 'pink' ? 'bg-pink-50 text-pink-600' : 'bg-fuchsia-50 text-fuchsia-600'}`}>
        <Icon size={20} />
      </div>
    </div>
  </Card>
);

const firstSrc = (x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? x.src || '' : '');

const StatusPill = ({ estado }) => {
  const meta = ESTADO[estado] || ESTADO.pendiente;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${meta.cls}`}>
      {meta.label}
    </span>
  );
};

const SourceChip = ({ llm }) => (
  <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${llm ? 'bg-fuchsia-50 text-fuchsia-600' : 'bg-slate-100 text-slate-500'}`}>
    {llm ? <><Sparkles size={10} />IA</> : 'Reglas'}
  </span>
);

const SuggestionCard = ({ s, onAction, busy, tiktokConnected, onTiktok }) => {
  const [copied, setCopied] = useState(false);
  const [urlEditing, setUrlEditing] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [imgFailed, setImgFailed] = useState(false);

  const p = s.payload || {};
  const TipoIcon = TIPO_ICON[s.tipo] || Sparkles;
  const tipoTone = TIPO_TONE[s.tipo] || TIPO_TONE.promo;
  const productName = s.product_name || (p.productName ? p.productName : null);
  const productImages = Array.isArray(s.product_images) ? s.product_images.map(firstSrc).filter(Boolean) : [];
  const imgSrc = productImages[0] || firstSrc(p.imagen) || '';
  const showImg = imgSrc && !imgFailed;
  const isCopiable = s.tipo === 'social' || s.tipo === 'email';
  const dests = [
    { url: '/listpr', label: 'Catálogo' },
    { url: '/consultar-pedido', label: 'Consultar pedido' },
    ...(p.productos || [])
      .filter((x) => x.public_id)
      .map((x) => ({ url: `/product/${x.public_id}`, label: x.name || 'Producto' })),
  ];
  const previewText = isCopiable
    ? s.tipo === 'email' ? `📣 ${p.title}\n\n${p.body}` : `${p.texto || ''}\n\n${p.hashtags || ''}`
    : s.tipo === 'seo'
      ? `Título SEO: ${p.seo_title}\nPalabras clave: ${(p.keywords || []).join(', ')}`
      : s.tipo === 'promo'
        ? `${p.titulo || s.titulo}\nDescuento: ${p.valor}% (${p.tipo === 'monto_fijo' ? 'monto fijo' : 'porcentaje'})`
        : s.detalle || '';

  const handleCopy = async () => {
    if (await copyText(previewText)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const applyLabel = s.tipo === 'promo' ? 'Crear promoción' : s.tipo === 'seo' ? 'Aplicar SEO' : 'Aplicar';
  const applyBtnClass = s.tipo === 'email' ? BTN.ghost : BTN.primary;

  return (
    <Card className="!rounded-2xl !border-slate-200 !p-5 !shadow-sm transition-shadow hover:shadow-md flex flex-col">
      {/* Encabezado */}
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl ${showImg ? 'bg-slate-100' : tipoTone}`}>
          {showImg ? (
            <img src={imgSrc} alt="" onError={() => setImgFailed(true)} className="h-full w-full object-cover" />
          ) : (
            <TipoIcon size={18} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{TIPO_LABEL[s.tipo] || s.tipo}</span>
            <SourceChip llm={s.fuente === 'llm'} />
            <span className="ml-auto shrink-0"><StatusPill estado={s.estado} /></span>
          </div>
          <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-slate-900">{s.titulo}</h3>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            {productName && <span className="truncate">{productName}</span>}
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
              <Clock size={11} /> {RELATIVE(s.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="mt-4 flex-1">
        {s.tipo === 'seo' ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Título SEO</p>
            <p className="mt-1 text-[13px] font-medium leading-snug text-slate-800">{p.seo_title || '—'}</p>
            {(p.keywords || []).length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {(p.keywords || []).map((k) => (
                  <span key={k} className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">{k}</span>
                ))}
              </div>
            )}
          </div>
        ) : s.tipo === 'promo' ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold leading-none text-fuchsia-600">{p.valor}%</span>
              <span className="text-[11px] font-medium text-slate-500">{p.tipo === 'monto_fijo' ? 'monto fijo' : 'porcentaje'}</span>
            </div>
            {(p.titulo || s.titulo) && <p className="mt-2 text-[12px] leading-relaxed text-slate-600">{p.titulo || s.titulo}</p>}
          </div>
        ) : s.tipo === 'email' ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-[12px] font-bold text-slate-800">{p.title}</p>
            {p.body && <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-600">{p.body}</p>}
            {p.audiencia && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                <Users size={12} /> {p.audiencia.buyers || 0} compradores · {p.audiencia.push_ready || 0} con push
              </p>
            )}
            <div className="mt-2.5 border-t border-slate-200/70 pt-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Destino</span>
                {s.estado === 'pendiente' && !urlEditing && (
                  <button
                    onClick={() => { setUrlDraft(p.url || '/listpr'); setUrlEditing(true); }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-fuchsia-600 transition-colors hover:text-fuchsia-700"
                  >
                    <Pencil size={11} /> Cambiar
                  </button>
                )}
              </div>
              {urlEditing ? (
                <div className="mt-2">
                  <div className="flex flex-wrap gap-1.5">
                    {dests.map((d) => (
                      <button
                        key={d.url}
                        onClick={() => setUrlDraft(d.url)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors ${
                          urlDraft === d.url
                            ? 'border-fuchsia-600 bg-fuchsia-600 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-fuchsia-300'
                        }`}
                        title={d.url}
                      >
                        <ExternalLink size={10} />
                        <span className="max-w-[110px] truncate">{d.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={urlDraft}
                      onChange={(e) => setUrlDraft(e.target.value)}
                      placeholder="/listpr, /product/abc, https://..."
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-100"
                    />
                    <button
                      onClick={() => {
                        if (!urlDraft.trim() || busy) return;
                        onAction(s, 'url', urlDraft.trim());
                        setUrlEditing(false);
                      }}
                      disabled={busy || !urlDraft.trim()}
                      className={BTN.primary}
                    >
                      <CheckCircle2 size={12} /> Guardar
                    </button>
                    <button onClick={() => setUrlEditing(false)} disabled={busy} className={BTN.ghost}>
                      <XCircle size={12} /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 truncate text-[12px] font-medium text-slate-700">{p.url || '/listpr'}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            {s.tipo === 'social' && p.texto ? (
              <>
                <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700">{p.texto}</p>
                {p.hashtags && <p className="mt-1.5 text-[12px] font-medium text-fuchsia-600">{p.hashtags}</p>}
              </>
            ) : (
              <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-600">{s.detalle || 'Sin detalle adicional.'}</p>
            )}
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {isCopiable && (
          <button onClick={handleCopy} className={BTN.subtle}>
            {copied ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Copiar texto'}
          </button>
        )}
        {s.tipo === 'social' && s.estado === 'pendiente' && tiktokConnected && (
          <button onClick={() => onTiktok(s)} disabled={busy} className={BTN.dark}>
            <TikTokGlyph size={14} /> Subir a TikTok
          </button>
        )}
        {s.tipo === 'email' && s.estado !== 'aplicada' && (
          <button onClick={() => onAction(s, 'enviar')} disabled={busy} className={BTN.primary}>
            <Send size={14} /> Enviar push
          </button>
        )}
        {s.tipo === 'social' && s.product_public_id && (
          <Link to={`/product/${s.product_public_id}`} className={BTN.ghost}>
            <ExternalLink size={14} /> Ver producto
          </Link>
        )}
        {s.estado === 'pendiente' && (
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => onAction(s, 'descartar')} disabled={busy} className={BTN.ghost}>
              <XCircle size={14} /> Descartar
            </button>
            <button onClick={() => onAction(s, 'aplicar')} disabled={busy} className={applyBtnClass}>
              <CheckCircle2 size={14} /> {applyLabel}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
};

const Marketing = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [overview, setOverview] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [tiktok, setTiktok] = useState({ connected: false });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ovRes, sugRes, tkRes] = await Promise.all([
        api.get('/tienda/marketing'),
        api.get('/tienda/marketing/sugerencias', { params: { limit: 60 } }),
        api.get('/tienda/marketing/tiktok').catch(() => ({ data: {} })),
      ]);
      if (ovRes.data.ok) setOverview(ovRes.data);
      if (sugRes.data.ok) setSuggestions(sugRes.data.suggestions || []);
      if (tkRes.data?.ok) setTiktok(tkRes.data.tiktok || { connected: false });
    } catch {
      setError('No se pudieron cargar los datos de marketing.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('tiktok');
    if (q === 'connected') setNotice('Cuenta de TikTok conectada. Ya puedes subir videos a tu bandeja.');
    else if (q === 'error') setError('No se pudo conectar con TikTok. Intenta de nuevo.');
  }, []);

  const runAnalysis = async () => {
    setRunning(true);
    setNotice('');
    setRunResult(null);
    setError('');
    try {
      const { data } = await api.post('/tienda/marketing/run');
      if (data.ok) {
        setRunResult(data.stats);
        setNotice('Análisis completado. Revisa las nuevas sugerencias.');
        await load();
      } else {
        setError(data.message || 'No se pudo ejecutar el análisis.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo ejecutar el análisis.');
    } finally {
      setRunning(false);
    }
  };

  const action = async (s, accion, body) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.post(`/tienda/marketing/sugerencias/${s.id}/${accion}`, body || {});
      if (data.ok) {
        setNotice(data.message || 'Acción completada.');
        await load();
      } else {
        setError(data.message || 'No se pudo completar la acción.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo completar la acción.');
    } finally {
      setBusy(false);
    }
  };

  const connectTiktok = async () => {
    setError('');
    try {
      const { data } = await api.get('/tienda/marketing/tiktok/connect');
      if (data.ok && data.url) window.location.href = data.url;
      else setError(data.message || 'No fue posible iniciar la conexión con TikTok.');
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible iniciar la conexión con TikTok.');
    }
  };

  const disconnectTiktok = async () => {
    if (!window.confirm('¿Desconectar tu cuenta de TikTok?')) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.delete('/tienda/marketing/tiktok');
      if (data.ok) { setNotice(data.message || 'Cuenta de TikTok desconectada.'); await load(); }
      else setError(data.message || 'No se pudo desconectar TikTok.');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo desconectar TikTok.');
    } finally {
      setBusy(false);
    }
  };

  const uploadTiktok = async (s) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.post('/tienda/marketing/tiktok/post', { suggestionId: s?.id });
      if (data.ok) { setNotice(data.message || 'Carrusel enviado a tu bandeja de TikTok.'); await load(); }
      else setError(data.message || 'No se pudo enviar a TikTok.');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo enviar a TikTok.');
    } finally {
      setBusy(false);
    }
  };

  const counts = overview?.summary || {};
  const filtered = tab === 'all' ? suggestions : suggestions.filter((s) => s.tipo === tab);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-fuchsia-600 border-t-transparent" />
          <p className="font-medium text-slate-600">Cargando marketing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16 text-slate-800">
      <div className="sticky top-16 z-40 border-b border-fuchsia-100 bg-white px-4 py-3 shadow-sm sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <button
            onClick={() => navigate('/market')}
            className="flex shrink-0 items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-fuchsia-600"
          >
            <ArrowLeft size={18} />
            <span>Mi tienda</span>
          </button>
          <div className="flex items-center gap-2 rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-3 py-1.5 text-xs font-medium text-fuchsia-800 sm:text-sm">
            <Megaphone size={16} className="shrink-0 text-fuchsia-600" />
            <span className="hidden sm:inline">Asistente de Marketing</span>
            <span className="sm:hidden">Marketing</span>
            {overview?.llm?.enabled ? (
              <Badge variant="default" className="!text-[10px]"><Sparkles size={10} className="mr-1 inline" />IA activa</Badge>
            ) : (
              <Badge variant="neutral" className="!text-[10px]">IA sin API key</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-950">Marketing</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
              Tu asistente analiza el catálogo y genera acciones: SEO, promociones, contenido social y campañas. Se actualiza automáticamente cada 6 horas.
            </p>
          </div>
          <button
            onClick={runAnalysis}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-fuchsia-600/20 disabled:opacity-60"
          >
            <RefreshCw size={16} className={running ? 'animate-spin' : ''} />
            {running ? 'Analizando...' : 'Analizar ahora'}
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-3.5 text-xs text-slate-600">
          <div className="mb-2 flex items-center gap-2">
            <Info size={14} className="shrink-0 text-fuchsia-600" />
            <p className="font-bold text-slate-800">Cómo funciona el contenido social</p>
          </div>
          <ul className="list-disc space-y-1 pl-5 marker:text-slate-300">
            <li>La IA <b>redacta el post</b> (texto, hashtags y foto del producto). Cópialo con <b>“Copiar texto”</b> para publicarlo en tus redes (Instagram, TikTok, etc.).</li>
            <li>Se genera solo cada <b>6 horas</b> (ciclo automático) o cuando pulsas <b>Analizar ahora</b>.</li>
            <li>Por ciclo genera hasta <b>3 posts</b>, de los productos con ventas recientes.</li>
            <li>Máximo <b>1 post por producto por día</b>.</li>
            <li><b>“Marcar aplicada”</b> es solo tu registro interno de que ya lo publicaste.</li>
          </ul>
        </div>

        {/* TikTok: subir videos a la bandeja (Content Posting API) */}
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black text-white"><TikTokGlyph size={20} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">{tiktok.connected ? 'TikTok conectado' : 'Publica en TikTok desde tu catálogo'}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {tiktok.connected
                ? 'En los posts sociales tienes el botón “Subir a TikTok”: el video va a tu bandeja y luego lo publicas.'
                : 'Conecta tu cuenta de TikTok y sube los videos de tus productos a tu bandeja de borradores.'}
            </p>
          </div>
          {tiktok.connected ? (
            <button onClick={disconnectTiktok} disabled={busy} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-pink-300 hover:text-pink-600 disabled:opacity-60">
              <XCircle size={13} /> Desconectar
            </button>
          ) : (
            <button onClick={connectTiktok} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90">
              <TikTokGlyph size={14} /> Conectar TikTok
            </button>
          )}
        </div>

        {runResult && (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
            Resultado del análisis: {runResult.seo || 0} SEO · {runResult.promo || 0} promociones · {runResult.social || 0} social · {runResult.email || 0} email · {runResult.stock || 0} stock.
          </div>
        )}
        {notice && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800" role="status">{notice}</div>}
        {error && <div className="mb-5 rounded-2xl border border-pink-200 bg-pink-50 px-4 py-3 text-xs font-semibold text-pink-700" role="alert">{error}</div>}

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KpiChip icon={Sparkles} label="SEO pendientes" value={counts.seo || 0} accent="violet" />
          <KpiChip icon={Tag} label="Promociones" value={counts.promo || 0} accent="fuchsia" />
          <KpiChip icon={Megaphone} label="Social" value={counts.social || 0} accent="emerald" />
          <KpiChip icon={Mail} label="Email / Push" value={counts.email || 0} accent="pink" />
          <KpiChip icon={CheckCircle2} label="Aplicadas" value={counts.total_aplicadas || 0} sub={`${counts.total_descartadas || 0} descartadas`} accent="amber" />
        </div>

        <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex whitespace-nowrap items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                tab === id ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/20' : 'border border-slate-200 bg-white text-slate-600 hover:border-fuchsia-200'
              }`}
            >
              <Icon size={14} />
              {label}
              {tab === 'all' && <span className="ml-1 text-[10px] opacity-70">{suggestions.length}</span>}
            </button>
          ))}
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
            {filtered.map((s) => (
              <SuggestionCard
                key={s.id}
                s={s}
                onAction={action}
                busy={busy}
                tiktokConnected={!!tiktok.connected}
                onTiktok={uploadTiktok}
              />
            ))}
          </div>
        ) : (
          <Card className="!rounded-2xl !border-fuchsia-100 !shadow-sm py-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-fuchsia-50 text-fuchsia-600">
              <Megaphone size={24} />
            </div>
            <p className="text-sm font-bold text-slate-800">Sin sugerencias en esta sección por ahora</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
              Pulsa <b>Analizar ahora</b> o espera al siguiente ciclo automático (cada 6 horas) para generar contenido nuevo.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Marketing;
