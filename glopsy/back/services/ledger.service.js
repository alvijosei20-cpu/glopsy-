// ==========================================
// Sistema contable (ledger de doble entrada)
//
// Los pagos en línea ingresan por la cuenta central de ePayco y se liquidan
// a cada proveedor. Los saldos se derivan de los asientos, no se guardan
// mutables.
//
// Buckets del proveedor:
//   provider_deferred  -> ventas aún no entregadas o en ventana de reclamo
//   provider_available -> ventas entregadas y fuera de la ventana (2 días hábiles)
//
// La matemática pura vive en utils/ledgerMath.js (testeable sin DB).
// ==========================================

import { pool } from '../db.js';
import {
  round2,
  addBusinessDays,
  assertBalanced,
  buildSalePostings,
  buildReleasePostings,
  buildRefundPostings,
  buildPayoutPostings,
  buildPayoutPaidPostings,
} from '../utils/ledgerMath.js';
import * as bold from './bold.service.js';
import { createNotification } from './notifications.service.js';

export {
  distribute,
  addBusinessDays,
  assertBalanced,
  buildSalePostings,
  buildReleasePostings,
  buildRefundPostings,
  buildPayoutPostings,
  buildPayoutPaidPostings,
} from '../utils/ledgerMath.js';

// Definición de cuentas contables.
const ACCOUNT_DEFS = {
  processor: { kind: 'asset', bucket: 'processor', code: (c) => `processor:${c.provider || 'generic'}:${c.moneda}` },
  bank: { kind: 'asset', bucket: 'bank', code: (c) => `bank:${c.moneda}` },
  provider_deferred: { kind: 'liability', bucket: 'provider_deferred', code: (c) => `provider:${c.providerRef}:deferred:${c.moneda}` },
  provider_available: { kind: 'liability', bucket: 'provider_available', code: (c) => `provider:${c.providerRef}:available:${c.moneda}` },
  commission: { kind: 'revenue', bucket: 'commission', code: (c) => `commission:${c.moneda}` },
  withholding: { kind: 'liability', bucket: 'withholding', code: (c) => `withholding:${c.moneda}` },
  payout_pending: { kind: 'liability', bucket: 'payout_pending', code: (c) => `payout_pending:${c.moneda}` },
};

const getOrCreateAccount = async (client, key, ctx) => {
  const def = ACCOUNT_DEFS[key];
  if (!def) throw new Error(`Cuenta contable desconocida: ${key}`);
  const code = def.code(ctx);
  const { rows } = await client.query(
    `INSERT INTO ledger_accounts (code, kind, bucket, provider_ref, moneda, tienda_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code
     RETURNING id`,
    [code, def.kind, def.bucket, ctx.providerRef || null, ctx.moneda, ctx.tiendaId || null]
  );
  return rows[0].id;
};

