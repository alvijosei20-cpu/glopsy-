import { Percent } from 'lucide-react';

const PAIS_NOMBRE = { CO: 'Colombia', VE: 'Venezuela' };

export default function IvaNoticeCard({ porcentaje, paisCodigo }) {
  const nombre = PAIS_NOMBRE[String(paisCodigo || '').toUpperCase()] || 'tu país';
  return (
    <div
      role="note"
      style={{
        background: '#fdf4ff',
        border: '1px solid #e9d5ff',
        borderRadius: '10px',
        padding: '1.2rem',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          background: '#fae8ff',
          color: '#a21caf',
          borderRadius: '8px',
          padding: '8px',
          display: 'flex',
          flexShrink: 0,
        }}
      >
        <Percent size={18} />
      </div>
      <div>
        <div style={{ fontWeight: 700, color: '#6b21a8', fontSize: '0.95rem' }}>
          IVA {porcentaje}% — {nombre}
        </div>
        <p style={{ margin: '4px 0 0', color: '#7e22ce', fontSize: '0.85rem', lineHeight: 1.5 }}>
          Debes agregar al costo total tu IVA correspondiente.
        </p>
      </div>
    </div>
  );
}
