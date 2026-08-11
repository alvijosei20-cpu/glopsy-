import React, { useState, useEffect } from 'react';
import { ShoppingBag, ArrowLeft, Package, MapPin, Sparkles, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { SkeletonList } from '../../components/SkeletonLoader';

export default function Compras() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const fetchCompras = async () => {
      try {
        const guestHash = localStorage.getItem('glopsy_guest_hash');
        const res = await api.get('/product/compras', {
          headers: guestHash ? { 'x-guest-hash': guestHash } : {}
        });
        if (res.data.ok) {
          setProducts(res.data.products || []);
        }
      } catch (err) {
        console.error('Error al cargar compras:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCompras();
  }, []);

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

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="h-10 bg-slate-200 dark:bg-zinc-800 rounded-xl w-1/3 animate-pulse"></div>
        <SkeletonList count={4} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative min-h-[80vh]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <Package className="text-fuchsia-600 dark:text-fuchsia-400 animate-bounce" size={30} />
            Mis Compras
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm sm:text-base">
            Historial de tus pedidos y productos adquiridos con éxito.
          </p>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in border border-slate-700">
          <Sparkles className="text-fuchsia-400" size={18} />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {products.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-3xl border border-fuchsia-100/60 dark:border-zinc-800 shadow-sm p-8">
          <div className="w-16 h-16 bg-fuchsia-50 dark:bg-fuchsia-950/50 text-fuchsia-500 dark:text-fuchsia-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <ShoppingBag size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No tienes compras realizadas</h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6 text-sm">
            Cuando realices pedidos y se procesen los pagos, aparecerán aquí con todo su detalle.
          </p>
          <Link
            to="/listpr"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white px-6 py-3 rounded-xl font-medium shadow-md shadow-fuchsia-600/20 hover:from-fuchsia-500 hover:to-pink-500 transition-all text-sm"
          >
            <ShoppingBag size={18} />
            Ver Catálogo
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((order, index) => {
            const dateStr = order.created_at ? new Date(order.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Reciente';
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

            const statusInfo = getStatusBadge(order.status);

            return (
              <div
                key={order.id || index}
                onClick={() => navigate(`/compras/${order.order_hash}`)}
                className="bg-slate-50 dark:bg-zinc-900/90 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:border-fuchsia-300 dark:hover:border-fuchsia-700 p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-300 space-y-3 cursor-pointer group"
              >
                {/* Order Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 bg-fuchsia-50 dark:bg-fuchsia-950/50 text-fuchsia-600 dark:text-fuchsia-400 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner">
                      <Package size={20} />
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-1.5">
                        Pedido #{order.id}
                        <ChevronRight size={16} className="text-slate-400 group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-400 transition-transform group-hover:translate-x-0.5" />
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock size={12} /> {dateStr}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Order Items - Minimalist Horizontal Row */}
                <div className="space-y-2">
                  {order.items && order.items.map((item, iIdx) => {
                    const itemImage = getProductImage(item);
                    return (
                      <div
                        key={item.id || iIdx}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/product/${item.public_id || item.product_id}`);
                        }}
                        className="flex items-center gap-3.5 p-2 rounded-xl bg-white dark:bg-zinc-800/80 hover:bg-slate-100/80 dark:hover:bg-zinc-800 transition-colors cursor-pointer border border-slate-200/60 dark:border-zinc-700/50"
                      >
                        <div className="w-12 h-12 bg-white dark:bg-zinc-900 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-zinc-700">
                          <img
                            src={itemImage}
                            alt={item.product_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60';
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm truncate">{item.product_name}</h4>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            <span>Cant: {item.quantity}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`${statusInfo.bg} text-xs font-semibold px-3 py-1 rounded-full border flex items-center gap-1`}>
                            <CheckCircle size={12} /> {statusInfo.label}
                          </span>
                          <span className="font-extrabold text-slate-900 dark:text-white text-base">
                            {formatPrice(order.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