const insertTransaction = async (client, tx, postings) => {
  assertBalanced(postings);
  const { rows } = await client.query(
    `INSERT INTO ledger_transactions
       (tipo, order_id, provider_ref, tienda_id, provider, moneda, referencia_externa, descripcion, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [tx.tipo, tx.orderId || null, tx.providerRef || null, tx.tiendaId || null,
      tx.provider || null, tx.moneda, tx.referenciaExterna || null, tx.descripcion || null,
      JSON.stringify(tx.metadata || {})]
  );
  const transactionId = rows[0].id;
  for (const p of postings) {
    const accountId = await getOrCreateAccount(client, p.key, {
      providerRef: p.providerRef,
      moneda: tx.moneda,
      tiendaId: tx.tiendaId,
      provider: tx.provider,
    });
    await client.query(
      `INSERT INTO ledger_postings (transaction_id, account_id, debit, credit)
       VALUES ($1, $2, $3, $4)`,
      [transactionId, accountId, round2(p.debit), round2(p.credit)]
    );
  }
  return transactionId;
};

const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

// ------------------------------------------------------------------
// Resolución de comisión (% por producto/categoría)
// ------------------------------------------------------------------

export const resolveCommissionRate = async (client, { productoId, categoriaId, tiendaId }) => {
  const { rows } = await client.query(
    `SELECT porcentaje,
       CASE
         WHEN scope = 'producto'  AND tienda_id IS NOT NULL THEN 1
         WHEN scope = 'producto'                              THEN 2
         WHEN scope = 'categoria' AND tienda_id IS NOT NULL THEN 3
         WHEN scope = 'categoria'                             THEN 4
         WHEN tienda_id IS NOT NULL                           THEN 5
         ELSE 6
       END AS prioridad
     FROM commission_rules
     WHERE activo = true
       AND (tienda_id = $3 OR tienda_id IS NULL)
       AND (
         (scope = 'producto'  AND scope_id = $1)
         OR (scope = 'categoria' AND scope_id = $2)
         OR (scope = 'global')
       )
     ORDER BY prioridad ASC
     LIMIT 1`,
    [productoId ?? null, categoriaId ?? null, tiendaId ?? null]
  );
  return rows[0] ? Number(rows[0].porcentaje) : 0;
};

// ------------------------------------------------------------------
// Registro de una venta
// ------------------------------------------------------------------

export const recordSaleForOrder = async (orderId, {
  provider = 'epayco',
  moneda = 'COP',
  processorFee = 0,
  withholding = 0,
  referenciaExterna = null,
  metadata = {},
} = {}) => withTransaction(async (client) => {
  const existing = await client.query(
    `SELECT id FROM ledger_transactions WHERE tipo = 'sale' AND order_id = $1 LIMIT 1`,
    [orderId]
  );
  if (existing.rows[0]) return { created: false, transactionId: existing.rows[0].id };

  const { rows: lineas } = await client.query(
    `SELECT oi.product_id, oi.line_total, p.categoria_id, p.tienda_id,
            COALESCE(s.idbusiness, 'tienda:' || p.tienda_id::text) AS provider_ref
     FROM order_items oi
     JOIN produc p ON p.id = oi.product_id
     LEFT JOIN order_shipments s ON s.id = oi.shipment_id
     WHERE oi.order_id = $1`,
    [orderId]
  );
  if (lineas.length === 0) throw new Error(`La orden ${orderId} no tiene líneas para contabilizar.`);

  const rateCache = new Map();
  const porProveedor = new Map();
  let tiendaId = null;

  for (const linea of lineas) {
    tiendaId = tiendaId ?? linea.tienda_id;
    const cacheKey = `${linea.product_id}:${linea.categoria_id}`;
    let rate = rateCache.get(cacheKey);
    if (rate === undefined) {
      rate = await resolveCommissionRate(client, {
        productoId: linea.product_id,
        categoriaId: linea.categoria_id,
        tiendaId: linea.tienda_id,
      });
      rateCache.set(cacheKey, rate);
    }
    const bruto = Number(linea.line_total) || 0;
    const comision = round2(bruto * rate / 100);
    const acc = porProveedor.get(linea.provider_ref) || { providerRef: linea.provider_ref, gross: 0, commission: 0 };
    acc.gross = round2(acc.gross + bruto);
    acc.commission = round2(acc.commission + comision);
    porProveedor.set(linea.provider_ref, acc);
  }

  const providers = [...porProveedor.values()];
  const postings = buildSalePostings({ providers, processorFee, withholding });

  const transactionId = await insertTransaction(client, {
    tipo: 'sale',
    orderId,
    providerRef: providers.length === 1 ? providers[0].providerRef : null,
    tiendaId,
    provider,
    moneda,
    referenciaExterna,
    descripcion: `Venta orden ${orderId}`,
    metadata: { providers, processorFee, withholding, ...metadata },
  }, postings);

  return { created: true, transactionId };
});

// ------------------------------------------------------------------
// Liberación de saldo (entrega + 2 días hábiles)
// ------------------------------------------------------------------

export const getOrderDeliveryDate = async (orderId) => {
  const { rows } = await pool.query(
    `SELECT MAX(delivered_at) AS delivered_at FROM order_shipments WHERE order_id = $1`,
    [orderId]
  );
  return rows[0]?.delivered_at || null;
};

export const releaseOrder = async (orderId, { moneda = null } = {}) => withTransaction(async (client) => {
  const sale = await client.query(
    `SELECT id, moneda FROM ledger_transactions WHERE tipo = 'sale' AND order_id = $1 LIMIT 1`,
    [orderId]
  );
  if (!sale.rows[0]) return { released: false, reason: 'sin_venta' };

  const ya = await client.query(
    `SELECT id FROM ledger_transactions WHERE tipo = 'release' AND order_id = $1 LIMIT 1`,
    [orderId]
  );
  if (ya.rows[0]) return { released: false, reason: 'ya_liberada', transactionId: ya.rows[0].id };

  const { rows } = await client.query(
    `SELECT a.provider_ref, a.moneda, SUM(p.credit - p.debit) AS neto
     FROM ledger_postings p
     JOIN ledger_accounts a ON a.id = p.account_id
     WHERE p.transaction_id = $1 AND a.bucket = 'provider_deferred'
     GROUP BY a.provider_ref, a.moneda`,
    [sale.rows[0].id]
  );
  const entries = rows
    .filter((r) => Number(r.neto) > 0)
    .map((r) => ({ providerRef: r.provider_ref, amount: Number(r.neto) }));
  if (entries.length === 0) return { released: false, reason: 'sin_saldo' };

  const transactionId = await insertTransaction(client, {
    tipo: 'release',
    orderId,
    providerRef: entries.length === 1 ? entries[0].providerRef : null,
    moneda: moneda || rows[0].moneda,
    descripcion: `Liberación de saldo orden ${orderId}`,
    metadata: { entries },
  }, buildReleasePostings(entries));

  return { released: true, transactionId };
});

// Reembolso/anulación de una venta: baja el saldo del proveedor y la cuenta central.
export const recordRefundForOrder = async (orderId, { moneda = null, referenciaExterna = null } = {}) => withTransaction(async (client) => {
  const sale = await client.query(
    `SELECT id, moneda FROM ledger_transactions WHERE tipo = 'sale' AND order_id = $1 LIMIT 1`,
    [orderId]
  );
  if (!sale.rows[0]) return { refunded: false, reason: 'sin_venta' };

  const existing = await client.query(
    `SELECT id FROM ledger_transactions WHERE tipo = 'refund' AND order_id = $1 LIMIT 1`,
    [orderId]
  );
  if (existing.rows[0]) return { refunded: false, reason: 'ya_reembolsada', transactionId: existing.rows[0].id };

  const { rows } = await client.query(
    `SELECT a.provider_ref, a.bucket, SUM(p.credit - p.debit) AS neto
     FROM ledger_postings p
     JOIN ledger_accounts a ON a.id = p.account_id
     WHERE p.transaction_id = $1 AND a.bucket IN ('provider_deferred', 'provider_available')
     GROUP BY a.provider_ref, a.bucket`,
    [sale.rows[0].id]
  );
  const porProveedor = new Map();
  for (const r of rows) {
    const acc = porProveedor.get(r.provider_ref) || { providerRef: r.provider_ref, deferred: 0, available: 0 };
    acc[r.bucket === 'provider_available' ? 'available' : 'deferred'] = Number(r.neto);
    porProveedor.set(r.provider_ref, acc);
  }
  const entries = [...porProveedor.values()]
    .map((a) => ({
      providerRef: a.providerRef,
      amount: round2(a.available > 0 ? a.available : a.deferred),
      fromBucket: a.available > 0 ? 'provider_available' : 'provider_deferred',
    }))
    .filter((e) => e.amount > 0);
  if (entries.length === 0) return { refunded: false, reason: 'sin_saldo' };

  const transactionId = await insertTransaction(client, {
    tipo: 'refund',
    orderId,
    providerRef: entries.length === 1 ? entries[0].providerRef : null,
    moneda: moneda || sale.rows[0].moneda,
    referenciaExterna,
    descripcion: `Reembolso orden ${orderId}`,
    metadata: { entries },
  }, entries.flatMap((e) => buildRefundPostings(e)));

  return { refunded: true, transactionId };
});

// Libera todas las ventas cuya entrega superó la ventana (2 días hábiles por defecto).
// Pensado para ejecutarse con un cron diario.
export const releaseEligibleOrders = async ({ dias = 2, holidays = [], limit = 500, moneda = null } = {}) => {
  const { rows } = await pool.query(
    `SELECT t.order_id, MAX(s.delivered_at) AS delivered_at
     FROM ledger_transactions t
     JOIN order_shipments s ON s.order_id = t.order_id
     WHERE t.tipo = 'sale' AND t.order_id IS NOT NULL AND s.delivered_at IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM ledger_transactions r WHERE r.tipo = 'release' AND r.order_id = t.order_id
       )
     GROUP BY t.order_id
     LIMIT $1`,
    [limit]
  );
  const now = Date.now();
  const released = [];
  for (const row of rows) {
    if (addBusinessDays(row.delivered_at, dias, holidays).getTime() <= now) {
      const res = await releaseOrder(row.order_id, { moneda });
      if (res.released) released.push({ orderId: row.order_id, transactionId: res.transactionId });
    }
  }
  return { evaluated: rows.length, released };
};

// ------------------------------------------------------------------
// Saldos y movimientos
// ------------------------------------------------------------------

export const getProviderBalance = async (providerRef, moneda) => {
  const { rows } = await pool.query(
    `SELECT bucket, COALESCE(SUM(balance), 0) AS total
     FROM ledger_account_balances
     WHERE provider_ref = $1 AND moneda = $2
     GROUP BY bucket`,
    [providerRef, moneda]
  );
  const saldo = { diferido: 0, disponible: 0, retenido: 0 };
  for (const r of rows) {
    if (r.bucket === 'provider_deferred') saldo.diferido = round2(r.total);
    if (r.bucket === 'provider_available') saldo.disponible = round2(r.total);
    if (r.bucket === 'withholding') saldo.retenido = round2(r.total);
  }
  const { rows: paid } = await pool.query(
    `SELECT COALESCE(SUM(total), 0) AS total FROM payouts WHERE provider_ref = $1 AND moneda = $2 AND estado = 'pagado'`,
    [providerRef, moneda]
  );
  return { ...saldo, pagado: round2(paid[0].total), total: round2(saldo.diferido + saldo.disponible) };
};

export const listProviderMovements = async (providerRef, moneda, { limit = 100 } = {}) => {
  const { rows } = await pool.query(
    `SELECT t.id, t.tipo, t.order_id, t.descripcion, t.metadata, t.created_at,
            COALESCE(SUM(p.credit - p.debit), 0) AS neto
     FROM ledger_transactions t
     JOIN ledger_postings p ON p.transaction_id = t.id
     JOIN ledger_accounts a ON a.id = p.account_id
     WHERE a.provider_ref = $1 AND a.moneda = $2
     GROUP BY t.id
     ORDER BY t.created_at DESC
     LIMIT $3`,
    [providerRef, moneda, Math.min(500, Math.max(1, limit))]
  );
  return rows;
};

// Saldo y movimientos consolidados de una tienda (todos sus proveedores).
export const getStoreLedgerForUser = async (tiendaId, moneda = 'COP', { limit = 100 } = {}) => {
  const { rows: balances } = await pool.query(
    `SELECT bucket, COALESCE(SUM(balance), 0) AS total
     FROM ledger_account_balances
     WHERE tienda_id = $1 AND moneda = $2
       AND bucket IN ('provider_deferred', 'provider_available')
     GROUP BY bucket`,
    [tiendaId, moneda]
  );
  const saldo = { diferido: 0, disponible: 0 };
  for (const r of balances) {
    if (r.bucket === 'provider_deferred') saldo.diferido = round2(r.total);
    if (r.bucket === 'provider_available') saldo.disponible = round2(r.total);
  }

  const { rows: movimientos } = await pool.query(
    `SELECT t.id, t.tipo, t.order_id, t.provider, t.descripcion, t.created_at,
            COALESCE(SUM(
              CASE WHEN a.bucket IN ('provider_deferred', 'provider_available')
                   THEN p.credit - p.debit ELSE 0 END
            ), 0) AS neto
     FROM ledger_transactions t
     JOIN ledger_postings p ON p.transaction_id = t.id
     JOIN ledger_accounts a ON a.id = p.account_id
     WHERE t.tienda_id = $1 AND t.moneda = $2
     GROUP BY t.id
     ORDER BY t.created_at DESC
     LIMIT $3`,
    [tiendaId, moneda, Math.min(500, Math.max(1, limit))]
  );

  return {
    moneda,
    saldo: { ...saldo, total: round2(saldo.diferido + saldo.disponible) },
    movimientos,
  };
};

export const getPlatformSummary = async (moneda = null) => {
  const params = moneda ? [moneda] : [];
  const where = moneda ? 'WHERE moneda = $1' : '';
  const { rows } = await pool.query(
    `SELECT bucket, moneda, COALESCE(SUM(balance), 0) AS total
     FROM ledger_account_balances
     ${where}
     GROUP BY bucket, moneda
     ORDER BY bucket, moneda`,
    params
  );
  return rows;
};

// ------------------------------------------------------------------
// Payouts (liquidación diaria)
// ------------------------------------------------------------------

export const createPayout = async ({ providerRef, moneda, metodo = 'transferencia', referencia = null, metadata = {} }) => withTransaction(async (client) => {
  const { rows: bal } = await client.query(
    `SELECT COALESCE(SUM(balance), 0) AS disponible
     FROM ledger_account_balances
     WHERE provider_ref = $1 AND moneda = $2 AND bucket = 'provider_available'`,
    [providerRef, moneda]
  );
  const total = round2(bal[0].disponible);
  if (total <= 0) return { created: false, reason: 'sin_saldo_disponible' };

  const { rows: payout } = await client.query(
    `INSERT INTO payouts (provider_ref, moneda, total, estado, metodo, referencia, metadata)
     VALUES ($1, $2, $3, 'pendiente', $4, $5, $6) RETURNING id`,
    [providerRef, moneda, total, metodo, referencia, JSON.stringify(metadata)]
  );
  const payoutId = payout[0].id;

  await insertTransaction(client, {
    tipo: 'payout',
    providerRef,
    moneda,
    descripcion: `Liquidación ${providerRef}`,
    metadata: { payoutId },
  }, buildPayoutPostings({ providerRef, amount: total }));

  const { rows: pendientes } = await client.query(
    `SELECT t.order_id, COALESCE(SUM(p.credit - p.debit), 0) AS monto
     FROM ledger_transactions t
     JOIN ledger_postings p ON p.transaction_id = t.id
     JOIN ledger_accounts a ON a.id = p.account_id
     WHERE t.tipo = 'release' AND a.bucket = 'provider_available'
       AND a.provider_ref = $1 AND a.moneda = $2
       AND t.order_id NOT IN (SELECT order_id FROM payout_items WHERE order_id IS NOT NULL)
     GROUP BY t.order_id`,
    [providerRef, moneda]
  );
  for (const item of pendientes) {
    await client.query(
      `INSERT INTO payout_items (payout_id, order_id, monto) VALUES ($1, $2, $3)`,
      [payoutId, item.order_id, round2(item.monto)]
    );
  }

  return { created: true, payoutId, total };
});

export const markPayoutPaid = async (payoutId, { referencia = null, tiendaId = null } = {}) => withTransaction(async (client) => {
  const guard = tiendaId
    ? ` AND p.provider_ref IN (
         SELECT 'tienda:' || o.tienda_id::text FROM orders o WHERE o.tienda_id = $2
         UNION
         SELECT s.idbusiness FROM order_shipments s JOIN orders o ON o.id = s.order_id WHERE o.tienda_id = $2 AND s.idbusiness IS NOT NULL
       )`
    : '';
  const params = tiendaId ? [payoutId, tiendaId] : [payoutId];
  const { rows } = await client.query(
    `SELECT p.id, p.moneda, p.total, p.estado FROM payouts p WHERE p.id = $1${guard} FOR UPDATE`,
    params
  );
  if (!rows[0]) throw new Error('Payout no encontrado.');
  if (rows[0].estado === 'pagado') return { updated: false, reason: 'ya_pagado' };

  await insertTransaction(client, {
    tipo: 'payout',
    moneda: rows[0].moneda,
    descripcion: `Pago liquidación ${payoutId}`,
    metadata: { payoutId, referencia },
  }, buildPayoutPaidPostings({ amount: Number(rows[0].total) }));

  await client.query(
    `UPDATE payouts SET estado = 'pagado', paid_at = NOW(), referencia = COALESCE($2, referencia) WHERE id = $1`,
    [payoutId, referencia]
  );
  return { updated: true, payoutId };
});

const setPayoutState = async (payoutId, estado, extra = {}) => {
  const { rows } = await pool.query(
    `UPDATE payouts SET estado = $2, metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb, updated_at = NOW()
     WHERE id = $1 RETURNING id, estado`,
    [payoutId, estado, JSON.stringify(extra)]
  );
  return rows[0] || null;
};

const getPayoutOrders = async (payoutId) => {
  const { rows } = await pool.query(
    `SELECT o.id AS order_id, o.order_number, o.es_exportacion,
            o.payload->>'epayco_ref_payco' AS ref_payco
     FROM payout_items pi
     JOIN orders o ON o.id = pi.order_id
     WHERE pi.payout_id = $1`,
    [payoutId]
  );
  return rows;
};

// Flujo de liberación: el dueño de la tienda solo APRUEBA; el sistema verifica
// en la pasarela (Bold) que no existan disputas/contracargos sobre los pagos y,
// si está limpio, ordena la dispersión al proveedor. Si la pasarela no está
// configurada o responde error, los fondos quedan RETENIDOS (no se liberan).
export const approvePayout = async ({ payoutId, tiendaId }) => withTransaction(async (client) => {
  const guard = tiendaId
    ? ` AND p.provider_ref IN (
         SELECT 'tienda:' || o.tienda_id::text FROM orders o WHERE o.tienda_id = $2
         UNION
         SELECT s.idbusiness FROM order_shipments s JOIN orders o ON o.id = s.order_id WHERE o.tienda_id = $2 AND s.idbusiness IS NOT NULL
       )`
    : '';
  const params = tiendaId ? [payoutId, tiendaId] : [payoutId];
  const { rows } = await client.query(
    `SELECT id, moneda, total, estado FROM payouts p WHERE p.id = $1${guard} FOR UPDATE`,
    params
  );
  const payout = rows[0];
  if (!payout) throw new Error('Payout no encontrado.');
  if (payout.estado === 'pagado') return { updated: false, reason: 'ya_pagado' };
  if (payout.estado === 'enviando') return { updated: false, reason: 'ya_enviando' };

  const orders = await getPayoutOrders(payout.id);
  const orderLabels = orders.map((o) => o.order_number || `Orden ${o.order_id}`).join(', ') || `Liquidación ${payout.id}`;

  // 1) Conciliación antes de liberar: lo que el ledger debe a proveedores debe
  //    estar respaldado por el saldo disponible/congelado en la cuenta Bold.
  const bal = await bold.getAccountBalances();
  if (bal.error) {
    await setPayoutState(payout.id, 'retenido', { motivo: 'balance_error', detalle: bal.error });
    await createNotification({
      title: '⚠️ Descudre al liberar liquidación',
      message: `No se pudo consultar el saldo en Bold para la liquidación #${payout.id} (${orderLabels}). Los retiros quedaron congelados hasta revisar. Error: ${bal.error}`,
      type: 'aviso',
      target: 'user',
      userId: tiendaId,
    }).catch(() => {});
    return { updated: false, reason: 'balance_error', detalle: bal.error };
  }
  if (bal.configured) {
    const { rows: owedRows } = await client.query(
      `SELECT COALESCE(SUM(balance), 0) AS total
       FROM ledger_account_balances
       WHERE bucket IN ('provider_deferred', 'provider_available', 'withholding', 'payout_pending')`
    );
    const esperado = round2(Number(owedRows[0]?.total) || 0);
    const enBold = round2(Number(bal.available) + Number(bal.frozen) + Number(bal.dispute));
    if (Math.abs(enBold - esperado) > 1) {
      const detalle = {
        motivo: 'descuadre',
        esperado,
        enBold,
        disponible: Number(bal.available),
        congelado: Number(bal.frozen),
        disputa: Number(bal.dispute),
        moneda: bal.currency,
        payout: payout.id,
        facturas: orders.map((o) => o.order_number || `Orden ${o.order_id}`),
      };
      await setPayoutState(payout.id, 'retenido', detalle);
      await createNotification({
        title: '🚨 Descuadre detectado — retiros congelados',
        message: `Al consiliar antes de liberar ${orderLabels} hay diferencia: el ledger adeuda ${esperado} y en Bold hay ${enBold} (${bal.currency}). No se libera ni se dispersa hasta revisar.`,
        type: 'aviso',
        target: 'user',
        userId: tiendaId,
      }).catch(() => {});
      return { updated: false, reason: 'descuadre', esperado, enBold, detalle };
    }
  }

  let check;
  try {
    check = await bold.checkPayoutDisputes({
      orders: orders.map((o) => ({ orderId: o.order_id, refPayco: o.ref_payco })),
    });
  } catch (err) {
    check = { configured: true, disputes: null, error: String(err?.message || 'error_bold') };
  }

  if (check.error) {
    await setPayoutState(payout.id, 'retenido', { motivo: 'verificacion_fallida', detalle: check.error });
    return { updated: false, reason: 'verificacion_fallida', detalle: check.error };
  }
  if (!check.configured) {
    await setPayoutState(payout.id, 'retenido', { motivo: 'verificacion_pendiente', detalle: 'Pasarela Bold sin configuración para verificar disputas.' });
    return { updated: false, reason: 'verificacion_pendiente' };
  }
  if (check.disputes && check.disputes.length > 0) {
    await setPayoutState(payout.id, 'retenido', { motivo: 'disputa', disputas: check.disputes });
    await createNotification({
      title: '⚠️ Reclamo/contracargo en pago',
      message: `La liquidación #${payout.id} (${orderLabels}) tiene una disputa o contracargo abierto en Bold. Los fondos NO se liberan. Revisa el pago en cuestión y resuélvelo.`,
      type: 'aviso',
      target: 'user',
      userId: tiendaId,
    }).catch(() => {});
    return { updated: false, reason: 'disputa', disputas: check.disputes };
  }

  // Pago limpio: ordenar la dispersión al proveedor por el sistema.
  const { rows: pr } = await client.query(`SELECT provider_ref FROM payouts WHERE id = $1`, [payout.id]);
  const providerRef = pr[0]?.provider_ref;
  const realSend = await bold.sendPayout({
    providerRef,
    amount: Number(payout.total),
    currency: payout.moneda || 'COP',
    reference: `P${payout.id}`,
  });

  if (!realSend.configured) {
    await setPayoutState(payout.id, 'enviando', { motivo: 'envio_manual_pendiente', detalle: 'Dispersión pendiente de procesar por la pasarela.' });
    return { updated: true, pending: true, reason: 'envio_manual_pendiente' };
  }
  if (!realSend.ok) {
    await setPayoutState(payout.id, 'retenido', { motivo: 'envio_fallido', detalle: realSend.error });
    return { updated: false, reason: 'envio_fallido', detalle: realSend.error };
  }

  await client.query(
    `UPDATE payouts SET estado = 'pagado', paid_at = NOW(), referencia = COALESCE($2, referencia), metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
     WHERE id = $1`,
    [payout.id, realSend.externalRef, JSON.stringify({ externalRef: realSend.externalRef })],
  );
  await insertTransaction(client, {
    tipo: 'payout',
    moneda: payout.moneda || 'COP',
    descripcion: `Pago liquidación ${payout.id}`,
    metadata: { payoutId: payout.id, externalRef: realSend.externalRef },
  }, buildPayoutPaidPostings({ amount: Number(payout.total) }));

  return { updated: true, paid: true, payoutId: payout.id, externalRef: realSend.externalRef };
});

