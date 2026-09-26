import { useEffect, useState } from 'react';
import { Wallet, CheckCircle2, Loader2, ArrowLeft, ShieldAlert, RefreshCcw, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import '../panel/panel.css';
import './market.css';

const fmt = (n) => Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const [payouts, setPayouts] = useState([]);
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
      // El bloque principal de saldos es opcional.
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
    load(filter || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

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

  const totalPendiente = payouts
    .filter((p) => p.estado === 'pendiente' || p.estado === 'enviando')
    .reduce((a, p) => a + Number(p.total || 0), 0);
  const totalRetenido = payouts
    .filter((p) => p.estado === 'retenido')
    .reduce((a, p) => a + Number(p.total || 0), 0);

  return (
    <section className="panel" aria-labelledby="payouts-title">
      <div className="market__top">
        <div className="market__intro">
          <p className="panel__eyebrow">Panel de control</p>
          <h1 id="payouts-title">Liquidaciones</h1>
          <p className="market__subtitle">
            Saldos acumulados por ventas entregadas. Cuando transfieras al proveedor, márcalo como pagado.
          </p>
        </div>
        <button
          className="market__visit"
          type="button"
          onClick={() => navigate('/market')}
          style={{ cursor: 'pointer', border: 'none' }}
        >
          <ArrowLeft size={16} /> Volver a Mi tienda
        </button>
      </div>

      {notice && <div className="panel__notice" role="status">{notice}</div>}
      {error && <div className="panel__error" role="alert">{error}</div>}

      <div className="payout-summary" style={{
        display: 'flex', gap: '1rem', flexWrap: 'wrap', margin: '1rem 0',
      }}>
        <div style={{
          background: '#7e22ce', color: 'white', borderRadius: '1rem', padding: '1rem 1.5rem', flex: '1 1 220px',
        }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>Pendiente por liberar</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>$ {fmt(totalPendiente)}</div>
        </div>
        <div style={{
          background: '#b91c1c', color: 'white', borderRadius: '1rem', padding: '1rem 1.5rem', flex: '1 1 220px',
        }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>En retención (disputas/verif.)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>$ {fmt(totalRetenido)}</div>
        </div>
      </div>

      {saldo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', margin: '1rem 0' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '1rem', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Bold · Disponible</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
              {saldo.bold?.configured ? `$ ${fmt(saldo.bold.available)}` : 'Sin consultar'}
            </div>
            {!saldo.bold?.configured && <div style={{ fontSize: '0.7rem', color: '#b45309' }}>Configura BOLD_BALANCE_URL</div>}
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '1rem', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Bold · Diferido</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{saldo.bold?.configured ? `$ ${fmt(saldo.bold.deferred)}` : '—'}</div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '1rem', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Bold · Congelado/Disputas</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b91c1c' }}>
              {saldo.bold?.configured ? `$ ${fmt((saldo.bold.frozen || 0) + (saldo.bold.dispute || 0))}` : '—'}
            </div>
          </div>
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '1rem', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#6d28d9', fontWeight: 700 }}>Ledger · Comisión/recaudo (diferido + disponible)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4c1d95' }}>$ {fmt((saldo.ledger?.diferido || 0) + (saldo.ledger?.disponible || 0))}</div>
          </div>
          <div style={{ background: '#fff1f2', border: '1px solid #fecaca', borderRadius: '1rem', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 700 }}>En liquidaciones retenidas (congelado)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b91c1c' }}>$ {fmt(saldo.ledger?.retenidoEnLiquidaciones || 0)}</div>
          </div>
        </div>
      )}

      <div style={{ margin: '1rem 0 1.5rem' }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{
          padding: '0.6rem 0.9rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: 'white',
        }}>
          <option value="">Todas</option>
          <option value="pendiente">Pendientes</option>
          <option value="retenido">En retención</option>
          <option value="enviando">Enviando</option>
          <option value="pagado">Pagadas</option>
        </select>
      </div>

      {loading ? (
        <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
          <Loader2 size={16} className="spin" /> Cargando liquidaciones…
        </p>
      ) : payouts.length === 0 ? (
        <div className="market__card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
          <Wallet size={28} style={{ margin: '0 auto 0.5rem' }} />
          <p style={{ margin: 0, fontWeight: 600 }}>Aún no hay liquidaciones.</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            Aparecerán aquí cuando haya ventas entregadas y fuera de la ventana de retención.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {payouts.map((p) => (
            <article key={p.id} className="market__card" style={{ padding: '1.25rem' }}>
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
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ color: '#64748b', textAlign: 'left', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.4rem 0.5rem' }}>Factura</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}>Cliente</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}>IVA</th>
                      <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.items.map((it) => (
                      <tr key={it.orderId} style={{ borderTop: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{it.orderNumber || `Orden ${it.orderId}`}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{it.cliente}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          {it.es_exportacion ? (
                            <span title="Exportación: excluida de IVA (art. 481 E.T.)" style={{ fontSize: '0.7rem', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '0.15rem 0.45rem', borderRadius: '0.4rem' }}>
                              EXP. 0%
                            </span>
                          ) : '19%'}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>{fmt(it.monto)}</td>
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
                  <button type="button" className="action-button" onClick={() => aprobar(p)} disabled={busyId === p.id}>
                    {busyId === p.id ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                    {busyId === p.id ? 'Procesando…' : 'Aprobar liberación'}
                  </button>
                </div>
              )}

              {p.estado === 'retenido' && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem', alignItems: 'center' }}>
                  <button type="button" className="action-button" onClick={() => aprobar(p)} disabled={busyId === p.id}>
                    {busyId === p.id ? <Loader2 size={18} className="spin" /> : <RefreshCcw size={18} />}
                    {busyId === p.id ? 'Verificando…' : 'Reintentar verificación'}
                  </button>
                </div>
              )}

              {p.estado === 'enviando' && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem', alignItems: 'center' }}>
                  <button type="button" className="action-button" onClick={() => confirmar(p)} disabled={busyId === p.id}>
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