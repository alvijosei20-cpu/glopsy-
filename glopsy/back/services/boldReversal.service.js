// ==========================================
// Reversión de pagos de la API de Pagos en Línea de Bold.
//
// Cuando se cancela un pedido pagado con la API de Pagos en Línea, se devuelve
// el dinero al comprador usando la API de Bold:
//   - Anulación (void)  -> POST /v1/payment/void   (mismo día, antes de las 9 PM)
//   - Reembolso          -> POST /v1/payment/refund (queda en revisión de Bold)
//
// Restricción de Bold: solo aplica a tarjeta de crédito/débito en estado APPROVED.
// Doc: https://developers.bold.co/pagos-en-linea/api-de-pagos-en-linea/integracion
// ==========================================

import { pool } from '../db.js';
import { getPaymentStatus, voidPayment, requestRefund, getRefundStatus } from './boldApi.service.js';
import { recordRefundForOrder } from './ledger.service.js';
import { cancelInternationalDispatchForOrder } from './internationalShipping.service.js';

// Hora local de Colombia (America/Bogota, UTC-5).
const bogotaNow = (date = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
};

// La anulación solo se permite el mismo día de la transacción y antes de las 9 PM.
const canVoidNow = (attemptDate) => {
  if (!attemptDate) return false;
  const now = bogotaNow();
  const at = bogotaNow(new Date(attemptDate));
  return now.hour < 21 && at.date === now.date;
};

const isBoldOnlineOrder = (payload = {}) =>
  Boolean(
    payload.bold_qr_reference ||
      payload.bold_qr ||
      payload.bold_qr_status ||
      payload.bold_qr_transaction
  );

// Devuelve el dinero de un pedido pagado con la API de Pagos en Línea (Bold).
// Idempotente: no repite la reversión si ya se registró una exitosa.
export const reverseBoldOnlinePaymentForOrder = async (orderId, { reason = 'Cancelación de pedido' } = {}) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, order_number, payload FROM orders WHERE id = $1 LIMIT 1`,
      [orderId]
    );
    const order = rows[0];
    if (!order) return { ok: false, reason: 'order_not_found' };

    const payload = order.payload && typeof order.payload === 'object' ? order.payload : {};
    if (!isBoldOnlineOrder(payload)) return { ok: false, reason: 'no_bold_online_payment' };
    if (payload.bold_reversal?.ok) return { ok: true, already: true, action: payload.bold_reversal.action };

    const referenceId = payload.bold_qr_reference || order.order_number || null;

    // Estado real en Bold: nos da el transaction_id (TXN...) y la fecha del intento.
    const statusRes = await getPaymentStatus(referenceId);
    const data = statusRes.data || {};
    const transactionId = data.transaction_id || payload.bold_qr_transaction || null;
    const boldStatus = String(data.status || '').toUpperCase();

    if (!data || (statusRes.ok === false && !transactionId)) {
      return { ok: false, reason: statusRes.reason || 'sin_estado_bold' };
    }
    if (boldStatus && boldStatus !== 'APPROVED') {
      return { ok: false, reason: 'pago_no_aprobado', status: boldStatus };
    }
    if (!transactionId) return { ok: false, reason: 'sin_transaction_id' };

    const useVoid = canVoidNow(data.attempt_date || data.approval_date || null);
    const result = useVoid
      ? await voidPayment({ transactionId })
      : await requestRefund({ referenceId, transactionId, reason });

    const record = {
      action: useVoid ? 'void' : 'refund',
      reference_id: referenceId,
      transaction_id: transactionId,
      ok: Boolean(result.ok),
      status: result.status || null,
      error: result.ok ? null : result.error || result.reason || null,
      at: new Date().toISOString(),
    };

    await pool.query(
      `UPDATE orders
       SET payload = COALESCE(payload, '{}'::jsonb) || $2::jsonb, updated_at = NOW()
       WHERE id = $1`,
      [orderId, JSON.stringify({ bold_reversal: record })]
    );

    return { ...result, action: record.action, transactionId, referenceId };
  } catch (error) {
    console.error('[Bold Reversal] Error revirtiendo pago:', orderId, error.message);
    return { ok: false, reason: 'error', message: error.message };
  }
};

// Consulta el estado de un reembolso iniciado (PROCESSING | APPROVED | REJECTED).
export const getBoldRefundStatusForOrder = async (orderId) => {
  const { rows } = await pool.query(`SELECT payload FROM orders WHERE id = $1 LIMIT 1`, [orderId]);
  const payload = rows[0]?.payload && typeof rows[0].payload === 'object' ? rows[0].payload : {};
  const transactionId = payload.bold_reversal?.transaction_id;
  if (!transactionId) return { ok: false, reason: 'sin_reversion' };
  return getRefundStatus(transactionId);
};

// Aplica el resultado confirmado por Bold de una reversión (void o refund):
//  - APPROVED -> asienta el reembolso en el ledger, marca la orden 'refunded' y
//    cancela el despacho internacional.
//  - REJECTED -> solo registra el resultado (la orden no cambia).
// Idempotente: si ya estaba conciliada, no vuelve a asentar.
export const settleBoldReversal = async (orderId, { status, transactionId = null, source = 'refund' } = {}) => {
  try {
    const st = String(status || '').toUpperCase();
    if (st !== 'APPROVED' && st !== 'REJECTED') {
      return { ok: false, reason: 'estado_no_final', status: st };
    }

    const { rows } = await pool.query(`SELECT payload FROM orders WHERE id = $1 LIMIT 1`, [orderId]);
    const current = rows[0]?.payload?.bold_reversal || {};
    if (current.settled === true && current.settlement_status === st) {
      return { ok: true, already: true };
    }

    const merged = {
      ...current,
      transaction_id: transactionId || current.transaction_id || null,
      settled: true,
      settlement_status: st,
      settled_at: new Date().toISOString(),
      settlement_source: source,
    };

    if (st === 'APPROVED') {
      await pool.query(
        `UPDATE orders
         SET status = 'refunded',
             payload = COALESCE(payload, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [orderId, JSON.stringify({ bold_reversal: merged })]
      );
      try {
        await recordRefundForOrder(orderId, { referenciaExterna: merged.transaction_id });
      } catch (e) {
        console.error('[Bold Reversal] Error asentando reembolso en el ledger:', orderId, e.message);
      }
      await cancelInternationalDispatchForOrder(orderId).catch(() => {});
    } else {
      await pool.query(
        `UPDATE orders
         SET payload = COALESCE(payload, '{}'::jsonb) || $2::jsonb, updated_at = NOW()
         WHERE id = $1`,
        [orderId, JSON.stringify({ bold_reversal: merged })]
      );
    }

    return { ok: true, status: st, transactionId: merged.transaction_id };
  } catch (error) {
    console.error('[Bold Reversal] Error conciliando reversión:', orderId, error.message);
    return { ok: false, reason: 'error', message: error.message };
  }
};

export default { reverseBoldOnlinePaymentForOrder, getBoldRefundStatusForOrder, settleBoldReversal };
