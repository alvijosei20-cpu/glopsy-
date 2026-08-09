import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, ShieldCheck, Phone, Home, Check } from 'lucide-react';
import api from '../../services/api';
import './cart.css';

const fallbackDepartamentos = [
  { id: 1, nombre: 'Bogotá D.C.' },
  { id: 2, nombre: 'Antioquia' },
  { id: 3, nombre: 'Valle del Cauca' },
  { id: 4, nombre: 'Cundinamarca' },
  { id: 5, nombre: 'Atlántico' }
];

const fallbackCiudades = [
  { id: 11001, departamento_id: 1, nombre: 'Bogotá' },
  { id: 5001, departamento_id: 2, nombre: 'Medellín' },
  { id: 76001, departamento_id: 3, nombre: 'Cali' },
  { id: 25001, departamento_id: 4, nombre: 'Chía' },
  { id: 8001, departamento_id: 5, nombre: 'Barranquilla' }
];

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [cartItems, setCartItems] = useState([]);
  const [guestHash, setGuestHash] = useState('');
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const [departamentos, setDepartamentos] = useState(fallbackDepartamentos);
  const [ciudades, setCiudades] = useState(fallbackCiudades);
  const [selectedDepartamentoId, setSelectedDepartamentoId] = useState('');
  const [selectedCiudadId, setSelectedCiudadId] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [shippingCost, setShippingCost] = useState(0);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [shippingMessage, setShippingMessage] = useState('');
  const [shipmentsGrouped, setShipmentsGrouped] = useState([]);
  const [perItem, setPerItem] = useState([]);
  const [freeShippingFlag, setFreeShippingFlag] = useState(false);
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') {
      setCheckoutSuccess(true);
      localStorage.removeItem('glopsy_cart');
      window.dispatchEvent(new Event('storage'));
    }

    try {
      const items = JSON.parse(localStorage.getItem('glopsy_cart') || '[]');
      setCartItems(items);
    } catch {
      setCartItems([]);
    }

    let gHash = localStorage.getItem('glopsy_guest_hash');
    if (!gHash) {
      gHash = 'guest_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('glopsy_guest_hash', gHash);
    }
    setGuestHash(gHash);

    const fetchGeo = async () => {
      try {
        const [resDeps, resCius] = await Promise.all([
          api.get('/geo/departamentos').catch(() => ({ data: { departamentos: [] } })),
          api.get('/geo/ciudades').catch(() => ({ data: { ciudades: [] } }))
        ]);
        if (resDeps.data?.departamentos?.length > 0) {
          setDepartamentos(resDeps.data.departamentos);
        }
        if (resCius.data?.ciudades?.length > 0) {
          setCiudades(resCius.data.ciudades);
        }
      } catch {
        // Fallbacks already set as initial state
      }
    };
    fetchGeo();
  }, [searchParams]);

  useEffect(() => {
    const calculateShipping = async () => {
      if (!selectedCiudadId || cartItems.length === 0) {
        setShippingCost(0);
        setShippingMessage('');
        setShippingOptions([]);
        return;
      }

      setLoadingShipping(true);
      try {
        const res = await api.post('/product/calculate-shipping', {
          items: cartItems,
          destination_ciudad_id: Number(selectedCiudadId)
        });
        if (res.data.ok) {
          // Backend returns aggregated response with shipments_message, shipping_cost and grouped breakdown
          setShippingCost(res.data.shipping_cost || 0);
          setFreeShippingFlag(Boolean(res.data.free_shipping));
          // always set message to 'Glopsy te regala el envío' when free_shipping true
          setShippingMessage(res.data.free_shipping ? 'Glopsy te regala el envío' : (res.data.shipments_message || 'Opciones de envío ENVIA'));
          setShipmentsGrouped(res.data.grouped || []);
          setPerItem(res.data.per_item || []);
          // we keep shippingOptions empty here (selection per shipment is not in this view)
          setShippingOptions([]);
        }
      } catch (err) {
        setShippingCost(15000);
        setShippingOptions([]);
        setShippingMessage('Tarifa de envío estándar');
      } finally {
        setLoadingShipping(false);
      }
    };
    calculateShipping();
  }, [selectedCiudadId, cartItems]);

  const formatPrice = (val) => {
    const num = Number(val || 0);
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
  };

  const subtotal = cartItems.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
  const total = subtotal + Number(shippingCost || 0);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!selectedDepartamentoId || !selectedCiudadId || !direccion.trim() || !telefono.trim()) {
      alert('Por favor completa todos los datos de envío (Departamento, Ciudad, Dirección y Número Móvil).');
      return;
    }

    setLoadingCheckout(true);
    try {
      const res = await api.post('/product/create-preference', {
        items: cartItems,
        shipping_cost: shippingCost,
        customer_info: {
          departamento_id: selectedDepartamentoId,
          ciudad_id: selectedCiudadId,
          direccion,
          telefono
        },
        guestHash
      });

      if (res.data.ok && (res.data.init_point || res.data.sandbox_init_point)) {
        window.location.href = res.data.init_point || res.data.sandbox_init_point;
      } else {
        alert('No se pudo iniciar el pago con Mercado Pago.');
      }
    } catch (err) {
      console.error('Error al procesar el checkout:', err);
      alert(err.response?.data?.message || 'Error al procesar el pago o apartar el stock.');
    } finally {
      setLoadingCheckout(false);
    }
  };

  if (checkoutSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-sm border border-fuchsia-100 p-10 text-center max-w-md w-full animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <Check size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">¡Compra realizada con éxito!</h2>
          <p className="text-slate-500 text-sm mb-8">
            Tu pedido ha sido procesado correctamente a través de Mercado Pago. El stock ha sido apartado y confirmado.
          </p>
          <button
            onClick={() => navigate('/listpr')}
            className="w-full bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-fuchsia-600/30"
          >
            Seguir comprando
          </button>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-sm border border-fuchsia-100 p-12 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">No hay productos para el checkout</h2>
          <p className="text-slate-500 text-sm mb-8">Tu carrito está vacío.</p>
          <Link
            to="/cart"
            className="inline-block bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg text-sm"
          >
            Volver al carrito
          </Link>
        </div>
      </div>
    );
  }

  const filteredCiudades = selectedDepartamentoId
    ? ciudades.filter(c => Number(c.departamento_id) === Number(selectedDepartamentoId))
    : ciudades;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <ShieldCheck size={32} className="text-blue-600" />
            Checkout y Pago Seguro
          </h1>
          <Link to="/cart" className="text-sm font-semibold text-fuchsia-600 hover:underline flex items-center gap-1">
            <ArrowLeft size={16} /> Volver al carrito
          </Link>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm">
          <form onSubmit={handleCheckout} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Departamento</label>
                <select
                  value={selectedDepartamentoId}
                  onChange={(e) => {
                    setSelectedDepartamentoId(e.target.value);
                    setSelectedCiudadId('');
                  }}
                  required
                  id="departamento-select"
                  name="departamento"
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Selecciona un departamento</option>
                  {departamentos.map(d => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ciudad</label>
                <select
                  value={selectedCiudadId}
                  onChange={(e) => setSelectedCiudadId(e.target.value)}
                  required
                  disabled={!selectedDepartamentoId}
                  id="ciudad-select"
                  name="ciudad"
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">Selecciona una ciudad</option>
                  {filteredCiudades.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Dirección de entrega</label>
                <div className="relative">
                  <Home size={16} className="absolute left-3 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Calle, número, barrio..."
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Número móvil</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-3.5 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="Ej. 3001234567"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {shippingOptions.length > 0 && (
              <div className="border-t border-slate-100 pt-6 space-y-2">
                <label className="block text-xs font-bold text-slate-700">Selecciona el método de envío (ENVIA):</label>
                {shippingOptions.map((opt, idx) => (
                  <label key={idx} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer text-sm transition-all ${selectedOptionIndex === idx ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="shipping_option"
                        checked={selectedOptionIndex === idx}
                        onChange={() => {
                          setSelectedOptionIndex(idx);
                          setShippingCost(opt.price);
                        }}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <p className="font-bold text-slate-800 uppercase">{opt.carrier} - {opt.service}</p>
                        <p className="text-xs text-slate-500">Entrega: {opt.delivery_estimate}</p>
                      </div>
                    </div>
                    <span className="font-extrabold text-blue-600">{formatPrice(opt.price)}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="border-t border-slate-100 pt-6 space-y-3">
              <h3 className="font-bold text-slate-900 mb-2">Resumen de costos</h3>
              <div className="flex justify-between text-slate-600 text-sm">
                <span>Subtotal productos ({cartItems.length})</span>
                <span className="font-semibold text-slate-800">{formatPrice(subtotal)}</span>
              </div>
               <div className="space-y-2">
                  <div className="flex justify-between text-slate-600 text-sm items-center">
                    <div>
                      {freeShippingFlag ? (
                        <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm font-semibold">
                          <Check size={14} /> Glopsy te regala el envío
                        </div>
                      ) : (
                        <span>Envío ({shippingMessage || 'ENVIA'})</span>
                      )}
                    </div>
                    <span className="font-semibold text-slate-800">
                      {loadingShipping ? 'Calculando...' : formatPrice(freeShippingFlag ? 0 : shippingCost)}
                    </span>
                  </div>
                 {/* Show each shipment cost separately in muted/opaque style */}
                {shipmentsGrouped.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {shipmentsGrouped.map((g, idx) => (
                       <div key={g.key || idx} className="flex justify-between text-sm text-slate-500 opacity-70">
                         <div>
                           <div>Envío {idx + 1} {g.idbusiness ? `- Tienda ${g.idbusiness}` : ''}</div>
                           {g.selected_carrier && (
                             <div className="text-xs text-slate-400">{g.selected_carrier.carrier} · {g.selected_carrier.service}</div>
                           )}
                         </div>
                         <span className="font-medium">{formatPrice(g.shippingCost)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Show per-item shipping breakdown including free items */}
                {Array.isArray(per_item) || (shipmentsGrouped && shipmentsGrouped.length > 0) ? (
                  <div className="mt-3">
                    <div className="text-xs text-slate-500 mb-1">Detalle por producto</div>
                    <div className="space-y-1">
                      {perItem && perItem.length > 0 ? (
                        // aggregate perItem by itemId
                        (() => {
                          const map = new Map();
                          for (const pi of perItem) {
                            const id = String(pi.itemId);
                            const prev = map.get(id) || { itemId: pi.itemId, shippingCost: 0, qty: 0 };
                            prev.shippingCost += Number(pi.shippingCost || 0);
                            prev.qty += 1;
                            map.set(id, prev);
                          }
                          const arr = Array.from(map.values());
                          return arr.map(a => {
                            const prod = cartItems.find(ci => String(ci.id) === String(a.itemId));
                            const name = prod?.name || `Producto ${a.itemId}`;
                            const qty = prod?.quantity || a.qty || 1;
                            return (
                              <div key={a.itemId} className="flex justify-between text-sm text-slate-600">
                                <div>
                                  <div className="font-medium">{name} {qty > 1 ? `x${qty}` : ''}</div>
                                </div>
                                <div>
                                  {Number(a.shippingCost) === 0 ? (
                                    <span className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-xs font-semibold"><Check size={12} /> Gratis</span>
                                  ) : (
                                    <span className="font-medium">{formatPrice(a.shippingCost)}</span>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()
                      ) : (
                        <div className="text-xs text-slate-400">No hay detalles por producto.</div>
                      )}
                    </div>
                  </div>
                ) : null}
               </div>
              <div className="border-t border-slate-100 pt-3 flex justify-between text-lg font-extrabold text-slate-900">
                <span>Total a pagar</span>
                <span className="text-blue-600">{formatPrice(total)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingCheckout || loadingShipping}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-600/30 text-base transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck size={20} />
              {loadingCheckout ? 'Procesando pago con Mercado Pago...' : 'Pagar con Mercado Pago'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
