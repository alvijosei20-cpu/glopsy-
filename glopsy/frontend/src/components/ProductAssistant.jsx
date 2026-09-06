import { useEffect, useRef, useState } from 'react';
import { Bot, X, Send, Sparkles, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useUserCity } from '../utils/location';

const QUICK_PROMPTS = [
  '¿Vale la pena comprarlo?',
  '¿Cuánto cuesta el envío?',
  'Recomiéndame algo similar',
  '¿Está en stock?',
];

export default function ProductAssistant({ product }) {
  const ciudad = useUserCity();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  const pid = String(product?.public_id || product?.id || '');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy, open]);

  const send = async (text) => {
    const clean = String(text || '').trim().slice(0, 400);
    if (!clean || busy || !pid) return;
    setError('');
    setInput('');
    const history = [...messages, { role: 'user', content: clean }];
    setMessages(history);
    setBusy(true);
    try {
      const { data } = await api.post(`/product/${pid}/assistant`, {
        messages: history.map((m) => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content })),
        ciudad,
      });
      if (data?.ok && data.reply) {
        setMessages((prev) => [...prev, { role: 'bot', content: data.reply }]);
      } else {
        setError(data?.message || 'No obtuve respuesta. Intenta de nuevo.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible conectar con el asistente.');
    } finally {
      setBusy(false);
    }
  };

  if (!pid) return null;

  return (
    <>
      {/* Botón flotante */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-bold pl-3.5 pr-4 py-3 rounded-full shadow-2xl shadow-fuchsia-600/40 transition-all hover:scale-105 active:scale-95"
          title="Pregúntale al asistente"
        >
          <Sparkles size={18} className="animate-pulse" />
          <span className="text-xs">Pregúntame</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-0 right-0 sm:bottom-5 sm:right-5 z-50 w-full sm:w-96 flex flex-col bg-white border border-fuchsia-100 shadow-2xl sm:rounded-2xl overflow-hidden h-[75dvh] sm:h-[560px] max-h-[85dvh]">
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
                ¡Hola! 👋 Soy el asistente con IA de Glopsy. Pregúntame sobre{' '}
                <b>{product?.name}</b>, stock, precios o pide recomendaciones de todo el catálogo.
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
              <div
                key={i}
                className={`flex items-start gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}
              >
                {m.role === 'bot' && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={14} />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap max-w-[85%] ${
                    m.role === 'user'
                      ? 'bg-fuchsia-600 text-white rounded-tr-sm'
                      : 'bg-white border border-fuchsia-100 text-slate-700 rounded-tl-sm shadow-sm'
                  }`}
                >
                  {m.content}
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
                maxLength={400}
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
            <p className="text-[9px] text-slate-400 text-center mt-1.5">
              Respuestas generadas por IA. Pueden tener errores: verifica precios y stock antes de comprar.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
