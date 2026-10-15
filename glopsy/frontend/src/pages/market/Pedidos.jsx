import { useState, useEffect } from 'react';
import { Package, Truck, ChevronDown, Loader2, ExternalLink, MapPin, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { useMoney } from '../../utils/money';

const STATUS_BADGE = (st) => {
  const s = String(st || '').toLowerCase();
  if (s.includes('deliver') || s.includes('entregad')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s.includes('cancel') || s.includes('rechaz') || s.includes('fail')) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (s.includes('transit') || s.includes('shipped') || s.includes('guia') || s.includes('route')) return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

export default function Pedidos() {
  const { format: formatPrice } = useMoney();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [tracking, setTracking] = useState({}); // ref -> shipments[]
  const [trackingLoading, setTrackingLoading] = useState(null);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const { data } = await api.get('/tienda/orders?limit=50');
      if (data?.ok) setOrders(data.orders || []);
    } catch (e) {
      setErr(e.response?.data?.message || 'No se pudieron cargar los pedidos.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const track = async (order) => {
    const ref = order.order_hash || order.order_number || order.id;
    setTrackingLoading(order.id);
    try {
      const { data } = await api.get(`/tienda/orders/${ref}/tracking`);
      if (data?.ok) setTracking((prev) => ({ ...prev, [order.id]: data.shipments || [] }));
      else setErr(data?.reason || 'No se pudo rastrear.');
    } catch (e) {
      setErr(e.response?.data?.message || 'No se pudo rastrear.');
    } finally { setTrackingLoading(null); }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white flex items-center justify-center"><Package size={22} /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Pedidos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Tus ventas y el rastreo de cada envío.</p>
        </div>
        <button type="button" onClick={load} className="text-slate-400 hover:text-slate-700"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      {err && <p className="text-xs text-rose-600 mb-3">{err}</p>}

      {loading ? (
        <p className="text-sm text-slate-500 py-8 text-center"><Loader2 className="inline animate-spin" size={16} /> Cargando…</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">Aún no tienes pedidos.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const isOpen = open === o.id;
            const ships = o.shipments || [];
            return (
              <div key={o.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : o.id)}
                  className="w-full flex flex-wrap items-center gap-3 p-4 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white">Pedido #{o.order_number || o.id}</p>
                    <p className="text-xs text-slate-500">{o.customer_name || 'Cliente'} · {new Date(o.created_at).toLocaleDateString('es-CO', { dateStyle: 'medium' })}</p>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS_BADGE(o.status)}`}>{o.status}</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">{formatPrice(o.amount)}</span>
                  <ChevronDown size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-zinc-800 pt-3">
                    {o.direccion && <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={12} /> {o.direccion}</p>}
                    {ships.length === 0 ? <p className="text-xs text-slate-400">Sin envíos.</p> : ships.map((s) => {
                      const live = (tracking[o.id] || []).find((x) => x.tracking_code && x.tracking_code === s.tracking_code)?.tracking;
                      return (
                        <div key={s.id} className="rounded-xl border border-slate-200 dark:border-zinc-700 p-3 space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Truck size={13} className="text-fuchsia-600" />
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Envío #{s.shipment_number}</span>
                            <span className="text-slate-500">{s.carrier} {s.service ? `(${s.service})` : ''}</span>
                            <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE(s.fulfillment_status)}`}>{s.fulfillment_status}</span>
                          </div>
                          {s.tracking_code && (
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              <span className="font-mono bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">Guía: {s.tracking_code}</span>
                              <button type="button" onClick={() => track(o)} disabled={trackingLoading === o.id} className="text-fuchsia-600 font-semibold hover:underline disabled:opacity-50">
                                {trackingLoading === o.id ? 'Rastreando…' : 'Rastrear'}
                              </button>
                            </div>
                          )}
                          {live && (
                            <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/60 p-2.5 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: live.status_color || '#7e22ce' }}>{live.status || '—'}</span>
                                {live.estimated_delivery && <span className="text-[11px] text-slate-500 ml-auto">ETA: {String(live.estimated_delivery).slice(0, 16)}</span>}
                              </div>
                              {(live.track_url_site || live.track_url) && (
                                <a href={live.track_url_site || live.track_url} target="_blank" rel="noreferrer" className="text-[11px] text-fuchsia-600 hover:underline inline-flex items-center gap-1">
                                  Ver en el transportador <ExternalLink size={11} />
                                </a>
                              )}
                              {Array.isArray(live.events) && live.events.length > 0 && (
                                <ol className="border-l-2 border-fuchsia-200 ml-1.5 pl-3 space-y-1">
                                  {live.events.slice(0, 6).map((ev, i) => (
                                    <li key={i} className="text-[11px] text-slate-600 dark:text-slate-300">
                                      <span className="font-semibold">{ev.status || ev.name || 'Evento'}</span>
                                      {(ev.date || ev.datetime || ev.createdAt) && <span className="text-slate-400"> · {String(ev.date || ev.datetime || ev.createdAt).slice(0, 16)}</span>}
                                    </li>
                                  ))}
                                </ol>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
