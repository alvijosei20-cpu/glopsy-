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

export const markPayoutPaid = async (payoutId, { referencia = null } = {}) => withTransaction(async (client) => {
  const { rows } = await client.query(
    `SELECT id, moneda, total, estado FROM payouts WHERE id = $1 FOR UPDATE`,
    [payoutId]
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
