import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Megaphone, Sparkles, Tag, Send, Mail, RefreshCw,
  CheckCircle2, XCircle, Clock, Search, Copy, ExternalLink, Pencil, Info,
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

const SuggestionCard = ({ s, onAction, busy }) => {
  const [copied, setCopied] = useState(false);
  const [urlEditing, setUrlEditing] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const p = s.payload || {};
  const productName = s.product_name || (p.productName ? p.productName : null);
  const primaryImage = s.product_images?.length ? s.product_images[0] : null;
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
          <img src={primaryImage} alt="" className="w-14 h-14 rounded-xl object-cover bg-slate-100 shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center shrink-0">
            <Megaphone size={20} />
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
            <li>La IA <b>no publica en tus redes</b>: solo redacta el post (texto, hashtags y foto del producto). Copia el texto con <b>“Copiar texto”</b> y publícalo tú en Instagram, Facebook, etc.</li>
            <li>Se genera solo cada <b>6 horas</b> (ciclo automático) o cuando pulsas <b>Analizar ahora</b>.</li>
            <li>Por ciclo genera hasta <b>3 posts</b>, de los productos con ventas recientes.</li>
            <li>Máximo <b>1 post por producto por día</b>.</li>
            <li><b>“Marcar aplicada”</b> es solo tu registro interno de que ya lo publicaste.</li>
          </ul>
        </div>

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
              <SuggestionCard key={s.id} s={s} onAction={action} busy={busy} />
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
