import React, { useState, useEffect } from 'react';
import { Package, ArrowLeft, MapPin, Clock, CheckCircle, Truck, Phone, XCircle, Sparkles, ChevronDown } from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function CompraDetail() {
  const { hash } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [collapsed, setCollapsed] = useState(true);
  const [editingAddr, setEditingAddr] = useState(false);
  const [newDireccion, setNewDireccion] = useState('');
  const [newTelefono, setNewTelefono] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const guestHash = localStorage.getItem('glopsy_guest_hash');
        const res = await api.get(`/product/compras/hash/${hash}`, {
          headers: guestHash ? { 'x-guest-hash': guestHash } : {}
        });
        if (res.data.ok && res.data.product) {
          const found = res.data.product;
          setOrder(found);
          setNewDireccion(found.direccion || '');
          setNewTelefono(found.telefono || '');
        }
      } catch (err) {
        console.error('Error al cargar detalle de orden:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [hash]);

  const addNotification = (title) => {
    try {
      const existing = JSON.parse(localStorage.getItem('glopsy_notifications') || '[]');
      const newNotif = { id: Date.now(), title, time: 'Hace un momento', read: false };
      const updated = [newNotif, ...existing];
      localStorage.setItem('glopsy_notifications', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('glopsy_notification', { detail: newNotif }));

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Glopsy - Pedido', { body: title });
      }
    } catch {}
  };

  const handleCancelOrder = async () => {
    if (!user) {
      alert('Debes iniciar sesión para cancelar el pedido.');
      navigate('/login');
      return;
    }
    if (!window.confirm('¿Estás seguro de que deseas cancelar este pedido?')) return;
    setCancelling(true);
    try {
      const guestHash = localStorage.getItem('glopsy_guest_hash');
      const res = await api.patch(`/product/compras/${hash}/cancel`, {}, {
        headers: guestHash ? { 'x-guest-hash': guestHash } : {}
      });
      if (res.data.ok) {
        setOrder(prev => ({ ...prev, status: 'cancelled' }));
        setToastMessage('Pedido cancelado exitosamente');
        setTimeout(() => setToastMessage(''), 3000);
        addNotification(`Tu pedido ha sido cancelado exitosamente.`);
      }
    } catch (err) {
      console.error('Error al cancelar pedido:', err);
      alert(err.response?.data?.message || 'Error al cancelar el pedido');
    } finally {
      setCancelling(false);
    }
  };

  const handleUpdateAddress = async () => {
    if (!user) {
      alert('Debes iniciar sesión para modificar la dirección del pedido.');
      navigate('/login');
      return;
    }
    if (newTelefono && !/^3\d{9}$/.test(newTelefono)) {
      alert('El número móvil debe tener 10 dígitos y empezar por 3 (Ej. 3001234567).');
      return;
    }
    try {
      const guestHash = localStorage.getItem('glopsy_guest_hash');
      const res = await api.patch(`/product/compras/${hash}/address`, {
        direccion: newDireccion,
        telefono: newTelefono
      }, {
        headers: guestHash ? { 'x-guest-hash': guestHash } : {}
      });
      if (res.data.ok) {
        setOrder(prev => ({ ...prev, direccion: newDireccion, telefono: newTelefono }));
        setEditingAddr(false);
        setToastMessage('Dirección actualizada con éxito');
        setTimeout(() => setToastMessage(''), 3000);
      }
    } catch (err) {
      console.error('Error al actualizar dirección:', err);
      alert(err.response?.data?.message || 'Error al actualizar la dirección');
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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <div className="h-8 bg-slate-200 dark:bg-zinc-800 rounded-xl w-1/4 animate-pulse"></div>
        <div className="h-64 bg-slate-100 dark:bg-zinc-900 rounded-3xl animate-pulse"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Orden no encontrada</h2>
        <Link to="/compras" className="inline-flex items-center gap-2 text-fuchsia-600 dark:text-fuchsia-400 font-medium">
          <ArrowLeft size={16} /> Volver a Mis Compras
        </Link>
      </div>
    );
  }

  const statusInfo = getStatusBadge(order.status);
  const dateStr = order.created_at ? new Date(order.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Reciente';
  const userName = order.customer_name || 'Cliente';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 relative min-h-[80vh]">
      <div className="flex items-center justify-between">
        <Link
          to="/compras"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-fuchsia-600 dark:hover:text-fuchsia-400 transition-colors"
        >
          <ArrowLeft size={16} /> Volver a Mis Compras
        </Link>
        <span className={`${statusInfo.bg} text-xs font-semibold px-3 py-1.5 rounded-full border flex items-center gap-1.5`}>
          <CheckCircle size={14} /> {statusInfo.label}
        </span>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in border border-slate-700">
          <Sparkles className="text-fuchsia-400" size={18} />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header Card (Collapsible by default, toggle by clicking container) */}
      <div 
        onClick={() => setCollapsed(!collapsed)}
        className="bg-slate-50 dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm relative overflow-hidden transition-all duration-300 cursor-pointer select-none"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/70 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-fuchsia-50 dark:bg-fuchsia-950/50 text-fuchsia-600 dark:text-fuchsia-400 rounded-2xl flex items-center justify-center font-bold shadow-inner">
              <Package size={24} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Detalles del pedido
                <ChevronDown size={18} className={`transition-transform duration-300 text-slate-500 dark:text-slate-400 ${collapsed ? '-rotate-90' : 'rotate-0'}`} />
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                <Clock size={12} /> {dateStr}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Total del Pedido</span>
              <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                {formatPrice(order.amount)}
              </span>
            </div>
          </div>
        </div>

        {/* Collapsible Content with Fade effect */}
        <div 
          onClick={(e) => e.stopPropagation()}
          className={`transition-all duration-500 ease-in-out relative ${collapsed ? 'max-h-0 opacity-0 overflow-hidden mt-0' : 'max-h-[600px] opacity-100 mt-4 space-y-4'}`}
        >
          {/* Shipping Address Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <MapPin size={16} className="text-fuchsia-600 dark:text-fuchsia-400" /> Dirección de Envío
              </h3>
              <button
                onClick={() => setEditingAddr(!editingAddr)}
                className="text-xs font-semibold text-fuchsia-600 dark:text-fuchsia-400 hover:underline cursor-pointer bg-fuchsia-50 dark:bg-fuchsia-950/40 px-3 py-1 rounded-lg border border-fuchsia-200/50 dark:border-fuchsia-900/40"
              >
                {editingAddr ? 'Cancelar' : 'Editar dirección'}
              </button>
            </div>

            {editingAddr ? (
              <div className="bg-white dark:bg-zinc-800/90 rounded-2xl p-4 border border-fuchsia-200 dark:border-zinc-700 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Dirección</label>
                  <input
                    type="text"
                    placeholder="Calle / Carrera / Transversal / Diagonal # N° - N° (Ej. Calle 100 # 15-20, Apto 301)"
                    value={newDireccion}
                    onChange={(e) => setNewDireccion(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Teléfono móvil</label>
                  <input
                    type="tel"
                    placeholder="Celular (Ej. 3001234567 - 10 dígitos)"
                    value={newTelefono}
                    onChange={(e) => setNewTelefono(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={handleUpdateAddress}
                    className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer shadow-xs"
                  >
                    Guardar cambios
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-800/80 rounded-2xl p-4 border border-slate-200/70 dark:border-zinc-700/60 text-xs sm:text-sm space-y-1.5">
                <div className="font-semibold text-slate-900 dark:text-white">
                  {userName}
                </div>
                <div className="text-slate-700 dark:text-slate-300">
                  {order.direccion || 'Dirección no especificada'}
                </div>
                {order.telefono && (
                  <div className="text-slate-500 dark:text-slate-400">
                    Tel: {order.telefono}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Fade gradient overlay when collapsing */}
        {collapsed && (
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-slate-50 dark:from-zinc-900 to-transparent pointer-events-none" />
        )}
      </div>

      {/* Multi-Shipments Section (Órdenes Multienvíos) */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Truck size={18} className="text-fuchsia-600 dark:text-fuchsia-400" /> 
          Envíos del Pedido ({order.shipments ? order.shipments.length : 1} {order.shipments?.length === 1 ? 'envío' : 'envíos'})
        </h3>

        {order.shipments && order.shipments.length > 0 ? (
          order.shipments.map((shipment, sIdx) => {
            const shipmentItems = order.items ? order.items.filter(item => item.shipment_id === shipment.id) : [];
            return (
              <div 
                key={shipment.id || sIdx}
                className="bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 sm:p-5 space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-zinc-800 pb-2.5">
                  <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Truck size={14} className="text-fuchsia-600 dark:text-fuchsia-400" /> Envío #{shipment.shipment_number || (sIdx + 1)} — {shipment.carrier || 'Estándar'} ({shipment.service || 'Estándar'})
                  </span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Costo: {formatPrice(shipment.shipping_cost)}
                  </span>
                </div>

                <div className="space-y-2">
                  {shipmentItems.map((item, iIdx) => {
                    const itemImage = getProductImage(item);
                    return (
                      <div
                        key={item.id || iIdx}
                        onClick={() => navigate(`/product/${item.public_id || item.product_id}`)}
                        className="flex items-center gap-3.5 p-2 rounded-xl bg-white dark:bg-zinc-800/80 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer border border-slate-200/60 dark:border-zinc-700/50"
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
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">Cant: {item.quantity}</span>
                        </div>
                        <div className="text-right font-bold text-slate-900 dark:text-white text-xs sm:text-sm pr-1">
                          {formatPrice(item.line_total)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          <div className="space-y-2">
            {order.items && order.items.map((item, iIdx) => {
              const itemImage = getProductImage(item);
              return (
                <div
                  key={item.id || iIdx}
                  onClick={() => navigate(`/product/${item.public_id || item.product_id}`)}
                  className="flex items-center gap-3.5 p-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"
                >
                  <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-zinc-700">
                    <img src={itemImage} alt={item.product_name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm truncate">{item.product_name}</h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Cant: {item.quantity}</span>
                  </div>
                  <div className="text-right font-bold text-slate-900 dark:text-white text-xs sm:text-sm pr-1">
                    {formatPrice(item.line_total)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Cancellation Section */}
      {order.status !== 'cancelled' && (
        <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
          <button
            onClick={handleCancelOrder}
            disabled={cancelling}
            className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 px-5 py-2.5 rounded-xl font-medium text-sm transition-all border border-rose-200 dark:border-rose-800 cursor-pointer"
          >
            <XCircle size={16} />
            {cancelling ? 'Cancelando...' : 'Cancelar Pedido'}
          </button>
        </div>
      )}
    </div>
  );
}
