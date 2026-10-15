import React, { useEffect, useState } from 'react';
import { ShieldCheck, ArrowLeft, CreditCard } from 'lucide-react';
import api from '../services/api';

const BOLD_REF_KEY = 'glopsy_bold_ref';
const BOLD_LIB_SRC = 'https://checkout.bold.co/library/boldPaymentButton.js';

const DOC_TYPES = {
  CEDULA: 'CC',
  NIT: 'NIT',
  PASAPORTE: 'PA',
  CEDULA_EXTRANJERIA: 'CE',
};

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

// Carga la librería actual de Bold (boldPaymentButton.js) que expone window.BoldCheckout.
const loadBoldLib = () => new Promise((resolve, reject) => {
  if (window.BoldCheckout) return resolve();
  const existing = document.querySelector(`script[src*="boldPaymentButton.js"]`);
  const onOk = () => (window.BoldCheckout ? resolve() : reject(new Error('No se pudo cargar Bold.')));
  if (existing) {
    window.addEventListener('boldCheckoutLoaded', onOk, { once: true });
    window.addEventListener('boldCheckoutLoadFailed', () => reject(new Error('No se pudo cargar Bold.')), { once: true });
    let tries = 0;
    const t = setInterval(() => {
      if (window.BoldCheckout) { clearInterval(t); resolve(); }
      else if (++tries > 50) { clearInterval(t); reject(new Error('No se pudo cargar Bold.')); }
    }, 100);
    return;
  }
  const js = document.createElement('script');
  js.src = BOLD_LIB_SRC;
  js.onload = onOk;
  js.onerror = () => reject(new Error('No se pudo cargar Bold.'));
  document.head.appendChild(js);
});

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
  const [reference, setReference] = useState(null);
  const [error, setError] = useState('');

  // Chequeo puntual (al recargar): si no está aprobado, no bloquea el formulario.
  const checkOnce = async (ref) => {
    setChecking(true);
    try {
      const res = await api.get(`/payments/bold/status/${encodeURIComponent(ref)}`);
      if (res.data?.status === 'APPROVED') {
        sessionStorage.removeItem(BOLD_REF_KEY);
        setChecking(false);
        onSuccess?.();
        return;
      }
    } catch { /* ignorar */ }
    sessionStorage.removeItem(BOLD_REF_KEY);
    setChecking(false);
  };

  useEffect(() => {
    const ref = sessionStorage.getItem(BOLD_REF_KEY);
    if (ref) checkOnce(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const pollStatus = async (ref, attempts = 0) => {
    setChecking(true);
    try {
      const res = await api.get(`/payments/bold/status/${encodeURIComponent(ref)}`);
      const status = res.data?.status;
      if (status === 'APPROVED') {
        sessionStorage.removeItem(BOLD_REF_KEY);
        setChecking(false);
        onSuccess?.();
        return;
      }
      if ((status === 'PENDING' || status === 'UNKNOWN') && attempts < 15) {
        setTimeout(() => pollStatus(ref, attempts + 1), 4000);
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
        billing: {
          name: billing.name,
          email: billing.email,
          phone: billing.phone,
          address: billing.address,
          city: customerInfo?.city,
          state: customerInfo?.state,
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

      const ref = start.data.orderNumber;
      setReference(ref);
      sessionStorage.setItem(BOLD_REF_KEY, ref);

      await loadBoldLib();
      const cfg = start.data.checkout || {};
      const checkout = new window.BoldCheckout({
        orderId: String(cfg.orderId),
        currency: cfg.currency || 'COP',
        amount: String(cfg.amount),
        apiKey: cfg.apiKey,
        integritySignature: cfg.integritySignature,
        description: cfg.description,
        renderMode: cfg.renderMode || 'embedded',
        ...(cfg.redirectionUrl ? { redirectionUrl: cfg.redirectionUrl } : {}),
        ...(cfg.originUrl ? { originUrl: cfg.originUrl } : {}),
        ...(cfg.customerData ? { customerData: cfg.customerData } : {}),
        ...(cfg.billingAddress ? { billingAddress: cfg.billingAddress } : {}),
      });
      checkout.open();

      setOpened(true);
      pollStatus(ref);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error al procesar el pago.');
    } finally {
      setLoading(false);
    }
  };

  const input = 'w-full p-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-fuchsia-500';

  if (checking && !opened) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-fuchsia-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500">Verificando el estado de tu pago…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handlePay} className="space-y-5">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Pago con Glopsy</h2>
          <p className="text-xs text-slate-500">Total: {formatPrice ? formatPrice(total) : total}. Pago seguro con Bold.</p>
        </div>
        <button type="button" onClick={onBack} className="text-xs font-bold text-fuchsia-600 hover:underline cursor-pointer flex items-center gap-1">
          <ArrowLeft size={14} /> Volver
        </button>
      </div>

      {opened ? (
        <div className="space-y-4 text-sm text-slate-600 bg-fuchsia-50 border border-fuchsia-100 rounded-xl p-4">
          <p className="flex items-center gap-2 font-bold text-fuchsia-800">
            <CreditCard size={16} /> Completa el pago en la ventana de Bold.
          </p>
          <p>Si cerraste la ventana, puedes verificar el estado de tu pago.</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => reference && pollStatus(reference)}
              className="bg-white border border-fuchsia-200 text-fuchsia-700 font-bold px-4 py-2 rounded-xl text-sm cursor-pointer"
            >
              Verificar estado
            </button>
            <button
              type="button"
              onClick={() => { setOpened(false); setError(''); sessionStorage.removeItem(BOLD_REF_KEY); }}
              className="bg-white border border-slate-200 text-slate-600 font-bold px-4 py-2 rounded-xl text-sm cursor-pointer"
            >
              Reintentar
            </button>
          </div>
          {checking && <p className="text-xs text-fuchsia-700">Verificando…</p>}
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
          className="w-full text-white font-bold py-4 rounded-2xl shadow-lg text-base flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 shadow-fuchsia-600/30">
          <ShieldCheck size={20} />
          {loading ? 'Abriendo pago…' : `Pagar ${formatPrice ? formatPrice(total) : total}`}
        </button>
      )}
    </form>
  );
}
