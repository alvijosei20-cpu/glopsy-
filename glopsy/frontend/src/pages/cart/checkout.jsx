import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Phone, Home, Check, ChevronDown, ChevronUp, Truck, Package, DollarSign } from 'lucide-react';
import api from '../../services/api';
import { isLoggedIn } from '../../utils/session';
import { requireBiometricPayment } from '../../utils/webauthn';
import { trackEvent } from '../../utils/analytics';
import { useMoney } from '../../utils/money';
import { useStorefront } from '../../storefront/StorefrontContext';
import { useAuth } from '../../context/AuthContext';
import EpaycoPayment from '../../components/EpaycoPayment';
import './cart.css';

export default function Checkout() {
  const { format: formatPrice, currency, locale, rate: currencyRate = 1 } = useMoney();
  const { store } = useStorefront();
  const { user } = useAuth();
  const paisId = store?.paisId || null;
  const isCOP = String(currency || '').toUpperCase() === 'COP';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [cartItems, setCartItems] = useState([]);
  const [guestHash, setGuestHash] = useState('');
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const isInternationalStore = String(currency || '').toUpperCase() === 'USD'
    && String(store?.internationalDispatchProvider || '').toLowerCase() === 'mastershop';
  const [shippingMode, setShippingMode] = useState('national');
  const [paises, setPaises] = useState([]);
  const [intlDestination, setIntlDestination] = useState({ country: '', state: '', city: '', postalCode: '', address: '' });
  const [intlOptions, setIntlOptions] = useState([]);
  const [selectedIntlOptionId, setSelectedIntlOptionId] = useState('');
  const [loadingIntl, setLoadingIntl] = useState(false);
  const [intlError, setIntlError] = useState('');

  const [departamentos, setDepartamentos] = useState([]);
  const [ciudades, setCiudades] = useState([]);
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
  const [paymentProvider, setPaymentProvider] = useState('mercadopago');
  const [showEpayco, setShowEpayco] = useState(false);

  // Si el cliente vuelve del checkout de ePayco, retomamos la verificación del pago.
  useEffect(() => {
    if (sessionStorage.getItem('glopsy_epayco_ref')) {
      setPaymentProvider('epayco');
      setShowEpayco(true);
    }
  }, []);

  // Pasarela predeterminada de la plataforma (MP o ePayco) para tiendas COP.
  useEffect(() => {
    if (!isCOP) return;
    api.get('/tienda/payment-methods', { params: { moneda: currency || 'COP' } })
      .then(res => {
        const def = res.data?.default;
        if (def === 'epayco' || def === 'mercadopago') setPaymentProvider(def);
      })
      .catch(() => {});
  }, [isCOP, currency]);

  useEffect(() => {
    if (!isLoggedIn()) return;
    api.get('/auth/checkout-defaults')
      .then(res => {
        if (res.data.ok && res.data.defaults) {
          const d = res.data.defaults;
          if (d.departamento_id) setSelectedDepartamentoId(String(d.departamento_id));
          if (d.ciudad_id) setSelectedCiudadId(String(d.ciudad_id));
          if (d.direccion) setDireccion(d.direccion);
          if (d.telefono) setTelefono(d.telefono);
        }
      })
      .catch(() => {});
  }, []);

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
        const mp = new window.MercadoPago(preferenceData.publicKey, { locale });
        const bricksBuilder = mp.bricks();
        await bricksBuilder.create('payment', 'paymentBrick_container', {
          initialization: {
            preferenceId: preferenceData.preferenceId,
            amount: Math.round(Number(total) * currencyRate * 100) / 100,
          },
          callbacks: {
            onReady: () => {},
            onSubmit: ({ selectedPaymentMethod, formData }) => {
              return new Promise(async (resolve, reject) => {
                let biometricNonce = null;
                try {
                  const bio = await requireBiometricPayment();
                  if (bio.cancelled) {
                    alert('Validación biométrica cancelada. El pago no fue procesado.');
                    reject(new Error('Validación biométrica cancelada'));
                    return;
                  }
                  biometricNonce = bio.nonce || null;
                } catch (bioErr) {
                  alert(bioErr.response?.data?.message || bioErr.message || 'No se pudo validar la huella.');
                  reject(bioErr);
                  return;
                }
                trackEvent('add_payment_info', {
                  currency,
                  value: total,
                  items: cartItemsConPrecio.map(item => ({
                    item_id: String(item.external_id || item.id || ''),
                    item_name: item.name || '',
                    price: Number(item.price || 0),
                    quantity: Number(item.quantity || 1),
                  })),
                });
                api.post('/product/process-mp-payment', {
                  formData,
                  preferenceId: preferenceData.preferenceId,
                  guestHash,
                  shipping_cost: shippingCost,
                  shipping_payload: shippingPayloadForOrder(),
                  items: cartItemsConPrecio,
                  biometric_nonce: biometricNonce,
                  customer_info: customerInfoForOrder()
                })
                .then(res => {
                  if (res.data.ok) {
                    setCheckoutSuccess(true);
                    localStorage.removeItem('glopsy_cart');
                    window.dispatchEvent(new Event('storage'));
                    firePurchase(res.data.payment?.id, null, total);
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
      try {
        const snapshot = JSON.parse(sessionStorage.getItem('glopsy_checkout_snapshot') || 'null');
        if (snapshot) {
          firePurchase(searchParams.get('collection_id') || null, snapshot.items, snapshot.value);
        }
      } catch {}
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
        const geoParams = paisId ? { pais_id: paisId } : {};
        const [resDeps, resCius, resPaises] = await Promise.all([
          api.get('/geo/departamentos', { params: geoParams }).catch(() => ({ data: { departamentos: [] } })),
          api.get('/geo/ciudades', { params: geoParams }).catch(() => ({ data: { ciudades: [] } })),
          api.get('/geo/paises').catch(() => ({ data: { paises: [] } }))
        ]);
        if (resDeps.data?.departamentos?.length > 0) {
          setDepartamentos(resDeps.data.departamentos);
        }
        if (resCius.data?.ciudades?.length > 0) {
          setCiudades(resCius.data.ciudades);
        }
        if (resPaises.data?.paises?.length > 0) {
          setPaises(resPaises.data.paises);
        }
      } catch {
        // Sin datos geográficos no se puede cotizar; el usuario reintenta.
      }
    };
    fetchGeo();
  }, [searchParams, paisId]);

  useEffect(() => {
    const calculateShipping = async () => {
      if (isInternationalStore && shippingMode === 'international') {
        return;
      }
      if (!selectedCiudadId || cartItems.length === 0) {
        setShippingCost(0);
        setShippingMessage('');
        setShippingOptions([]);
        return;
      }

      setLoadingShipping(true);
      try {
        const res = await api.post('/product/calculate-shipping', {
                  items: cartItemsConPrecio,
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
  }, [selectedCiudadId, cartItems, shippingMode, isInternationalStore]);

  useEffect(() => {
    if (isInternationalStore && shippingMode === 'international') {
      const opt = intlOptions.find((o) => o.id === selectedIntlOptionId);
      setShippingCost(opt ? Number(opt.total || 0) : 0);
      setShippingMessage(opt ? `Envío internacional (${opt.carrier})` : 'Selecciona una opción de envío internacional');
    }
  }, [selectedIntlOptionId, intlOptions, shippingMode, isInternationalStore]);

  const quoteInternational = async () => {
    if (!intlDestination.country || !intlDestination.state || !intlDestination.city || !intlDestination.address) {
      setIntlError('Completa país, estado/región, ciudad y dirección de destino.');
      return;
    }
    setIntlError('');
    setLoadingIntl(true);
    setIntlOptions([]);
    setSelectedIntlOptionId('');
    try {
      const country = paises.find((p) => String(p.codigo_iso).toUpperCase() === String(intlDestination.country).toUpperCase());
      const res = await api.post('/product/international-shipping', {
        items: cartItemsConPrecio,
        destination: {
          name: user?.name || 'Cliente',
          email: user?.email || undefined,
          phone: telefono || undefined,
          country: intlDestination.country,
          state: intlDestination.state,
          city: intlDestination.city,
          postalCode: intlDestination.postalCode,
          street: intlDestination.address,
          number: '',
          reference: '',
          countryName: country?.nombre || undefined,
        },
      });
      if (res.data?.ok) {
        setIntlOptions(res.data.options || []);
        if ((res.data.options || []).length === 0) {
          setIntlError('No hay opciones de envío disponibles para ese destino.');
        }
      } else {
        setIntlError(res.data?.message || 'No fue posible cotizar el envío internacional.');
      }
    } catch (err) {
      setIntlError(err.response?.data?.message || 'No fue posible cotizar el envío internacional.');
    } finally {
      setLoadingIntl(false);
    }
  };

  const backendPriceOf = (item) => {
    const pi = perItem.find(x => String(x.itemId) === String(item.id));
    return pi && pi.price != null ? Number(pi.price) : null;
  };
  const cartItemsConPrecio = cartItems.map(item => {
    const bp = backendPriceOf(item);
    return bp != null ? { ...item, price: bp } : item;
  });
  const subtotal = cartItemsConPrecio.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
  const total = subtotal + Number(shippingCost || 0);
  const isIntlUI = isInternationalStore && shippingMode === 'international';

  const checkoutItemsForGA = () =>
    cartItemsConPrecio.map(item => ({
      item_id: String(item.external_id || item.id || ''),
      item_name: item.name || '',
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 1),
    }));

  const firePurchase = (transactionId, items, value) => {
    const txnId = String(transactionId || `glopsy_${Date.now()}`);
    trackEvent('purchase', {
      transaction_id: txnId,
      currency,
      value,
      shipping: Number(shippingCost || 0),
      items: items || checkoutItemsForGA(),
    });
    sessionStorage.removeItem('glopsy_checkout_snapshot');
  };

  const handleEpaycoSuccess = () => {
    setCheckoutSuccess(true);
    localStorage.removeItem('glopsy_cart');
    window.dispatchEvent(new Event('storage'));
    firePurchase(null, null, total);
  };

  const customerInfoForOrder = () => (
    isIntlUI
      ? {
          direccion: intlDestination.address,
          telefono,
          email: user?.email || undefined,
          customer_name: user?.name || undefined,
          country: intlDestination.country,
          state: intlDestination.state,
          city: intlDestination.city,
          postalCode: intlDestination.postalCode,
        }
      : {
          departamento_id: selectedDepartamentoId,
          ciudad_id: selectedCiudadId,
          direccion,
          telefono,
        }
  );

  const shippingPayloadForOrder = () => (
    isIntlUI
      ? {
          international: true,
          destination: intlDestination,
          option: intlOptions.find((o) => o.id === selectedIntlOptionId) || null,
        }
      : { grouped: shipmentsGrouped }
  );

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (isIntlUI) {
      if (
        !intlDestination.country || !intlDestination.state.trim() || !intlDestination.city.trim() ||
        !intlDestination.address.trim() || !telefono.trim() || !selectedIntlOptionId
      ) {
        alert('Completa el destino internacional y selecciona una opción de envío.');
        return;
      }
    } else {
      if (!selectedDepartamentoId || !selectedCiudadId || !direccion.trim() || !telefono.trim()) {
        alert('Por favor completa todos los datos de envío (Departamento, Ciudad, Dirección y Número Móvil).');
        return;
      }
      if (!/^3\d{9}$/.test(telefono) && isCOP) {
        alert('El número móvil debe tener 10 dígitos y empezar por 3 (Ej. 3001234567).');
        return;
      }
    }

    const checkoutItems = cartItemsConPrecio.map(item => ({
      item_id: String(item.external_id || item.id || ''),
      item_name: item.name || '',
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 1),
    }));

    // ePayco: checkout Onpage (el pago se completa en la pasarela embebida).
    if (paymentProvider === 'epayco') {
      trackEvent('begin_checkout', { currency, value: total, items: checkoutItems });
      setShowEpayco(true);
      return;
    }

    setLoadingCheckout(true);
    try {
      const res = await api.post('/product/create-preference', {
                  items: cartItemsConPrecio,
        shipping_cost: shippingCost,
        customer_info: customerInfoForOrder(),
        guestHash
      });

      if (res.data.ok && res.data.preferenceId && res.data.public_key) {
        setPreferenceData({
          preferenceId: res.data.preferenceId,
          publicKey: res.data.public_key
        });
        setShowBricks(true);
        sessionStorage.setItem('glopsy_checkout_snapshot', JSON.stringify({
          items: checkoutItems,
          value: total,
          shipping: shippingCost,
        }));
        trackEvent('begin_checkout', {
          currency,
          value: total,
          items: checkoutItems,
        });
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
        <div className="bg-white rounded-3xl shadow-sm border border-fuchsia-100 p-6 sm:p-10 text-center max-w-md w-full animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <Check size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">¡Compra realizada con éxito!</h2>
          <p className="text-slate-500 text-sm mb-8">
            Tu pedido ha sido procesado correctamente. El stock ha sido apartado y confirmado.
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
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
          ) : showEpayco ? (
            <EpaycoPayment
              total={total}
              items={cartItemsConPrecio}
              shippingCost={shippingCost}
              shippingPayload={shippingPayloadForOrder()}
              customerInfo={customerInfoForOrder()}
              guestHash={guestHash}
              currency={currency}
              user={user}
              formatPrice={formatPrice}
              onSuccess={handleEpaycoSuccess}
              onBack={() => setShowEpayco(false)}
            />
          ) : (
            <form onSubmit={handleCheckout} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Método de pago</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentProvider('mercadopago')}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${paymentProvider === 'mercadopago' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  Mercado Pago
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentProvider('epayco')}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${paymentProvider === 'epayco' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  Tarjeta / PSE (ePayco)
                </button>
              </div>
            </div>
            {isInternationalStore && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Tipo de envío</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setShippingMode('national'); setIntlOptions([]); setSelectedIntlOptionId(''); }}
                    className={`p-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${shippingMode === 'national' ? 'border-fuchsia-600 bg-fuchsia-50 text-fuchsia-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    Nacional (Venezuela)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShippingMode('international'); setShippingCost(0); }}
                    className={`p-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${shippingMode === 'international' ? 'border-slate-900 bg-slate-100 text-slate-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    Internacional
                  </button>
                </div>
              </div>
            )}

            {isIntlUI ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">País de destino</label>
                    <select
                      value={intlDestination.country}
                      onChange={(e) => setIntlDestination({ ...intlDestination, country: e.target.value })}
                      className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-slate-500"
                    >
                      <option value="">Selecciona un país</option>
                      {paises.map((p) => (
                        <option key={p.id} value={p.codigo_iso}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Estado / Región</label>
                    <input
                      type="text"
                      value={intlDestination.state}
                      onChange={(e) => setIntlDestination({ ...intlDestination, state: e.target.value })}
                      placeholder="Ej. Florida"
                      className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Ciudad</label>
                    <input
                      type="text"
                      value={intlDestination.city}
                      onChange={(e) => setIntlDestination({ ...intlDestination, city: e.target.value })}
                      placeholder="Ej. Miami"
                      className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Código postal</label>
                    <input
                      type="text"
                      value={intlDestination.postalCode}
                      onChange={(e) => setIntlDestination({ ...intlDestination, postalCode: e.target.value })}
                      placeholder="Ej. 33125"
                      className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-slate-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Dirección</label>
                    <input
                      type="text"
                      value={intlDestination.address}
                      onChange={(e) => setIntlDestination({ ...intlDestination, address: e.target.value })}
                      placeholder="Calle, número, apartamento"
                      className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-slate-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono de contacto</label>
                    <input
                      type="tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="Teléfono del destinatario"
                      className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-slate-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={quoteInternational}
                    disabled={loadingIntl}
                    className="bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl text-sm cursor-pointer disabled:opacity-50"
                  >
                    {loadingIntl ? 'Cotizando…' : 'Cotizar envío internacional'}
                  </button>
                  {intlError && <span className="text-xs text-rose-600">{intlError}</span>}
                </div>
                {intlOptions.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">Selecciona el envío</label>
                    {intlOptions.map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border cursor-pointer text-sm transition-all ${selectedIntlOptionId === opt.id ? 'border-slate-900 bg-slate-100' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="intl_option"
                            checked={selectedIntlOptionId === opt.id}
                            onChange={() => setSelectedIntlOptionId(opt.id)}
                            className="text-slate-900 focus:ring-slate-500"
                          />
                          <div>
                            <p className="font-bold text-slate-800 uppercase">{opt.carrier}{opt.branch?.reference ? ` · ${opt.branch.reference}` : ''}</p>
                            <p className="text-[11px] text-slate-500">{opt.leg1?.service || 'Internacional'} + última milla</p>
                          </div>
                        </div>
                        <span className="font-extrabold text-slate-900">{formatPrice(opt.total)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
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
                    placeholder="Calle / Carrera / Transversal / Diagonal # N° - N° (Ej. Calle 100 # 15-20, Apto 301)"
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
                    placeholder="Móvil (Ej. 3001234567 - 10 dígitos)"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            </>
            )}

            {shippingOptions.length > 0 && (
              <div className="border-t border-slate-100 pt-6 space-y-2">
                <label className="block text-xs font-bold text-slate-700">Selecciona el método de envío (ENVIA):</label>
                {shippingOptions.map((opt, idx) => (
                  <label key={idx} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border cursor-pointer text-sm transition-all ${selectedOptionIndex === idx ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
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
                    <span className="font-extrabold text-blue-600 sm:shrink-0 sm:ml-auto">{formatPrice(opt.price)}</span>
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
              className="w-full text-white font-bold py-4 rounded-2xl shadow-lg text-base transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-blue-600/30"
            >
              <ShieldCheck size={20} />
              {loadingCheckout
                ? 'Procesando pago con Mercado Pago...'
                : paymentProvider === 'epayco' ? 'Continuar con ePayco' : 'Pagar con Mercado Pago'}
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
