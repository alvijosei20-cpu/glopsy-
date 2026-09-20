import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowLeft, CreditCard, Building2 } from 'lucide-react';
import api from '../services/api';

const BOLD_REF_KEY = 'glopsy_bold_ref';

const deviceFingerprint = () => {
  const nav = window.navigator;
  return {
    device_type: /Mobi|Android/i.test(nav.userAgent || '') ? 'MOBILE' : 'DESKTOP',
    os: nav.platform || '',
    model: '',
    browser: nav.userAgent || '',
    java_enabled: false,
    language: nav.language || 'es-CO',
    color_depth: window.screen?.colorDepth || 24,
    screen_height: window.screen?.height || 0,
    screen_width: window.screen?.width || 0,
    time_zone_offset: new Date().getTimezoneOffset(),
  };
};

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
  const [method, setMethod] = useState('CREDIT_CARD');
  const [card, setCard] = useState({ number: '', holder: '', month: '', year: '', cvc: '', installments: 1 });
  const [payer, setPayer] = useState({
    name: user?.name || '',
    phone: '',
    email: user?.email || '',
    document_type: 'CEDULA',
    document_number: '',
  });
  const [banks, setBanks] = useState([]);
  const [bank, setBank] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  // Al volver de 3DS/PSE el banco redirige al checkout con la referencia guardada.
  useEffect(() => {
    const ref = sessionStorage.getItem(BOLD_REF_KEY);
    if (ref) pollStatus(ref);
  }, []);

  useEffect(() => {
    if (method !== 'PSE' || banks.length > 0) return;
    api.get('/payments/bold/pse/banks')
      .then((res) => setBanks(res.data?.banks || []))
      .catch(() => setError('No fue posible cargar los bancos PSE.'));
  }, [method]);

  const pollStatus = async (reference, attempts = 0) => {
    setChecking(true);
    try {
      const res = await api.get(`/payments/bold/status/${encodeURIComponent(reference)}`);
      const status = res.data?.status?.status;
      if (status === 'APPROVED') {
        sessionStorage.removeItem(BOLD_REF_KEY);
        setChecking(false);
        onSuccess?.();
        return;
      }
      if ((status === 'PROCESSING' || status === 'PENDING') && attempts < 10) {
        setTimeout(() => pollStatus(reference, attempts + 1), 3000);
        return;
      }
      sessionStorage.removeItem(BOLD_REF_KEY);
      setChecking(false);
      setError(status === 'REJECTED' ? 'El pago fue rechazado.' : 'El pago quedó pendiente. Revisa tu correo o reintenta.');
    } catch {
      setChecking(false);
      setError('No fue posible verificar el pago.');
    }
  };

  const handlePay = async (e) => {
    e.preventDefault();
    setError('');

    if (method === 'CREDIT_CARD') {
      const digits = card.number.replace(/\D/g, '');
      if (digits.length < 13 || !card.holder.trim() || !card.month || !card.year || card.cvc.length < 3) {
        setError('Completa los datos de la tarjeta.');
        return;
      }
    }
    if (method === 'PSE' && !bank) {
      setError('Selecciona tu banco.');
      return;
    }
    if (!payer.document_number.trim() || !payer.name.trim()) {
      setError('Completa tu nombre y número de documento.');
      return;
    }

    setLoading(true);
    try {
      const fp = deviceFingerprint();
      const start = await api.post('/payments/bold/checkout', {
        items,
        shipping_cost: shippingCost,
        shipping_payload: shippingPayload,
        customer_info: { ...customerInfo, customer_name: payer.name, email: payer.email },
        guestHash,
        currency,
        callback_url: `${window.location.origin}/checkout`,
        device_fingerprint: fp,
      });
      if (!start.data?.ok) {
        setError(start.data?.message || 'No fue posible iniciar el pago.');
        return;
      }
      const reference = start.data.orderNumber;
      sessionStorage.setItem(BOLD_REF_KEY, reference);

      const payment_method = method === 'PSE'
        ? { name: 'PSE', bank_code: bank.bank_code, bank_name: bank.bank_name }
        : {
            name: 'CREDIT_CARD',
            card_number: card.number.replace(/\D/g, ''),
            cardholder_name: card.holder.trim(),
            expiration_month: String(card.month),
            expiration_year: String(card.year),
            installments: Number(card.installments) || 1,
            cvc: card.cvc,
          };

      const pay = await api.post('/payments/bold/pay', {
        reference,
        payer: { person_type: 'NATURAL_PERSON', ...payer },
        payment_method,
        device_fingerprint: fp,
      });

      const attempt = pay.data?.attempt;
      if (attempt?.status === 'APPROVED') {
        sessionStorage.removeItem(BOLD_REF_KEY);
        onSuccess?.();
        return;
      }
      if (attempt?.next_actions?.redirect_url) {
        window.location.href = attempt.next_actions.redirect_url;
        return;
      }
      setError('El pago no fue aprobado. Intenta con otro medio.');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al procesar el pago.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
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
          <h2 className="text-xl font-bold text-slate-900">Pago con Bold</h2>
          <p className="text-xs text-slate-500">Paga sin salir de Glopsy. Total: {formatPrice ? formatPrice(total) : total}</p>
        </div>
        <button type="button" onClick={onBack} className="text-xs font-bold text-fuchsia-600 hover:underline cursor-pointer flex items-center gap-1">
          <ArrowLeft size={14} /> Volver
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setMethod('CREDIT_CARD')}
          className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 cursor-pointer ${method === 'CREDIT_CARD' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>
          <CreditCard size={16} /> Tarjeta
        </button>
        <button type="button" onClick={() => setMethod('PSE')}
          className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 cursor-pointer ${method === 'PSE' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>
          <Building2 size={16} /> PSE
        </button>
      </div>

      {method === 'CREDIT_CARD' ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Número de tarjeta</label>
            <input className={input} inputMode="numeric" maxLength={19} value={card.number}
              onChange={(e) => setCard({ ...card, number: e.target.value })} placeholder="4111 1111 1111 1111" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">Titular</label>
            <input className={input} value={card.holder}
              onChange={(e) => setCard({ ...card, holder: e.target.value })} placeholder="Como aparece en la tarjeta" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Vencimiento (MM)</label>
            <input className={input} inputMode="numeric" maxLength={2} value={card.month}
              onChange={(e) => setCard({ ...card, month: e.target.value })} placeholder="12" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Año (AAAA)</label>
            <input className={input} inputMode="numeric" maxLength={4} value={card.year}
              onChange={(e) => setCard({ ...card, year: e.target.value })} placeholder="2030" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">CVC</label>
            <input className={input} inputMode="numeric" maxLength={4} value={card.cvc}
              onChange={(e) => setCard({ ...card, cvc: e.target.value })} placeholder="123" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Cuotas</label>
            <input className={input} inputMode="numeric" value={card.installments}
              onChange={(e) => setCard({ ...card, installments: e.target.value })} />
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Banco</label>
          <select className={input} value={bank?.bank_code || ''}
            onChange={(e) => setBank(banks.find((b) => String(b.bank_code) === e.target.value) || null)}>
            <option value="">Selecciona tu banco</option>
            {banks.map((b) => (
              <option key={b.bank_code} value={b.bank_code}>{b.bank_name}</option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400 mt-1">PSE te llevará al banco para autorizar y volverá automáticamente.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-700 mb-1">Nombre completo</label>
          <input className={input} value={payer.name} onChange={(e) => setPayer({ ...payer, name: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de documento</label>
          <select className={input} value={payer.document_type} onChange={(e) => setPayer({ ...payer, document_type: e.target.value })}>
            <option value="CEDULA">Cédula</option>
            <option value="NIT">NIT</option>
            <option value="PASAPORTE">Pasaporte</option>
            <option value="CEDULA_EXTRANJERIA">Cédula extranjería</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Número de documento</label>
          <input className={input} value={payer.document_number} onChange={(e) => setPayer({ ...payer, document_number: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono</label>
          <input className={input} value={payer.phone} onChange={(e) => setPayer({ ...payer, phone: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Correo</label>
          <input className={input} type="email" value={payer.email} onChange={(e) => setPayer({ ...payer, email: e.target.value })} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</p>}

      <button type="submit" disabled={loading}
        className="w-full text-white font-bold py-4 rounded-2xl shadow-lg text-base flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
        <ShieldCheck size={20} />
        {loading ? 'Procesando pago…' : `Pagar ${formatPrice ? formatPrice(total) : total}`}
      </button>
    </form>
  );
}
