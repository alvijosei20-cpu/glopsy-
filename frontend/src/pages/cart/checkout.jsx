import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, ShieldCheck, Phone, Home, Check, ChevronDown, ChevronUp, Truck, Package, DollarSign } from 'lucide-react';
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
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [showBricks, setShowBricks] = useState(false);
  const [preferenceData, setPreferenceData] = useState(null);

  useEffect(() => {
    if (!showBricks || !preferenceData) return;

    const scriptId = 'mercadopago-sdk-v2';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.onload = () => initBricks();
      document.body.appendChild(script);
    } else {
      initBricks();
    }

    async function initBricks() {
      if (!window.MercadoPago) return;
      try {
        const isDark = document.documentElement.classList.contains('dark');
        const mp = new window.MercadoPago(preferenceData.publicKey, { locale: 'es-CO' });
        const bricksBuilder = mp.bricks();
        await bricksBuilder.create('payment', 'paymentBrick_container', {
          initialization: {
            preferenceId: preferenceData.preferenceId,
            amount: Number(total),
          },
          callbacks: {
            onReady: () => {},
            onSubmit: ({ selectedPaymentMethod, formData }) => {
              return new Promise((resolve, reject) => {
                api.post('/product/process-mp-payment', {
                  formData,
                  preferenceId: preferenceData.preferenceId,
                  guestHash,
                  customer_info: {
                    departamento_id: selectedDepartamentoId,
                    ciudad_id: selectedCiudadId,
                    direccion,
                    telefono
                  }
                })
                .then(res => {
                  if (res.data.ok) {
                    setCheckoutSuccess(true);
                    localStorage.removeItem('glopsy_cart');
                    window.dispatchEvent(new Event('storage'));
                    resolve();
                  } else {
                    alert(res.data.message || 'Error en el pago');
                    reject(new Error(res.data.message));
                  }
                })
                .catch(err => {
                  alert(err.response?.data?.message || 'Error al procesar el pago');
                  reject(err);
                });
              });
            },
            onError: (error) => {
              console.error('MP Bricks Error:', error);
            }
          },
          customization: {
            visual: {
              style: {
                theme: isDark ? 'dark' : 'default',
              }
            },
            paymentMethods: {
              creditCard: 'all',
              debitCard: 'all',
              ticket: 'all',
              bankTransfer: 'all',
              mercadoPago: 'all',
            }
          }
        });
      } catch (err) {
        console.error('Error rendering MP Bricks:', err);
      }
    }
  }, [showBricks, preferenceData]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

      if (res.data.ok && res.data.preferenceId && res.data.public_key) {
        setPreferenceData({
          preferenceId: res.data.preferenceId,
          publicKey: res.data.public_key
        });
        setShowBricks(true);
      } else {
        alert('No se pudo iniciar la preferencia de pago con Mercado Pago.');
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
            Glopsy pagos
          </h1>
          <Link to="/cart" className="text-sm font-semibold text-fuchsia-600 hover:underline flex items-center gap-1">
            <ArrowLeft size={16} /> Volver al carrito
          </Link>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm">
          {showBricks ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Opciones de pago</h2>
                  <p className="text-xs text-slate-500">Realiza tu pago de forma segura sin salir de la tienda.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBricks(false)}
                  className="text-xs font-bold text-fuchsia-600 hover:underline cursor-pointer"
                >
                  ← Volver
                </button>
              </div>
              <div id="paymentBrick_container" className="min-h-[450px]"></div>
            </div>
          ) : (
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

            <div className="border-t border-slate-200 pt-6 space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 text-slate-900 font-bold text-sm">
                  <div className="p-2 bg-fuchsia-100 text-fuchsia-600 rounded-xl">
                    <Truck size={18} />
                  </div>
                  <span>Resumen de Envío y Costos</span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between text-slate-700">
                    <div className="flex items-center gap-2">
                      <Package size={16} className="text-slate-500" />
                      <span>Subtotal productos ({cartItems.length})</span>
                    </div>
                    <span className="font-bold text-slate-900">{formatPrice(subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700">
                    <div className="flex items-center gap-2">
                      <Truck size={16} className="text-slate-500" />
                      {freeShippingFlag ? (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                          <Check size={12} /> Glopsy te regala el envío
                        </span>
                      ) : (
                        <span>Envío ({shippingMessage || 'ENVIA'})</span>
                      )}
                    </div>
                    <span className="font-bold text-slate-900">
                      {loadingShipping ? 'Calculando...' : formatPrice(freeShippingFlag ? 0 : shippingCost)}
                    </span>
                  </div>

                  {shipmentsGrouped.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      {shipmentsGrouped.map((g, idx) => {
                        const isFree = Number(g.shippingCost || 0) === 0 || freeShippingFlag;
                        return (
                          <div key={g.key || idx} className="flex items-center justify-between text-xs text-slate-600 bg-slate-200/60 p-2.5 rounded-xl border border-slate-300/60">
                            <div>
                              <div className="font-semibold text-slate-800">Envío {idx + 1} {g.idbusiness ? `(Tienda ${g.idbusiness})` : ''}</div>
                              {g.selected_carrier && (
                                <div className="text-[11px] text-slate-500">{g.selected_carrier.carrier} · {g.selected_carrier.service}</div>
                              )}
                               {isFree && (
                                 <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                                   <Check size={12} /> Glopsy te regala este envio
                                 </div>
                               )}
                             </div>
                             <span className="font-bold text-slate-800">
                               {isFree ? <span className="text-emerald-600 dark:text-emerald-400">Gratis</span> : formatPrice(g.shippingCost)}
                             </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Show per-item shipping breakdown including free items */}
                {Array.isArray(perItem) || (shipmentsGrouped && shipmentsGrouped.length > 0) ? (
                  <div className="pt-3 border-t border-slate-200">
                    <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                      <Package size={14} className="text-fuchsia-600" />
                      <span>Detalle por producto y envíos</span>
                    </div>
                    <div className="relative">
                      <div className={`space-y-2 transition-all duration-300 ${!detailsExpanded ? 'max-h-32 overflow-hidden' : ''}`}>
                        {perItem && perItem.length > 0 ? (
                          // aggregate perItem by itemId
                          (() => {
                            const map = new Map();
                            for (const pi of perItem) {
                              const id = String(pi.itemId);
                              const prev = map.get(id) || { itemId: pi.itemId, qty: 0, isFree: false };
                              prev.qty += 1;
                              if (pi.isFree) prev.isFree = true;
                              map.set(id, prev);
                            }
                            const arr = Array.from(map.values());
                            return arr.map(a => {
                              const prod = cartItems.find(ci => String(ci.id) === String(a.itemId));
                              const name = prod?.name || `Producto ${a.itemId}`;
                              const qty = prod?.quantity || a.qty || 1;
                              return (
                                <div key={a.itemId} className="flex items-center gap-3 text-xs sm:text-sm bg-slate-200/60 p-3 rounded-xl border border-slate-300/60 shadow-sm">
                                  {prod?.image && (
                                    <img src={prod.image} alt="" className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0" />
                                  )}
                                  <div>
                                    <div className="font-bold text-slate-800 line-clamp-1">{name}</div>
                                    <div className="text-slate-500 text-[11px]">Cantidad: {qty} {prod?.variant?.name ? `• ${prod.variant.name}` : ''}</div>
                                     {a.isFree && (
                                       <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                                         <Check size={12} /> Glopsy te regala este envio
                                       </div>
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
                      {!detailsExpanded && (
                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-[#121212] to-transparent pointer-events-none"></div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailsExpanded(!detailsExpanded)}
                      className="mt-2 flex items-center gap-1 text-xs font-bold text-fuchsia-600 hover:text-fuchsia-700 transition-colors cursor-pointer"
                    >
                      <span>{detailsExpanded ? 'Ver menos' : 'Ver más detalles'}</span>
                      {detailsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                ) : null}

                <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-base sm:text-lg font-extrabold text-slate-900">
                  <span className="flex items-center gap-2">
                    <DollarSign size={18} className="text-emerald-600" />
                    <span>Total a pagar</span>
                  </span>
                  <span className="text-fuchsia-600">{formatPrice(total)}</span>
                </div>
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
          )}
        </div>
      </div>
    </div>
  );
}
