import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, ArrowLeft, QrCode, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { boldGatewayFeeForMethod } from '../utils/pricing';

const DOC_TYPES = {
  CEDULA: 'CEDULA',
  NIT: 'NIT',
  PASAPORTE: 'PASAPORTE',
  CEDULA_EXTRANJERIA: 'CEDULA_EXTRANJERIA',
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

// expires_at viene en nanosegundos (string); lo pasamos a milisegundos.
const nanosToMs = (value) => {
  if (value == null) return null;
  try {
    return Number(BigInt(String(value)) / 1000000n);
  } catch {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n / 1e6) : null;
  }
};

export default function BoldQrPayment({
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
  const [error, setError] = useState('');
  const [qr, setQr] = useState(null); // { payload, format, reference, expiresAt }
  const [remaining, setRemaining] = useState(0);
  const [checking, setChecking] = useState(false);
  const pollRef = useRef(null);

  const fee = boldGatewayFeeForMethod(total, 'qr_breb', { currency });
  const newTotal = (Number(total) || 0) + fee.total;

  useEffect(() => {
    if (!user) return;
    setBilling((prev) => ({
      ...prev,
      name: prev.name || user.name || '',
      email: prev.email || user.email || '',
      document_type: user.document_type ? normalizeDocType(user.document_type) : prev.document_type,
      document_number: prev.document_number || user.document_number || '',
      phone: prev.phone || user.phone || '',
    }));
  }, [user]);

  // Cuenta regresiva del QR (10 min por defecto en Bold).
  useEffect(() => {
    if (!qr?.expiresAt) return;
    const tick = () => {
      const ms = nanosToMs(qr.expiresAt);
      setRemaining(ms ? Math.max(0, Math.floor((ms - Date.now()) / 1000)) : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [qr]);

  // Polling del estado mientras el QR está visible.
  useEffect(() => {
    if (!qr?.reference) return;
    let alive = true;
    let attempts = 0;
    const poll = async () => {
      if (!alive) return;
      setChecking(true);
      try {
        const res = await api.get(`/payments/bold/qr/status/${encodeURIComponent(qr.reference)}`);
        const status = res.data?.status;
        if (status === 'APPROVED') {
          alive = false;
          setChecking(false);
          onSuccess?.();
          return;
        }
        if (status === 'REJECTED' || status === 'REFUNDED') {
          alive = false;
          setChecking(false);
          setError(status === 'REJECTED' ? 'El pago fue rechazado.' : 'El pago fue reversado.');
          return;
        }
      } catch {
        // seguimos intentando
      }
      setChecking(false);
      attempts += 1;
      if (alive && attempts < 90) {
        pollRef.current = setTimeout(poll, 4000);
      }
    };
    pollRef.current = setTimeout(poll, 3000);
    return () => {
      alive = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [qr?.reference]);

  const handleGenerate = async (e) => {
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
      const res = await api.post('/payments/bold/qr/start', {
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
        payment_method: 'qr_breb',
        gateway_fee: { base: fee.base, iva: fee.iva, total: fee.total },
        billing: {
          name: billing.name,
          email: billing.email,
          phone: billing.phone,
          address: billing.address,
          documentType: DOC_TYPES[billing.document_type] || 'CEDULA',
          documentNumber: billing.document_number,
        },
      });

      if (!res.data?.ok) {
        const msg = {
          bold_no_configurado: 'Aún no se ha configurado el cobro por QR Bre-B.',
          bold_intent_error: 'No fue posible crear la intención de pago.',
          bold_qr_error: 'No fue posible generar el QR Bre-B.',
        }[res.data?.message] || res.data?.message;
        setError(msg || 'No fue posible generar el QR.');
        return;
      }

      setQr({
        payload: res.data.qr?.payload,
        format: res.data.qr?.format || 'BOLD_BASE64',
        reference: res.data.orderNumber,
        expiresAt: res.data.qr?.expiresAt,
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error al generar el QR.');
    } finally {
      setLoading(false);
    }
  };

  const input = 'w-full p-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:border-blue-500';
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const qrSrc = qr && (qr.format === 'BOLD_BASE64' || qr.format === 'PLAIN_BASE64') && qr.payload
    ? `data:image/png;base64,${qr.payload}`
    : null;

  return (
    <form onSubmit={handleGenerate} className="space-y-5">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <QrCode size={20} className="text-blue-600" /> Pago con QR Bre-B
          </h2>
          <p className="text-xs text-slate-500">
            Paga desde la app de cualquier banco o billetera. La tarifa se agrega al total.
          </p>
        </div>
        <button type="button" onClick={onBack} className="text-xs font-bold text-fuchsia-600 hover:underline cursor-pointer flex items-center gap-1">
          <ArrowLeft size={14} /> Volver
        </button>
      </div>

      {!qr && (
        <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-slate-700">Tarifa de pago (QR Bre-B)</span>
            <strong className="text-slate-900">{formatPrice ? formatPrice(fee.total) : fee.total}</strong>
          </div>
          <div className="flex items-center justify-between text-sm font-extrabold text-slate-900">
            <span>Total a pagar</span>
            <span className="text-base">{formatPrice ? formatPrice(newTotal) : newTotal}</span>
          </div>
        </div>
      )}

      {qr ? (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-center space-y-3">
            <p className="text-sm font-bold text-blue-800">Escanea este código con tu app bancaria</p>
            {qrSrc ? (
              <img src={qrSrc} alt="QR Bre-B" className="mx-auto w-56 h-56 object-contain bg-white rounded-xl border border-blue-100 p-2" />
            ) : (
              <p className="text-xs text-slate-500 break-all bg-white rounded-xl border border-blue-100 p-3">{qr.payload}</p>
            )}
            <p className="text-xs text-slate-600">
              {remaining > 0 ? <>El código vence en <strong>{mm}:{ss}</strong></> : 'El código expiró.'}
            </p>
            {checking && <p className="text-xs text-blue-700">Verificando el pago…</p>}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setQr(null); setError(''); }}
              className="bg-white border border-slate-200 text-slate-600 font-bold px-4 py-2 rounded-xl text-sm cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw size={14} /> Generar otro
            </button>
          </div>
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
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">{error}</p>}

      {!qr && (
        <button type="submit" disabled={loading}
          className="w-full text-white font-bold py-4 rounded-2xl shadow-lg text-base flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
          <QrCode size={20} />
          {loading ? 'Generando QR…' : `Generar QR y pagar ${formatPrice ? formatPrice(newTotal) : newTotal}`}
        </button>
      )}

      <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
        <ShieldCheck size={12} /> Pago procesado de forma segura por Bold (Bre-B).
      </p>
    </form>
  );
}
