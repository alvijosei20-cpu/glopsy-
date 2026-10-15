import { useEffect, useState } from 'react';
import {
  Wallet, CheckCircle2, Loader2, ArrowLeft, ShieldAlert, RefreshCcw, Send,
  TrendingUp, Download, Clock, Lock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import '../panel/panel.css';
import './market.css';
import './liquidaciones.css';

const fmt = (n) => Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n, moneda = 'COP') => `${moneda} ${fmt(n)}`;

const ESTADO_LABEL = {
  pendiente: 'Pendiente',
  retenido: 'En retención',
  enviando: 'Enviando…',
  pagado: 'Pagada',
  fallido: 'Fallida',
};

const ESTADO_STYLE = {
  pendiente: { background: '#fef3c7', color: '#b45309' },
  retenido: { background: '#fee2e2', color: '#b91c1c' },
  enviando: { background: '#dbeafe', color: '#1d4ed8' },
  pagado: { background: '#d1fae5', color: '#047857' },
  fallido: { background: '#fee2e2', color: '#b91c1c' },
};

const MOTIVO_LABEL = {
  verificacion_pendiente: 'Pendiente de verificación de disputas en la pasarela. No se liberan fondos.',
  verificacion_fallida: 'No se pudo verificar en la pasarela si hay disputas. No se liberan fondos.',
  disputa: 'Hay una disputa o contracargo abierto. No se liberan fondos hasta resolverse.',
  envio_fallido: 'La pasarela rechazó la dispersión.',
  envio_manual_pendiente: 'Verificación limpia: el sistema ordenó la dispersión.',
  balance_error: 'No se pudo consultar el saldo en Bold para conciliar. Se congeló el retiro.',
  descuadre: 'Descuadre al conciliar con Bold. Se congelaron los retiros hasta revisar.',
};

