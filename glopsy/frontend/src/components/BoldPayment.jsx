import React, { useEffect, useState } from 'react';
import { ShieldCheck, ArrowLeft, CreditCard } from 'lucide-react';
import api from '../services/api';
import { BOLD_METHOD_FEES, boldGatewayFeeForMethod } from '../utils/pricing';

const BOLD_REF_KEY = 'glopsy_bold_ref';
const BOLD_SCRIPT_ID = 'bold-checkout-sdk';

const loadBoldScript = (sdkUrl) => new Promise((resolve, reject) => {
  if (window.Bold?.checkout) return resolve();
  let script = document.getElementById(BOLD_SCRIPT_ID);
  const onLoad = () => resolve();
  const onError = () => reject(new Error('No se pudo cargar Bold.'));
  if (!script) {
    script = document.createElement('script');
    script.id = BOLD_SCRIPT_ID;
    script.src = sdkUrl || 'https://checkout.bold.co/checkout.js';
    script.async = true;
    script.onload = onLoad;
    script.onerror = onError;
    document.body.appendChild(script);
    return;
  }
  script.addEventListener('load', onLoad);
  script.addEventListener('error', onError);
});

const DOC_TYPES = {
  CEDULA: 'CC',
  NIT: 'NIT',
  PASAPORTE: 'PP',
  CEDULA_EXTRANJERIA: 'CE',
};

// El perfil guarda el tipo de documento como CC/CE/NIT/PAS; Bold usa sus propias claves.
const DOC_TYPE_FROM_PROFILE = {
  CC: 'CEDULA',
  CE: 'CEDULA_EXTRANJERIA',
  PAS: 'PASAPORTE',
  PP: 'PASAPORTE',
  NIT: 'NIT',
  CEDULA: 'CEDULA',
  CEDULA_EXTRANJERIA: 'CEDULA_EXTRANJERIA',
  PASAPORTE: 'PASAPORTE',
};

const normalizeDocType = (value) => DOC_TYPE_FROM_PROFILE[String(value || '').toUpperCase()] || 'CEDULA';

