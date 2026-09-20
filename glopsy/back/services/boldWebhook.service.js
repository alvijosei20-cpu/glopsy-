// ==========================================
// Procesamiento del webhook de Bold.
//
// Eventos: SALE_APPROVED, SALE_REJECTED, VOID_APPROVED, VOID_REJECTED.
// Idempotente: si la orden ya está en el estado destino, no repite asientos.
// Docs: https://developers.bold.co/webhook
// ==========================================

import { pool } from '../db.js';
import { verifyBoldSignature } from './bold.service.js';
import { loadBoldCredentials } from './paymentConfig.service.js';
import { recordSaleForOrder, recordRefundForOrder } from './ledger.service.js';

const findOrderByReference = async (reference) => {
  if (!reference) return null;
  const { rows } = await pool.query(
    `SELECT id, tienda_id, order_number, order_hash, status
     FROM orders
     WHERE order_number = $1 OR order_hash = $1 OR payload->>'bold_reference' = $1
     ORDER BY id DESC
     LIMIT 1`,
    [String(reference)]
  );
  return rows[0] || null;
};

const updateOrder = async (orderId, status, payload) => {
  await pool.query(
    `UPDATE orders SET status = $1, payload = COALESCE(payload, '{}'::jsonb) || $2::jsonb, updated_at = NOW()
     WHERE id = $3`,
    [status, JSON.stringify(payload || {}), orderId]
  );
};

export const processBoldWebhook = async (payload, { rawBody, signature } = {}) => {
  await loadBoldCredentials().catch(() => null);
  if (!verifyBoldSignature(rawBody, signature)) {
    return { ok: false, status: 401, reason: 'firma_invalida' };
  }

  const type = payload?.type;
  const data = payload?.data || {};
  const paymentId = data.payment_id;
  const reference = data.metadata?.reference;
  const moneda = data.amount?.currency || 'COP';

  if (!paymentId) return { ok: true, ignored: true, reason: 'sin_payment_id' };

  const order = await findOrderByReference(reference);
  if (!order) {
    console.warn(`[Bold Webhook] Sin orden para reference=${reference} payment=${paymentId}`);
    return { ok: true, ignored: true, reason: 'orden_no_encontrada', reference };
  }

  if (type === 'SALE_APPROVED') {
    if (order.status === 'Completado') return { ok: true, ignored: true, reason: 'ya_procesada', orderId: order.id };
    await updateOrder(order.id, 'Completado', { bold_payment_id: paymentId, bold_reference: reference, bold_event: payload });
    let ledger = { created: false };
    try {
      ledger = await recordSaleForOrder(order.id, {
        provider: 'bold',
        moneda,
        referenciaExterna: paymentId,
        metadata: { bold_payment_id: paymentId },
      });
    } catch (error) {
      console.error('[Bold Webhook] Error contabilizando venta:', error.message);
      return { ok: false, status: 500, reason: 'ledger_error', orderId: order.id };
    }
    return { ok: true, orderId: order.id, status: 'Completado', ledger };
  }

  if (type === 'SALE_REJECTED') {
    await updateOrder(order.id, 'rejected', { bold_payment_id: paymentId, bold_event: payload });
    return { ok: true, orderId: order.id, status: 'rejected' };
  }

  if (type === 'VOID_APPROVED') {
    await updateOrder(order.id, 'refunded', { bold_payment_id: paymentId, bold_event: payload });
    let ledger = { refunded: false };
    try {
      ledger = await recordRefundForOrder(order.id, { moneda, referenciaExterna: paymentId });
    } catch (error) {
      console.error('[Bold Webhook] Error contabilizando reembolso:', error.message);
      return { ok: false, status: 500, reason: 'ledger_error', orderId: order.id };
    }
    return { ok: true, orderId: order.id, status: 'refunded', ledger };
  }

  return { ok: true, ignored: true, type };
};