// Confirmación final cuando el envío quedó "enviando" (pipeline sin API de
// confirmación): el sistema registra la dispersión como entregada.
export const confirmPayoutPaid = async ({ payoutId, tiendaId, referencia = null }) => withTransaction(async (client) => {
  const guard = tiendaId
    ? ` AND p.provider_ref IN (
         SELECT 'tienda:' || o.tienda_id::text FROM orders o WHERE o.tienda_id = $2
         UNION
         SELECT s.idbusiness FROM order_shipments s JOIN orders o ON o.id = s.order_id WHERE o.tienda_id = $2 AND s.idbusiness IS NOT NULL
       )`
    : '';
  const params = tiendaId ? [payoutId, tiendaId] : [payoutId];
  const { rows } = await client.query(
    `SELECT id, moneda, total, estado FROM payouts p WHERE p.id = $1${guard} FOR UPDATE`,
    params
  );
  const payout = rows[0];
  if (!payout) throw new Error('Payout no encontrado.');
  if (payout.estado === 'pagado') return { updated: false, reason: 'ya_pagado' };
  if (payout.estado !== 'enviando') return { updated: false, reason: 'no_enviando' };

  await insertTransaction(client, {
    tipo: 'payout',
    moneda: payout.moneda,
    descripcion: `Pago liquidación ${payout.id}`,
    metadata: { payoutId: payout.id, referencia },
  }, buildPayoutPaidPostings({ amount: Number(payout.total) }));

  await client.query(
    `UPDATE payouts SET estado = 'pagado', paid_at = NOW(), referencia = COALESCE($2, referencia) WHERE id = $1`,
    [payout.id, referencia]
  );
  return { updated: true, payoutId: payout.id };
});

