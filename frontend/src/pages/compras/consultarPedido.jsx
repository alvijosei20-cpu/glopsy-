import React, { useState } from 'react';
import { Package, Search, Clock, CheckCircle, ChevronRight, Sparkles, User, FileText } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';

export default function ConsultarPedido() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) {
      setErrorMsg('Por favor ingresa un número de pedido o documento de identidad.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get(`/product/compras/buscar?q=${encodeURIComponent(query.trim())}`);
      if (res.data.ok) {
        setOrders(res.data.products || []);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error('Error buscando pedido:', err);
      setOrders([]);
      setErrorMsg('Ocurrió un error al realizar la búsqueda.');
    } finally {
      setLoading(false);
    }
  };

  const getProductImage = (p) => {
    try {
      if (p.image && typeof p.image === 'string' && p.image.startsWith('http')) return p.image;
      if (Array.isArray(p.images) && p.images.length > 0) {
        const first = p.images[0];
        if (typeof first === 'string') return first;
        if (first?.src) return first.src;
      }
      if (typeof p.images === 'string') {
        const parsed = JSON.parse(p.images);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const first = parsed[0];
          if (typeof first === 'string') return first;
          if (first?.src) return first.src;
        }
        if (typeof parsed === 'string') return parsed;
      }
    } catch {}
    return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60';
  };

  const formatPrice = (val) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(val || 0));

  const getStatusBadge = (st) => {
    const s = (st || '').toLowerCase();
    if (s.includes('approved') || s.includes('completado') || s.includes('aprobada')) {
      return { label: 'Aprobada', bg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
    }
    if (s.includes('pending') || s.includes('pendiente')) {
      return { label: 'Pendiente', bg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
    }
    if (s.includes('in_process') || s.includes('proceso')) {
      return { label: 'En proceso', bg: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
    }
    if (s.includes('cancelled') || s.includes('cancelada')) {
      return { label: 'Cancelada', bg: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' };
    }
    return { label: st || 'Aprobada', bg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 min-h-[85vh]">
      <div className="text-center max-w-xl mx-auto mb-10">
        <div className="w-16 h-16 bg-fuchsia-50 dark:bg-fuchsia-950/50 text-fuchsia-600 dark:text-fuchsia-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
          <Package size={32} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Consultar Estado de Pedido
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
          Busca fácilmente tu compra ingresando tu <strong>Número de Pedido</strong> (ej. 100001) o tu <strong>Número de Documento de Identidad</strong> del titular.
        </p>
      </div>

      <form onSubmit={handleSearch} className="max-w-lg mx-auto mb-10">
        <div className="flex gap-2 p-1.5 bg-white dark:bg-zinc-900 rounded-2xl border border-fuchsia-200/80 dark:border-zinc-800 shadow-md">
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-4 text-slate-400" size={20} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Número de pedido o documento..."
              className="w-full pl-12 pr-4 py-3 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none text-sm font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md shadow-fuchsia-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {errorMsg && <p className="text-rose-600 dark:text-rose-400 text-xs mt-2 text-center font-medium">{errorMsg}</p>}
      </form>

      {searched && !loading && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">
            Resultados de búsqueda ({orders.length})
          </h2>
          {orders.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-8">
              <FileText className="mx-auto text-slate-400 mb-3" size={36} />
              <p className="text-slate-700 dark:text-slate-300 font-semibold text-base mb-1">No se encontraron pedidos</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto">
                Verifica que el número de pedido o documento de identidad sean correctos e intenta nuevamente.
              </p>
            </div>
          ) : (
            orders.map((order) => {
              const dateStr = order.created_at ? new Date(order.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Reciente';
              const statusInfo = getStatusBadge(order.status);
              return (
                <div
                  key={order.id}
                  onClick={() => navigate(`/compras/${order.order_hash}`)}
                  className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:border-fuchsia-300 dark:hover:border-fuchsia-700 p-5 shadow-xs hover:shadow-md transition-all duration-300 space-y-4 cursor-pointer group"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 bg-fuchsia-50 dark:bg-fuchsia-950/50 text-fuchsia-600 dark:text-fuchsia-400 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner">
                        <Package size={20} />
                      </span>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                          Pedido #{order.order_number || order.id}
                          <ChevronRight size={16} className="text-slate-400 group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-400 transition-transform group-hover:translate-x-0.5" />
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1"><Clock size={12} /> {dateStr}</span>
                          {order.identification_number && (
                            <span className="flex items-center gap-1"><User size={12} /> Doc: {order.identification_number}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`${statusInfo.bg} text-xs font-semibold px-3 py-1 rounded-full border flex items-center gap-1`}>
                      <CheckCircle size={12} /> {statusInfo.label}
                    </span>
                  </div>

                  {/* Items preview */}
                  <div className="space-y-2">
                    {order.items && order.items.map((item, idx) => {
                      const itemImage = getProductImage(item);
                      return (
                        <div key={idx} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-700/50">
                          <img src={itemImage} alt={item.product_name} className="w-10 h-10 rounded-lg object-cover border" />
                          <div className="flex-1 min-w-0 text-left">
                            <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm truncate">{item.product_name}</h4>
                            <p className="text-[11px] text-slate-500">Cantidad: {item.quantity}</p>
                          </div>
                          <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                            {formatPrice(order.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
