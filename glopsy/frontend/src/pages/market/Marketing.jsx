import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Megaphone, Sparkles, Tag, Send, Mail, RefreshCw,
  CheckCircle2, XCircle, Clock, Search, Copy, ExternalLink, Pencil, Info,
  Loader2, X,
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

const BADGE_VARIANT = {
  seo: 'default', promo: 'warning', stock: 'warning', social: 'neutral', email: 'error',
  llm: 'default', rules: 'neutral', aplicada: 'success', descartada: 'neutral', pendiente: 'warning',
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

const FacebookIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" />
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

const SuggestionCard = ({ s, onAction, busy, fbConnected }) => {
  const [copied, setCopied] = useState(false);
  const [urlEditing, setUrlEditing] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [imgFailed, setImgFailed] = useState(false);
  const p = s.payload || {};
  const productName = s.product_name || (p.productName ? p.productName : null);
  const productImages = Array.isArray(s.product_images)
    ? s.product_images.map(firstSrc).filter(Boolean)
    : [];
  const imgSrc = productImages[0] || firstSrc(p.imagen) || '';
  const primaryImage = imgSrc && !imgFailed ? imgSrc : null;
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

  return (
    <Card className="!rounded-2xl !border-slate-200 !shadow-sm">
      <div className="flex items-start gap-3">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt=""
            onError={() => setImgFailed(true)}
            className="w-14 h-14 rounded-xl object-cover bg-slate-100 shrink-0"
          />
        ) : (
          <div className={`w-14 h-14 rounded-xl shrink-0 flex items-center justify-center ${
            s.tipo === 'promo'
              ? 'bg-gradient-to-br from-fuchsia-100 to-pink-100 text-fuchsia-600'
              : s.tipo === 'email'
                ? 'bg-sky-50 text-sky-500'
                : 'bg-fuchsia-50 text-fuchsia-600'
          }`}>
            {s.tipo === 'promo' ? (
              <Tag size={20} />
            ) : s.tipo === 'email' ? (
              <Send size={20} />
            ) : s.tipo === 'seo' ? (
              <Search size={20} />
            ) : (
              <Megaphone size={20} />
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant={BADGE_VARIANT[s.tipo] || 'neutral'}>{TIPO_LABEL[s.tipo] || s.tipo}</Badge>
            <Badge variant={s.fuente === 'llm' ? 'default' : 'neutral'}>
              {s.fuente === 'llm' ? <><Sparkles size={12} className="inline mr-1" />IA</> : 'Reglas'}
            </Badge>
            <Badge variant={s.estado === 'aplicada' ? 'success' : s.estado === 'descartada' ? 'neutral' : 'warning'}>{s.estado}</Badge>
            <span className="text-[11px] text-slate-400 ml-auto flex items-center gap-1 shrink-0">
              <Clock size={12} /> {RELATIVE(s.created_at)}
            </span>
          </div>
          <p className="text-sm font-bold text-slate-800 leading-snug">{s.titulo}</p>
          {productName && <p className="text-xs text-slate-500 mt-0.5 truncate">{productName}</p>}
          {s.tipo !== 'seo' && s.tipo !== 'promo' && s.detalle && (
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{s.detalle}</p>
          )}
          {(s.tipo === 'seo' || s.tipo === 'promo') && (
            <pre className="mt-2 text-[11px] text-slate-600 bg-slate-50 rounded-xl p-2.5 whitespace-pre-wrap font-sans leading-relaxed">
              {previewText}
            </pre>
          )}
          {isCopiable && s.tipo === 'social' && (
            <div className="mt-2 text-[11px] text-slate-600 bg-slate-50 rounded-xl p-2.5 whitespace-pre-wrap leading-relaxed">
              <p>{p.texto}</p>
              <p className="text-fuchsia-600 font-semibold mt-1">{p.hashtags}</p>
            </div>
          )}
          {isCopiable && s.tipo === 'email' && (
            <div className="mt-2 text-[11px] text-slate-600 bg-slate-50 rounded-xl p-2.5 leading-relaxed">
              <p className="font-bold">📣 {p.title}</p>
              <p className="mt-1 whitespace-pre-wrap">{p.body}</p>
              {p.audiencia && <p className="text-slate-400 mt-1">👥 {p.audiencia.buyers || 0} compradores · {p.audiencia.push_ready || 0} con push</p>}
              <div className="mt-2 pt-2 border-t border-slate-200/70">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-500">Al abrir la notificación</p>
                  {s.estado === 'pendiente' && !urlEditing && (
                    <button
                      onClick={() => { setUrlDraft(p.url || '/listpr'); setUrlEditing(true); }}
                      className="inline-flex items-center gap-1 text-fuchsia-600 font-semibold hover:text-fuchsia-700 transition-colors"
                    >
                      <Pencil size={11} /> Cambiar destino
                    </button>
                  )}
                </div>
                {urlEditing ? (
                  <div className="mt-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      {dests.map((d) => (
                        <button
                          key={d.url}
                          onClick={() => setUrlDraft(d.url)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold transition-colors ${
                            urlDraft === d.url
                              ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-fuchsia-300'
                          }`}
                          title={d.url}
                        >
                          <ExternalLink size={10} />
                          <span className="max-w-[110px] truncate">{d.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <input
                        value={urlDraft}
                        onChange={(e) => setUrlDraft(e.target.value)}
                        placeholder="/listpr, /product/abc, https://..."
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] text-slate-700 bg-white focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100"
                      />
                      <button
                        onClick={() => {
                          if (!urlDraft.trim() || busy) return;
                          onAction(s, 'url', urlDraft.trim());
                          setUrlEditing(false);
                        }}
                        disabled={busy || !urlDraft.trim()}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold disabled:opacity-60"
                      >
                        <CheckCircle2 size={12} /> Guardar
                      </button>
                      <button
                        onClick={() => setUrlEditing(false)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-semibold disabled:opacity-60"
                      >
                        <XCircle size={12} /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-fuchsia-700 font-medium truncate">{p.url || '/listpr'}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-100">
        {isCopiable && (
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            {copied ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Copiar texto'}
          </button>
        )}
        {fbConnected && s.tipo === 'social' && s.estado === 'pendiente' && (
          <button
            onClick={() => onAction(s, 'facebook')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-[#1877F2] text-white hover:bg-[#166FE5] transition-colors disabled:opacity-60"
          >
            <FacebookIcon size={14} /> Publicar en Facebook
          </button>
        )}
        {s.tipo === 'email' && s.estado !== 'aplicada' && (
          <button
            onClick={() => onAction(s, 'enviar')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-fuchsia-600 text-white hover:bg-fuchsia-700 transition-colors disabled:opacity-60"
          >
            <Send size={14} /> Enviar push
          </button>
        )}
        {s.tipo === 'social' && s.product_public_id && (
          <Link
            to={`/product/${s.product_public_id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <ExternalLink size={14} /> Ver producto
          </Link>
        )}
        {s.estado === 'pendiente' && (
          <>
            <button
              onClick={() => onAction(s, 'aplicar')}
              disabled={busy}
              className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              <CheckCircle2 size={14} />
              {s.tipo === 'promo' ? 'Crear promoción' : s.tipo === 'seo' ? 'Aplicar SEO' : s.tipo === 'email' ? 'Aplicar' : 'Marcar aplicada'}
            </button>
            <button
              onClick={() => onAction(s, 'descartar')}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-60"
            >
              <XCircle size={14} /> Descartar
            </button>
          </>
        )}
      </div>
    </Card>
  );
};

const FacebookConnectModal = ({ open, onClose, onConnected }) => {
  const [token, setToken] = useState('');
  const [step, setStep] = useState('token');
  const [owner, setOwner] = useState('');
  const [pages, setPages] = useState([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setToken('');
    setStep('token');
    setOwner('');
    setPages([]);
    setSelected('');
    setError('');
  }, [open]);

  if (!open) return null;

  const listPages = async () => {
    const t = token.trim();
    if (!t) {
      setError('Pega el token del system user de tu negocio.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/tienda/marketing/facebook/pages', { token: t });
      if (!data.ok) {
        setError(data.message || 'No se pudo validar el token.');
        return;
      }
      if (!data.pages?.length) {
        setError('No se encontraron páginas para este token. Verifica que el system user tenga tu página asignada con permiso para publicar contenido.');
        return;
      }
      setOwner(data.owner || 'Mi negocio');
      setPages(data.pages);
      setSelected(data.pages[0].id);
      setStep('pages');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron cargar tus páginas.');
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    if (!selected) {
      setError('Elige una página.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/tienda/marketing/facebook/connect', {
        token: token.trim(),
        pageId: selected,
      });
      if (!data.ok) {
        setError(data.message || 'No se pudo conectar.');
        return;
      }
      onConnected();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo conectar la página.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#1877F2]/10 text-[#1877F2] shrink-0">
              <FacebookIcon size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Conectar página de Facebook</h3>
              <p className="text-[11px] text-slate-500">La IA publicará los posts sociales en esta página.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {step === 'token' && (
          <>
            <label className="block text-center text-[11px] font-bold text-slate-500 mb-2">
              Pega el token del system user de tu negocio
            </label>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              rows={3}
              placeholder="EAA..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 font-mono text-center placeholder:text-slate-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed text-center">
              Meta for Developers → tu app → Marketing API → System User (o Configuración del negocio).
              El system user debe tener tu página asignada con un rol que permita publicar contenido.
            </p>
            <button
              onClick={listPages}
              disabled={busy}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] text-white text-xs font-bold px-4 py-2.5 hover:bg-[#166FE5] transition-colors disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Buscar mis páginas
            </button>
          </>
        )}

        {step === 'pages' && (
          <>
            <p className="text-[11px] text-slate-500 mb-3 text-center">
              <b className="text-slate-700">{owner}</b> — elige la página donde publicar:
            </p>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {pages.map((pg) => (
                <button
                  key={pg.id}
                  onClick={() => setSelected(pg.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                    selected === pg.id
                      ? 'border-[#1877F2] bg-[#1877F2]/5 ring-2 ring-[#1877F2]/15'
                      : 'border-slate-200 hover:border-blue-200'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white ${
                      selected === pg.id ? 'bg-[#1877F2]' : 'bg-slate-300'
                    }`}
                  >
                    {(pg.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{pg.name}</p>
                    <p className="text-[10px] text-slate-400">Publicar como página</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setStep('token')}
                disabled={busy}
                className="flex-1 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold px-4 py-2.5 hover:bg-slate-200 transition-colors disabled:opacity-60"
              >
                Volver
              </button>
              <button
                onClick={connect}
                disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] text-white text-xs font-bold px-4 py-2.5 hover:bg-[#166FE5] transition-colors disabled:opacity-60"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Conectar
              </button>
            </div>
          </>
        )}

        {error && (
          <p className="mt-3 bg-pink-50 border border-pink-200 text-pink-700 rounded-xl px-3 py-2 text-[11px] font-semibold" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
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
  const [fbModal, setFbModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ovRes, sugRes] = await Promise.all([
        api.get('/tienda/marketing'),
        api.get('/tienda/marketing/sugerencias', { params: { limit: 60 } }),
      ]);
      if (ovRes.data.ok) setOverview(ovRes.data);
      if (sugRes.data.ok) setSuggestions(sugRes.data.suggestions || []);
    } catch {
      setError('No se pudieron cargar los datos de marketing.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const disconnectFb = async () => {
    if (!window.confirm('¿Desconectar la página de Facebook? Ya no podrás publicar desde aquí.')) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.delete('/tienda/marketing/facebook');
      if (data.ok) {
        setNotice(data.message || 'Página desconectada.');
        await load();
      } else {
        setError(data.message || 'No se pudo desconectar la página.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo desconectar la página.');
    } finally {
      setBusy(false);
    }
  };

  const counts = overview?.summary || {};
  const filtered = tab === 'all' ? suggestions : suggestions.filter((s) => s.tipo === tab);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-fuchsia-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando marketing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      <div className="bg-white border-b border-fuchsia-100 shadow-sm py-3 px-4 sm:px-8 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/market')}
            className="flex items-center gap-2 text-slate-600 hover:text-fuchsia-600 text-sm font-semibold transition-colors shrink-0"
          >
            <ArrowLeft size={18} />
            <span>Mi tienda</span>
          </button>
          <div className="flex items-center gap-2 text-fuchsia-800 text-xs sm:text-sm font-medium bg-fuchsia-50 px-3 py-1.5 rounded-xl border border-fuchsia-100">
            <Megaphone size={16} className="text-fuchsia-600 shrink-0" />
            <span className="hidden sm:inline">Asistente de Marketing</span>
            <span className="sm:hidden">Marketing</span>
            {overview?.llm?.enabled ? (
              <Badge variant="default" className="!text-[10px]"><Sparkles size={10} className="inline mr-1" />IA activa</Badge>
            ) : (
              <Badge variant="neutral" className="!text-[10px]">IA sin API key</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-950">Marketing</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Tu asistente analiza el catálogo y genera acciones: SEO, promociones, contenido social y campañas. Se actualiza automáticamente cada 6 horas.
            </p>
          </div>
          <button
            onClick={runAnalysis}
            disabled={running}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold px-5 py-3 rounded-2xl shadow-md shadow-fuchsia-600/20 text-sm disabled:opacity-60"
          >
            <RefreshCw size={16} className={running ? 'animate-spin' : ''} />
            {running ? 'Analizando...' : 'Analizar ahora'}
          </button>
        </div>

        <div className="mb-5 bg-slate-100/80 border border-slate-200 rounded-2xl px-4 py-3.5 text-xs text-slate-600">
          <div className="flex items-center gap-2 mb-2">
            <Info size={14} className="text-fuchsia-600 shrink-0" />
            <p className="font-bold text-slate-800">Cómo funciona el contenido social</p>
          </div>
          <ul className="space-y-1 pl-5 list-disc marker:text-slate-300">
            <li>La IA <b>redacta el post</b> (texto, hashtags y foto del producto). Si conectas tu página de Facebook, publícalo con un clic en <b>“Publicar en Facebook”</b>; si no, cópialo con <b>“Copiar texto”</b> para Instagram u otras redes.</li>
            <li>Se genera solo cada <b>6 horas</b> (ciclo automático) o cuando pulsas <b>Analizar ahora</b>.</li>
            <li>Por ciclo genera hasta <b>3 posts</b>, de los productos con ventas recientes.</li>
            <li>Máximo <b>1 post por producto por día</b>.</li>
            <li><b>“Marcar aplicada”</b> es solo tu registro interno de que ya lo publicaste.</li>
          </ul>
        </div>

        {overview?.facebook?.connected ? (
          <div className="mb-5 rounded-2xl border border-[#1877F2]/25 bg-gradient-to-br from-[#1877F2]/8 to-white px-5 py-4 flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left">
            <div className="w-11 h-11 rounded-xl bg-[#1877F2] text-white flex items-center justify-center shadow-md shadow-[#1877F2]/25 mb-2.5 sm:mb-0 shrink-0">
              <FacebookIcon size={18} />
            </div>
            <div className="min-w-0 sm:mx-4 flex-1">
              <p className="text-sm font-bold text-slate-900">
                Conectado a <span className="text-[#1877F2]">{overview.facebook.fb_page_name}</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Los posts sociales tendrán el botón “Publicar en Facebook”.</p>
            </div>
            <button
              onClick={disconnectFb}
              disabled={busy}
              className="mt-3 sm:mt-0 inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-white text-slate-600 border border-slate-200 hover:border-pink-300 hover:text-pink-600 transition-colors disabled:opacity-60 shrink-0"
            >
              <XCircle size={13} /> Desconectar
            </button>
          </div>
        ) : (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-sm px-5 pt-7 pb-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#1877F2] text-white flex items-center justify-center shadow-md shadow-[#1877F2]/30 mb-3">
              <FacebookIcon size={20} />
            </div>
            <p className="text-sm font-extrabold text-slate-900">
              Publica los posts de la IA en tu página de Facebook
            </p>
            <p className="text-[11px] text-slate-500 max-w-xs mt-1 leading-relaxed">
              Conecta tu página una sola vez y cada post social tendrá el botón para publicarlo con un clic.
            </p>
            <button
              onClick={() => setFbModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1877F2] text-white text-xs font-bold px-4 py-2.5 hover:bg-[#166FE5] transition-colors shadow-sm shadow-[#1877F2]/25"
            >
              <FacebookIcon size={14} /> Conectar página de Facebook
            </button>
          </div>
        )}

        <FacebookConnectModal
          open={fbModal}
          onClose={() => setFbModal(false)}
          onConnected={() => {
            setNotice('Página conectada. Ya puedes publicar los posts con IA.');
            load();
          }}
        />

        {runResult && (
          <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl px-4 py-3 text-xs font-medium">
            Resultado del análisis: {runResult.seo || 0} SEO · {runResult.promo || 0} promociones · {runResult.social || 0} social · {runResult.email || 0} email · {runResult.stock || 0} stock.
          </div>
        )}
        {notice && <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl px-4 py-3 text-xs font-medium" role="status">{notice}</div>}
        {error && <div className="mb-5 bg-pink-50 border border-pink-200 text-pink-700 rounded-2xl px-4 py-3 text-xs font-semibold" role="alert">{error}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <KpiChip icon={Sparkles} label="SEO pendientes" value={counts.seo || 0} accent="violet" />
          <KpiChip icon={Tag} label="Promociones" value={counts.promo || 0} accent="fuchsia" />
          <KpiChip icon={Megaphone} label="Social" value={counts.social || 0} accent="emerald" />
          <KpiChip icon={Mail} label="Email / Push" value={counts.email || 0} accent="pink" />
          <KpiChip icon={CheckCircle2} label="Aplicadas" value={counts.total_aplicadas || 0} sub={`${counts.total_descartadas || 0} descartadas`} accent="amber" />
        </div>

        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                tab === id ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/20' : 'bg-white text-slate-600 border border-slate-200 hover:border-fuchsia-200'
              }`}
            >
              <Icon size={14} />
              {label}
              {tab === 'all' && (
                <span className="ml-1 text-[10px] opacity-70">{suggestions.length}</span>
              )}
            </button>
          ))}
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filtered.map((s) => (
              <SuggestionCard
                key={s.id}
                s={s}
                onAction={action}
                busy={busy}
                fbConnected={!!overview?.facebook?.connected}
              />
            ))}
          </div>
        ) : (
          <Card className="!rounded-2xl !border-fuchsia-100 !shadow-sm text-center py-14">
            <div className="w-14 h-14 bg-fuchsia-50 text-fuchsia-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Megaphone size={24} />
            </div>
            <p className="text-sm font-bold text-slate-800">Sin sugerencias en esta sección por ahora</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Pulsa <b>Analizar ahora</b> o espera al siguiente ciclo automático (cada 6 horas) para generar contenido nuevo.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Marketing;
