import React, { useEffect, useState } from 'react';
import { ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';
import api from '../services/api';

const EPAYCO_REF_KEY = 'glopsy_epayco_ref';
const EPAYCO_LIB_SRC = 'https://checkout.epayco.co/checkout-v2.js';

const loadEpaycoLib = () => new Promise((resolve, reject) => {
  if (window.ePayco) return resolve();
  const wait = () => {
    let n = 0;
    const t = setInterval(() => {
      if (window.ePayco) { clearInterval(t); resolve(); }
      else if (++n > 60) { clearInterval(t); reject(new Error('No se pudo cargar ePayco.')); }
    }, 100);
  };
  const existing = document.querySelector('script[src*="checkout-v2.js"]');
  if (existing) return wait();
  const js = document.createElement('script');
  js.src = EPAYCO_LIB_SRC;
  js.onload = wait;
  js.onerror = () => reject(new Error('No se pudo cargar ePayco.'));
  document.head.appendChild(js);
});

export default function EpaycoPayment({
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
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const pollStatus = async (ref, attempts = 0) => {
    setChecking(true);
    try {
      const res = await api.get(`/payments/epayco/status/${encodeURIComponent(ref)}`);
      const status = res.data?.status;
      if (status === 'APPROVED') { sessionStorage.removeItem(EPAYCO_REF_KEY); setChecking(false); onSuccess?.(); return; }
      if (status === 'REJECTED') { sessionStorage.removeItem(EPAYCO_REF_KEY); setChecking(false); setError('El pago fue rechazado.'); return; }
    } catch { /* reintentar */ }
    if (attempts < 20) setTimeout(() => pollStatus(ref, attempts + 1), 3000);
    else setChecking(false);
  };

  useEffect(() => {
    const ref = sessionStorage.getItem(EPAYCO_REF_KEY);
    if (ref) pollStatus(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/payments/epayco/checkout', {
        items,
        shipping_cost: shippingCost,
        shipping_payload: shippingPayload,
        customer_info: customerInfo,
        guestHash,
        billing: {
          email: user?.email || customerInfo?.email || undefined,
          name: user?.name || undefined,
          typeDoc: user?.document_type || undefined,
          numberDoc: user?.document_number || undefined,
          callingCode: '+57',
          mobilePhone: customerInfo?.telefono || undefined,
        },
      });
      if (!res.data?.ok || !res.data.sessionId) {
        setError(res.data?.message || 'No se pudo iniciar el pago con ePayco.');
        setLoading(false);
        return;
      }
      const { sessionId, orderNumber } = res.data;
      sessionStorage.setItem(EPAYCO_REF_KEY, orderNumber);
      await loadEpaycoLib();
      const checkout = window.ePayco.checkout.configure({ sessionId, type: 'onpage', test: false });
      checkout.setHooks({
        onResponse: (response) => {
          const st = response?.x_response || response?.data?.x_response;
          if (st === 'Aceptada') onSuccess?.();
          else pollStatus(orderNumber);
        },
        onClosed: () => pollStatus(orderNumber),
        onErrors: () => setError('Ocurrió un error en el checkout de ePayco.'),
      });
      checkout.open();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error al abrir ePayco.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
      <button type="button" onClick={onBack} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Volver
      </button>
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={18} className="text-emerald-600" />
        <h2 className="font-extrabold text-slate-900">Pago con ePayco</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">Paga seguro con tarjeta, PSE, Nequi, Daviplata y más.</p>
      <div className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3 mb-4">
        <span className="text-xs font-bold text-slate-500">Total a pagar</span>
        <span className="text-lg font-extrabold text-slate-900">{formatPrice ? formatPrice(total) : total}</span>
      </div>
      {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}
      {checking && (
        <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
          <Loader2 size={13} className="animate-spin" /> Verificando pago…
        </p>
      )}
      <button
        type="button"
        onClick={openCheckout}
        disabled={loading}
        className="w-full bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-fuchsia-600/30 disabled:opacity-50"
      >
        {loading ? 'Abriendo ePayco…' : 'Pagar con ePayco'}
      </button>
    </div>
  );
}