// Payouts de una tienda (los proveedores que le facturan: la propia tienda o
// los idbusiness de sus envíos) con sus órdenes asociadas.
export const listPayoutsForStore = async (tiendaId, { estado = null, limit = 200 } = {}) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.provider_ref, p.moneda, p.total, p.estado, p.metodo, p.referencia,
            p.metadata, p.created_at, p.paid_at
     FROM payouts p
     WHERE p.provider_ref IN (
       SELECT 'tienda:' || o.tienda_id::text FROM orders o WHERE o.tienda_id = $1
       UNION
       SELECT s.idbusiness
       FROM order_shipments s
       JOIN orders o ON o.id = s.order_id
       WHERE o.tienda_id = $1 AND s.idbusiness IS NOT NULL
     )
       AND ($2::text IS NULL OR p.estado = $2)
     ORDER BY p.created_at DESC
     LIMIT $3`,
    [tiendaId, estado || null, Math.min(500, Math.max(1, limit))]
  );

  for (const payout of rows) {
    const { rows: items } = await pool.query(
      `SELECT pi.order_id, pi.monto, o.order_number,
              COALESCE(o.customer_name, 'Cliente') AS cliente,
              o.es_exportacion
       FROM payout_items pi
       LEFT JOIN orders o ON o.id = pi.order_id
       WHERE pi.payout_id = $1
       ORDER BY pi.id ASC`,
      [payout.id]
    );
    payout.items = items.map((it) => ({
      orderId: it.order_id,
      orderNumber: it.order_number || null,
      cliente: it.cliente,
      monto: round2(Number(it.monto) || 0),
      es_exportacion: it.es_exportacion === true,
    }));
    try {
      payout.metadata = typeof payout.metadata === 'object' ? payout.metadata : JSON.parse(payout.metadata || '{}');
    } catch {
      payout.metadata = {};
    }
  }
  return rows;
};