export default function BoldPayment({
  total,
  items,
  shippingCost,
  shippingPayload,
  customerInfo,
  guestHash,
  currency = 'COP',
  user,
  formatPrice,
  onSuccess,
  onBack,
}) {
  const [billing, setBilling] = useState({
    name: user?.name || '',
    email: user?.email || '',
    document_type: normalizeDocType(user?.document_type),
    document_number: user?.document_number || '',
    phone: user?.phone || customerInfo?.telefono || '',
    address: customerInfo?.direccion || '',
  });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [opened, setOpened] = useState(false);
  const [method, setMethod] = useState(String(currency).toUpperCase() === 'USD' ? 'internacional' : 'otras_tarjetas');
  const [error, setError] = useState('');

  const fee = boldGatewayFeeForMethod(total, method, { currency });
  const newTotal = (Number(total) || 0) + fee.total;

  useEffect(() => {
    const ref = sessionStorage.getItem(BOLD_REF_KEY);
    if (ref) pollStatus(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si el usuario se carga después de montar, completa los campos vacíos.
  useEffect(() => {
    if (!user) return;
    setBilling(prev => ({
      ...prev,
      name: prev.name || user.name || '',
      email: prev.email || user.email || '',
      document_type: user.document_type ? normalizeDocType(user.document_type) : prev.document_type,
      document_number: prev.document_number || user.document_number || '',
      phone: prev.phone || user.phone || '',
    }));
  }, [user]);

  const pollStatus = async (reference, attempts = 0) => {
    setChecking(true);
    try {
      const res = await api.get(`/payments/bold/status/${encodeURIComponent(reference)}`);
      const status = res.data?.status;
      if (status === 'APPROVED') {
        sessionStorage.removeItem(BOLD_REF_KEY);
        setChecking(false);
        onSuccess?.();
        return;
      }
      if ((status === 'PENDING' || status === 'UNKNOWN') && attempts < 12) {
        setTimeout(() => pollStatus(reference, attempts + 1), 4000);
        return;
      }
      setChecking(false);
      if (status === 'PENDING' || status === 'UNKNOWN') {
        setError('Aún estamos confirmando tu pago. Si ya pagaste, usa "Verificar estado".');
        return;
      }
      sessionStorage.removeItem(BOLD_REF_KEY);
      setOpened(false);
      setError(status === 'REJECTED' ? 'El pago fue rechazado.' : status === 'REFUNDED' ? 'El pago fue reversado.' : 'No se pudo confirmar el pago.');
    } catch {
      setChecking(false);
      setError('No fue posible verificar el pago.');
    }
  };

  const handlePay = async (e) => {
    e.preventDefault();
    setError('');
    if (!billing.name.trim() || !billing.email.trim()) {
      setError('Completa tu nombre y correo electrónico.');
      return;
    }
    if (!billing.document_number.trim()) {
      setError('Completa tu número de documento.');
      return;
    }

    setLoading(true);
    try {
      const start = await api.post('/payments/bold/checkout', {
        items,
        shipping_cost: shippingCost,
        shipping_payload: shippingPayload,
        customer_info: {
          ...customerInfo,
          customer_name: billing.name,
          email: billing.email,
          telefono: billing.phone || customerInfo?.telefono,
        },
        guestHash,
        currency,
        response_url: `${window.location.origin}/checkout`,
        payment_method: method,
        gateway_fee: { base: fee.base, iva: fee.iva, total: fee.total },
        billing: {
          name: billing.name,
          email: billing.email,
          phone: billing.phone,
          address: billing.address,
          documentType: DOC_TYPES[billing.document_type] || 'CC',
          documentNumber: billing.document_number,
        },
      });

      if (!start.data?.ok) {
        const msg = {
          bold_no_configurado: 'Aún no se ha configurado la pasarela Bold para esta tienda.',
        }[start.data?.message] || start.data?.message;
        setError(msg || 'No fue posible iniciar el pago.');
        return;
      }

      const reference = start.data.orderNumber;
      const checkout = start.data.checkout;
      sessionStorage.setItem(BOLD_REF_KEY, reference);

      await loadBoldScript(start.data.sdkUrl);
      const handler = window.Bold.checkout.configure({ key: checkout.key, test: checkout.test });
      const data = { ...checkout };
      delete data.key;
      delete data.test;
      handler.open(data);

      setOpened(true);
      pollStatus(reference);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error al procesar el pago.');
    } finally {
      setLoading(false);
    }
  };

  if (checking && !opened) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500">Verificando el estado de tu pago…</p>
      </div>
    );
  }

  const input = 'w-full p-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-blue-500';

  return (
    <form onSubmit={handlePay} className="space-y-5">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Pago con Glopsy</h2>
          <p className="text-xs text-slate-500">
            Subtotal: {formatPrice ? formatPrice(total) : total}. Elige el método de pago, la tarifa se agrega al total.
          </p>
        </div>
        <button type="button" onClick={onBack} className="text-xs font-bold text-fuchsia-600 hover:underline cursor-pointer flex items-center gap-1">
          <ArrowLeft size={14} /> Volver
        </button>
      </div>

      {!opened && (
        <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <label className="block text-xs font-bold text-slate-700">Método de pago</label>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(BOLD_METHOD_FEES).map(([key, m]) => (
              <label key={key} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border cursor-pointer text-sm ${method === key ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                <span className="flex items-center gap-2 font-semibold text-slate-800">
                  <input type="radio" name="bold-method" checked={method === key} onChange={() => setMethod(key)} />
                  {m.label}
                </span>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-sm">
            <span className="font-bold text-slate-700">Tarifa de pago</span>
            <strong className="text-slate-900">{formatPrice ? formatPrice(fee.total) : fee.total}</strong>
          </div>
          <div className="flex items-center justify-between text-sm font-extrabold text-slate-900">
            <span>Total a pagar</span>
            <span className="text-base">{formatPrice ? formatPrice(newTotal) : newTotal}</span>
          </div>
        </div>
      )}

      {opened ? (
        <div className="space-y-4 text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="flex items-center gap-2 font-bold text-blue-800">
            <CreditCard size={16} /> Completa el pago en la ventana de Glopsy.
          </p>
          <p>Si cerraste la ventana, puedes verificar el estado de tu pago.</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                const ref = sessionStorage.getItem(BOLD_REF_KEY);
                if (ref) pollStatus(ref);
              }}
              className="bg-white border border-blue-200 text-blue-700 font-bold px-4 py-2 rounded-xl text-sm cursor-pointer"
            >
              Verificar estado
            </button>
            <button
              type="button"
              onClick={() => { setOpened(false); setError(''); }}
              className="bg-white border border-slate-200 text-slate-600 font-bold px-4 py-2 rounded-xl text-sm cursor-pointer"
            >
              Reintentar
            </button>
          </div>
          {checking && <p className="text-xs text-blue-700">Verificando…</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Nombre completo</label>
            <input className={input} value={billing.name} onChange={(e) => setBilling({ ...billing, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de documento</label>
            <select className={input} value={billing.document_type} onChange={(e) => setBilling({ ...billing, document_type: e.target.value })}>
              <option value="CEDULA">Cédula</option>
              <option value="NIT">NIT</option>
              <option value="PASAPORTE">Pasaporte</option>
              <option value="CEDULA_EXTRANJERIA">Cédula extranjería</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Número de documento</label>
            <input className={input} value={billing.document_number} onChange={(e) => setBilling({ ...billing, document_number: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono</label>
            <input className={input} value={billing.phone} onChange={(e) => setBilling({ ...billing, phone: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Correo</label>
            <input className={input} type="email" value={billing.email} onChange={(e) => setBilling({ ...billing, email: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Dirección de facturación (opcional)</label>
            <input className={input} value={billing.address} onChange={(e) => setBilling({ ...billing, address: e.target.value })} />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</p>}

      {!opened && (
        <button type="submit" disabled={loading}
          className="w-full text-white font-bold py-4 rounded-2xl shadow-lg text-base flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
          <ShieldCheck size={20} />
          {loading ? 'Iniciando pago…' : `Pagar ${formatPrice ? formatPrice(newTotal) : newTotal}`}
        </button>
      )}
    </form>
  );
}