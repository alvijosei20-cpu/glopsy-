import { Percent, CreditCard, Store, ReceiptText } from 'lucide-react';

const money = (value, currency) => {
  const n = Number(value || 0);
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: currency || 'COP', maximumFractionDigits: 0 }).format(n);
  } catch {
    return `$${Math.round(n)}`;
  }
};

export default function PriceBreakdown({ breakdown, currency = 'COP' }) {
  if (!breakdown) return null;
  const {
    price, ivaPct, iva, glopsyPct, glopsy, gateway, gatewayBase, gatewayIva, total,
  } = breakdown;

  const rowStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 0', fontSize: '0.9rem', color: '#334155', gap: '8px',
  };
  const labelStyle = { display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 };
  const pctTag = (txt) => (
    <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: '999px', padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {txt}
    </span>
  );

  return (
    <div style={{ background: '#fdf4ff', border: '1px solid #f5d0fe', borderRadius: '12px', padding: '1.1rem 1.2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#701a75', marginBottom: '8px' }}>
        <ReceiptText size={16} /> Cálculo del precio a publicar
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}><Store size={14} color="#7e22ce" /> Precio de venta (proveedor)</span>
        <strong style={{ whiteSpace: 'nowrap' }}>{money(price, currency)}</strong>
      </div>

      {ivaPct > 0 && (
        <div style={rowStyle}>
          <span style={labelStyle}><Percent size={14} color="#7e22ce" /> IVA {pctTag(`${ivaPct}%`)}</span>
          <strong style={{ whiteSpace: 'nowrap' }}>{money(iva, currency)}</strong>
        </div>
      )}

      <div style={rowStyle}>
        <span style={labelStyle}><Store size={14} color="#7e22ce" /> Comisión Glopsy {pctTag(`${glopsyPct}%`)}</span>
        <strong style={{ whiteSpace: 'nowrap' }}>{money(glopsy, currency)}</strong>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>
          <CreditCard size={14} color="#7e22ce" /> Comisión {gateway?.label || 'pasarela'}{' '}
          {pctTag(`${gateway?.percent || 0}% + ${money(gateway?.fixed || 0, currency)}${gateway?.ivaOnFee ? ` + IVA ${gateway.ivaOnFee}%` : ''}`)}
        </span>
        <strong style={{ whiteSpace: 'nowrap' }}>{money(gatewayBase + gatewayIva, currency)}</strong>
      </div>

      <div style={{ borderTop: '1px dashed #d8b4fe', marginTop: '8px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, color: '#6b21a8', fontSize: '0.95rem' }}>Precio total (se publica)</span>
        <span style={{ fontWeight: 900, color: '#6b21a8', fontSize: '1.15rem', whiteSpace: 'nowrap' }}>{money(total, currency)}</span>
      </div>
    </div>
  );
}
