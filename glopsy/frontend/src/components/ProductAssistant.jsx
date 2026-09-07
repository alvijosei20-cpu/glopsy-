import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, X, Send, Sparkles, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useUserCity } from '../utils/location';
import { isLoggedIn } from '../utils/session';
import { trackEvent } from '../utils/analytics';

const QUICK_PROMPTS = [
  '¿Vale la pena comprarlo?',
  '¿Cuánto cuesta el envío?',
  'Recomiéndame algo similar',
  'Otros productos del mismo proveedor',
];

const MAX_CHARS = 300;
const BUDGET_DEFAULT = { limit: 3, used: 0, remaining: 3 };

// Extrae rutas /product/<id> o /listpr incluso dentro de URLs absolutas o markdown.
const TOKEN_RE = /\[([^\]]+)\]\(([^)\s]+)\)|\/product\/[A-Za-z0-9_-]{1,80}|\/listpr[^\s),.;:]*/g;

const pathFrom = (token) => {
  const mm = String(token || '').match(/(\/product\/[A-Za-z0-9_-]{1,80}|\/listpr[^\s),.;:]*)/);
  return mm ? mm[0] : null;
};

function inlineLine(line, keyBase, onLink) {
  const out = [];
  let last = 0;
  let m;
  let k = 0;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const mdLabel = m[1];
    const mdUrl = m[2];
    let path;
    let label;
    if (mdLabel && mdUrl) {
      path = pathFrom(mdUrl);
      label = mdLabel;
    } else {
      path = pathFrom(m[0]);
      label = path && path.startsWith('/listpr') ? 'Catálogo' : path ? path.replace('/product/', '') : m[0];
    }
    if (path) {
      out.push(
        <button
          key={`${keyBase}-l${k++}`}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onLink(path);
          }}
          className="inline text-fuchsia-700 font-bold underline decoration-fuchsia-300 underline-offset-2 hover:text-fuchsia-900 transition-colors cursor-pointer"
          title={path}
        >
          {label}
        </button>
      );
    } else {
      out.push(m[0]);
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

function RichText({ text, onLink }) {
  return (
    <span>
      {String(text || '').split('\n').map((line, i) => (
        <span key={i} className="block">
          {inlineLine(line, i, onLink)}
        </span>
      ))}
    </span>
  );
}

export default function ProductAssistant({ product }) {
  const navigate = useNavigate();
  const ciudad = useUserCity();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [budget, setBudget] = useState(BUDGET_DEFAULT);
  const bottomRef = useRef(null);

  const pid = String(product?.public_id || product?.id || '');
  const gaBase = {
    product_id: pid,
    product_name: product?.name || '',
    categoria: product?.categoria_nombre || product?.category || '',
  };

  const go = (path) => {
    trackEvent('asistente_enlace', {
      ...gaBase,
      destino: path && path.startsWith('/product') ? 'producto' : path && path.startsWith('/listpr') ? 'catalogo' : path,
    });
    setOpen(false);
    navigate(path);
  };

  const openChat = () => {
    trackEvent('asistente_abierto', gaBase);
    setOpen(true);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy, open]);

  const send = async (text) => {
    const clean = String(text || '').trim().slice(0, MAX_CHARS);
    if (!clean || busy || !pid) return;
    setError('');
    setInput('');
    trackEvent('asistente_pregunta', { ...gaBase, pregunta: clean.slice(0, 120) });
    const history = [...messages, { role: 'user', content: clean }];
    setMessages(history);
    setBusy(true);
    try {
      const { data } = await api.post(`/product/${pid}/assistant`, {
        messages: history.map((m) => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content })),
        ciudad,
      });
      if (data?.ok && data.reply) {
        setMessages((prev) => [...prev, { role: 'bot', content: data.reply, local: !!data.fallback }]);
        if (data.reply.includes('/listpr')) trackEvent('asistente_respuesta_catalogo', gaBase);
        if (/\/product\//.test(data.reply)) trackEvent('asistente_respuesta_producto', gaBase);
      } else {
        setError(data?.message || 'No obtuve respuesta. Intenta de nuevo.');
      }
      if (data?.budget) setBudget((prev) => ({ ...prev, ...data.budget }));
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible conectar con el asistente.');
    } finally {
      setBusy(false);
    }
  };

  // Solo disponible para usuarios logueados.
  if (!pid || !isLoggedIn()) return null;

  return (
    <>
      {/* Botón flotante */}
      {!open && (
        <button
          type="button"
          onClick={openChat}
          className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-bold pl-3.5 pr-4 py-3 rounded-full shadow-2xl shadow-fuchsia-600/40 transition-all hover:scale-105 active:scale-95"
          title="Pregúntale al asistente"
        >
          <Sparkles size={18} className="animate-pulse" />
          <span className="text-xs">Pregúntame</span>
        </button>
      )}

      {/* Modal con capa oscura translúcida */}
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Asistente GlopsyBot"
        >
          <div
            className="bg-white w-full sm:w-[400px] max-w-full sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col h-[82dvh] sm:h-[560px] sm:max-h-[90dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white px-4 py-3 flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Bot size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold leading-tight flex items-center gap-1.5">
                  GlopsyBot
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    <Sparkles size={9} /> IA
                  </span>
                </p>
                <p className="text-[11px] text-white/80 truncate">
                  Te ayudo con {product?.name || 'este producto'} y todo el catálogo
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors shrink-0"
                aria-label="Cerrar chat"
              >
                <X size={16} />
              </button>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3 bg-slate-50">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={14} />
                </div>
                <div className="bg-white border border-fuchsia-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-xs text-slate-700 leading-relaxed shadow-sm max-w-[85%]">
                  ¡Hola! 👋 Pregúntame sobre <b>{product?.name}</b>, pide sugerencias parecidas o de su mismo
                  proveedor. Puedo recomendarte productos con enlaces directos.
                </div>
              </div>

              {messages.length === 0 && !busy && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-fuchsia-200 text-fuchsia-700 text-[11px] font-semibold hover:bg-fuchsia-50 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex items-start gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
                  {m.role === 'bot' && (
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={14} />
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed max-w-[85%] ${
                      m.role === 'user'
                        ? 'bg-fuchsia-600 text-white rounded-tr-sm'
                        : 'bg-white border border-fuchsia-100 text-slate-700 rounded-tl-sm shadow-sm'
                    }`}
                  >
                    <RichText text={m.content} onLink={go} />
                    {m.role === 'bot' && m.local && (
                      <span className="mt-1.5 inline-block text-[9px] font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                        Respuesta básica
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={14} />
                  </div>
                  <div className="bg-white border border-fuchsia-100 rounded-2xl rounded-tl-sm px-3.5 py-3 shadow-sm inline-flex items-center gap-2">
                    <Loader2 size={13} className="animate-spin text-fuchsia-600" />
                    <span className="text-[11px] text-slate-500 font-medium">Consultando el catálogo…</span>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-[11px] font-semibold text-pink-600 bg-pink-50 border border-pink-200 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-fuchsia-100 p-2.5 bg-white shrink-0">
              {budget.remaining <= 0 && (
                <p className="text-center text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-2">
                  Consultas IA agotadas para este producto · sigo ayudándote con respuestas básicas 💬
                </p>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Escribe tu pregunta…"
                  maxLength={MAX_CHARS}
                  className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  aria-label="Enviar"
                >
                  <Send size={15} />
                </button>
              </form>
              <p className="text-[9px] text-slate-400 text-center mt-1.5 flex items-center justify-center gap-2">
                <span>{input.length}/{MAX_CHARS}</span>
                {budget.remaining > 0 ? (
                  <span>Consultas IA restantes: {budget.remaining}</span>
                ) : (
                  <span>Modo respuestas básicas</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