export default function Liquidaciones() {
  const navigate = useNavigate();
  const { tienda } = useAuth();
  const moneda = tienda?.moneda || 'COP';

  const [payouts, setPayouts] = useState([]);
  const [control, setControl] = useState(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [exporting, setExporting] = useState(false);
  const [saldo, setSaldo] = useState(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [referencia, setReferencia] = useState({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadBalances = async () => {
    try {
      const { data } = await api.get('/tienda/payouts/balance');
      setSaldo(data);
    } catch {
      // Bloque de saldos opcional.
    }
  };

  const loadControl = async () => {
    try {
      const params = { moneda };
      if (desde) params.from = desde;
      if (hasta) params.to = hasta;
      const { data } = await api.get('/tienda/ventas-control', { params });
      setControl(data);
    } catch {
      // Control de ventas opcional.
    }
  };

  const load = async (estado) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/tienda/payouts', { params: estado ? { estado } : {} });
      setPayouts(data?.payouts || []);
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible cargar las liquidaciones.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBalances();
    loadControl();
    load(filter || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, moneda, desde, hasta]);

  const run = async (action, payout) => {
    setBusyId(payout.id);
    setNotice('');
    setError('');
    try {
      const { data } = await api.post(`/tienda/payouts/${payout.id}/${action}`, {
        referencia: referencia[payout.id] || null,
      });
      setNotice(data?.message || (action === 'pay' ? 'Liberación procesada.' : 'Liquidación confirmada.'));
      await load(filter || undefined);
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible procesar la liquidación.');
      if (action === 'pay') await load(filter || undefined);
    } finally {
      setBusyId(null);
    }
  };

  const aprobar = (p) => run('pay', p);
  const confirmar = (p) => run('confirm', p);

  const exportarLibro = async () => {
    setExporting(true);
    setError('');
    try {
      const params = { moneda };
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;
      const { data } = await api.get('/tienda/reportes/libro-contable.csv', { params, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `libro-contable-${hasta || new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice('Libro contable descargado.');
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible generar el libro contable.');
    } finally {
      setExporting(false);
    }
  };

  const totalPendiente = payouts
    .filter((p) => p.estado === 'pendiente' || p.estado === 'enviando')
    .reduce((a, p) => a + Number(p.total || 0), 0);
  const totalRetenido = payouts
    .filter((p) => p.estado === 'retenido')
    .reduce((a, p) => a + Number(p.total || 0), 0);

  const stats = [
    { label: 'Por liberar', value: totalPendiente, icon: Clock, accent: '#7e22ce' },
    { label: 'En retención', value: totalRetenido, icon: Lock, accent: '#b91c1c' },
    { label: 'Ledger (diferido + disponible)', value: (saldo?.ledger?.diferido || 0) + (saldo?.ledger?.disponible || 0), icon: Wallet, accent: '#4c1d95' },
    { label: 'Congelado en liquidaciones', value: saldo?.ledger?.retenidoEnLiquidaciones || 0, icon: ShieldAlert, accent: '#b45309' },
  ];

  return (
    <section className="panel" aria-labelledby="payouts-title">
      <header className="liq-head liq-stagger">
        <div className="market__intro">
          <p className="panel__eyebrow">Panel de control</p>
          <h1 id="payouts-title">Liquidaciones</h1>
          <p className="market__subtitle">Saldos, control de lo vendido y dispersión a proveedores.</p>
        </div>
        <button type="button" className="liq-back" onClick={() => navigate('/market')}>
          <ArrowLeft size={16} /> Mi tienda
        </button>
      </header>

      {notice && <div className="panel__notice" role="status">{notice}</div>}
      {error && <div className="panel__error" role="alert">{error}</div>}

      <div className="liq-stats">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <article key={s.label} className="liq-stat liq-stagger" style={{ animationDelay: `${i * 70}ms` }}>
              <div className="liq-stat__icon" style={{ color: s.accent, background: `${s.accent}14` }}>
                <Icon size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="liq-stat__label">{s.label}</div>
                <div className="liq-stat__value" style={{ color: s.accent }}>{money(s.value, moneda)}</div>
              </div>
            </article>
          );
        })}
      </div>

      {saldo && (
        <div className="liq-subgrid liq-stagger" style={{ animationDelay: '280ms', marginBottom: '1.25rem' }}>
          <div className="liq-mini">
            <div className="liq-mini__label">Bold · Disponible</div>
            <div className="liq-mini__value">{saldo.bold?.configured ? money(saldo.bold.available, moneda) : 'Sin consultar'}</div>
          </div>
          <div className="liq-mini">
            <div className="liq-mini__label">Bold · Diferido</div>
            <div className="liq-mini__value">{saldo.bold?.configured ? money(saldo.bold.deferred, moneda) : '—'}</div>
          </div>
          <div className="liq-mini">
            <div className="liq-mini__label">Bold · Congelado/Disputas</div>
            <div className="liq-mini__value" style={{ color: '#b91c1c' }}>
              {saldo.bold?.configured ? money((saldo.bold.frozen || 0) + (saldo.bold.dispute || 0), moneda) : '—'}
            </div>
          </div>
        </div>
      )}

      <div className="liq-toolbar liq-stagger" style={{ animationDelay: '340ms' }}>
        <div className="liq-field">
          <label>Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="liq-field">
          <label>Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <button type="button" className="liq-btn" onClick={exportarLibro} disabled={exporting}>
          {exporting ? <Loader2 size={18} className="spin" /> : <Download size={18} />}
          {exporting ? 'Generando…' : 'Exportar libro contable (CSV)'}
        </button>
      </div>

      {control && control.totals && control.totals.lines > 0 && (
        <section className="market__card liq-stagger" style={{ animationDelay: '400ms', padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h2 className="market__card-title" style={{ marginBottom: '0.75rem' }}>
            <TrendingUp size={18} /> Control de lo vendido
          </h2>
          <div className="liq-subgrid" style={{ marginBottom: '1rem' }}>
            {[
              ['Costo base', control.totals.baseCost, '#0f172a'],
              ['Costo de venta', control.totals.saleAmount, '#0f172a'],
              ['Tarifa Glopsy', control.totals.glopsyFee, '#7e22ce'],
              ['Tarifa pasarela', control.totals.gatewayFee, '#0369a1'],
              ['IVA', control.totals.iva, '#b45309'],
              ['Neto proveedor', control.totals.providerNet, '#047857'],
            ].map(([label, value, color]) => (
              <div key={label} className="liq-mini">
                <div className="liq-mini__label">{label}</div>
                <div className="liq-mini__value" style={{ color }}>{money(value, control.moneda)}</div>
              </div>
            ))}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="liq-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th className="num">Costo base</th>
                  <th className="num">Venta</th>
                  <th className="num">Glopsy</th>
                  <th className="num">Pasarela</th>
                  <th className="num">IVA</th>
                  <th className="num">Neto</th>
                </tr>
              </thead>
              <tbody>
                {control.sales.map((s, i) => (
                  <tr key={s.id} className="liq-stagger" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                    <td>{s.orderNumber || `Orden ${s.orderId}`}</td>
                    <td>{s.cliente || '—'}</td>
                    <td className="num">{fmt(s.baseCost)}</td>
                    <td className="num">{fmt(s.saleAmount)}</td>
                    <td className="num">{fmt(s.glopsyFee)}</td>
                    <td className="num">{fmt(s.gatewayFee)}</td>
                    <td className="num">{fmt(s.iva)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{fmt(s.providerNet)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="liq-toolbar liq-stagger" style={{ animationDelay: '440ms', marginTop: 0 }}>
        <div className="liq-field">
          <label>Filtrar liquidaciones</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Todas</option>
            <option value="pendiente">Pendientes</option>
            <option value="retenido">En retención</option>
            <option value="enviando">Enviando</option>
            <option value="pagado">Pagadas</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
          <Loader2 size={16} className="spin" /> Cargando liquidaciones…
        </p>
      ) : payouts.length === 0 ? (
        <div className="market__card liq-stagger" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
          <Wallet size={28} style={{ margin: '0 auto 0.5rem' }} />
          <p style={{ margin: 0, fontWeight: 600 }}>Aún no hay liquidaciones.</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            Aparecerán aquí cuando haya ventas entregadas y fuera de la ventana de retención.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {payouts.map((p, i) => (
            <article key={p.id} className="market__card liq-stagger" style={{ padding: '1.25rem', animationDelay: `${Math.min(i, 12) * 50}ms` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
                    {(p.provider_ref || '').replace(/^tienda:/, 'Mi tienda')}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Creada: {new Date(p.created_at).toLocaleString('es-CO')}
                    {p.paid_at ? ` · Pagada: ${new Date(p.paid_at).toLocaleString('es-CO')}` : ''}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {p.moneda} · #{p.id}{p.referencia ? ` · Ref: ${p.referencia}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>{fmt(p.total)}</div>
                  <span style={{
                    display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '0.5rem',
                    background: (ESTADO_STYLE[p.estado] || ESTADO_STYLE.pendiente).background,
                    color: (ESTADO_STYLE[p.estado] || ESTADO_STYLE.pendiente).color,
                  }}>
                    {ESTADO_LABEL[p.estado] || p.estado}
                  </span>
                </div>
              </div>

              {p.estado === 'retenido' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem',
                  background: '#fff1f2', border: '1px solid #fecaca', borderRadius: '0.6rem', padding: '0.6rem 0.8rem',
                  fontSize: '0.82rem', color: '#b91c1c',
                }}>
                  <ShieldAlert size={15} />
                  <span>{MOTIVO_LABEL[p.metadata?.motivo] || p.metadata?.detalle || 'Fondos retenidos.'}</span>
                </div>
              )}

              {p.items && p.items.length > 0 && (
                <table className="liq-table" style={{ marginTop: '1rem' }}>
                  <thead>
                    <tr>
                      <th>Factura</th>
                      <th>Cliente</th>
                      <th>IVA</th>
                      <th className="num">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.items.map((it) => (
                      <tr key={it.orderId}>
                        <td>{it.orderNumber || `Orden ${it.orderId}`}</td>
                        <td>{it.cliente}</td>
                        <td>
                          {it.es_exportacion ? (
                            <span title="Exportación: excluida de IVA (art. 481 E.T.)" style={{ fontSize: '0.7rem', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '0.15rem 0.45rem', borderRadius: '0.4rem' }}>
                              EXP. 0%
                            </span>
                          ) : '19%'}
                        </td>
                        <td className="num">{fmt(it.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {p.estado === 'pendiente' && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={referencia[p.id] || ''}
                    onChange={(e) => setReferencia((r) => ({ ...r, [p.id]: e.target.value }))}
                    placeholder="Referencia interna (opcional)"
                    maxLength={200}
                    style={{ flex: '1 1 220px', padding: '0.6rem 0.9rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                  />
                  <button type="button" className="liq-btn" onClick={() => aprobar(p)} disabled={busyId === p.id}>
                    {busyId === p.id ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                    {busyId === p.id ? 'Procesando…' : 'Aprobar liberación'}
                  </button>
                </div>
              )}

              {p.estado === 'retenido' && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem', alignItems: 'center' }}>
                  <button type="button" className="liq-btn" onClick={() => aprobar(p)} disabled={busyId === p.id}>
                    {busyId === p.id ? <Loader2 size={18} className="spin" /> : <RefreshCcw size={18} />}
                    {busyId === p.id ? 'Verificando…' : 'Reintentar verificación'}
                  </button>
                </div>
              )}

              {p.estado === 'enviando' && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem', alignItems: 'center' }}>
                  <button type="button" className="liq-btn" onClick={() => confirmar(p)} disabled={busyId === p.id}>
                    {busyId === p.id ? <Loader2 size={18} className="spin" /> : <CheckCircle2 size={18} />}
                    {busyId === p.id ? 'Confirmando…' : 'Confirmar pago entregado'}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
