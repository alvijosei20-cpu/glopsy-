// ==========================================
// Checkout ePayco (Onpage).
//
// El pago se captura en el checkout de ePayco embebido en la web (checkout.js).
// El backend crea la orden pendiente, entrega los parámetros de la pasarela y
// confirma la venta cuando llega el webhook con la firma MD5 válida.
//
// Solo opera sobre órdenes existentes (invoice = order_number) para no exponer
// la llave de la plataforma a referencias arbitrarias.
// ==========================================

import { pool } from '../db.js';
import * as epayco from './epayco.service.js';
import { createPendingOrderForCart } from './product.service.js';
import { recordSaleForOrder, recordRefundForOrder } from './ledger.service.js';
import { loadEpaycoCredentials } from './paymentConfig.service.js';
import { resolveCheckoutCurrency, convertAmount } from './checkoutCurrency.service.js';

const ensureCreds = () => loadEpaycoCredentials().catch(() => null);

const findOrder = async (reference) => {
  if (!reference) return null;
  const { rows } = await pool.query(
    `SELECT id, tienda_id, order_number, order_hash, status, amount, currency
     FROM orders
     WHERE order_number = $1
        OR order_hash = $1
        OR payload->>'epayco_ref_payco' = $1
        OR payload->>'epayco_invoice' = $1
     ORDER BY id DESC
     LIMIT 1`,
    [String(reference)]
  );
  return rows[0] || null;
};

export const markOrderPaid = async (orderId, { refPayco = null, payloadExtra = {} } = {}) => {
  const { rows } = await pool.query(`SELECT currency FROM orders WHERE id = $1 LIMIT 1`, [orderId]);
  const moneda = rows[0]?.currency || 'COP';
  await pool.query(
    `UPDATE orders
     SET status = 'Completado',
         payload = COALESCE(payload, '{}'::jsonb) || $2::jsonb,
         updated_at = NOW()
     WHERE id = $1 AND status <> 'Completado'`,
    [orderId, JSON.stringify(payloadExtra)]
  );
  try {
    await recordSaleForOrder(orderId, { provider: 'epayco', moneda, referenciaExterna: refPayco });
  } catch (error) {
    console.error('[ePayco] Error contabilizando venta en el ledger:', error.message);
  }
};

const updateOrderStatus = async (orderId, status, payloadExtra = {}) => {
  await pool.query(
    `UPDATE orders
     SET status = $1,
         payload = COALESCE(payload, '{}'::jsonb) || $2::jsonb,
         updated_at = NOW()
     WHERE id = $3`,
    [status, JSON.stringify(payloadExtra), orderId]
  );
};

// Inicia el checkout Onpage: crea la orden pendiente y devuelve los parámetros
// que el frontend pasa a ePayco.checkout.configure().open().
export const startEpaycoCheckout = async (userId, {
  items,
  customerInfo = {},
  guestHash = null,
  shippingCost = 0,
  shippingPayload = null,
  visitor = null,
  billing = {},
  responseUrl = null,
  baseUrl = '',
} = {}) => {
  await ensureCreds();
  if (!epayco.isEpaycoConfigured()) return { ok: false, reason: 'epayco_no_configurado' };
  if (!Array.isArray(items) || items.length === 0) return { ok: false, reason: 'carrito_vacio' };

  const order = await createPendingOrderForCart(userId, items, {
    customerInfo,
    guestHash,
    shippingCost,
    shippingPayload,
  });

  const { currency, rate, converted } = await resolveCheckoutCurrency(order.tiendaId, visitor);
  if (String(currency).toUpperCase() !== 'COP') {
    return { ok: false, reason: 'epayco_solo_cop', orderId: order.orderId, orderNumber: order.orderNumber };
  }
  const chargeAmount = converted ? convertAmount(order.totalAmount, rate) : order.totalAmount;

  if (converted) {
    await pool.query(`UPDATE orders SET amount = $2, currency = $3 WHERE id = $1`, [order.orderId, chargeAmount, currency]);
  } else {
    await pool.query(`UPDATE orders SET currency = $2 WHERE id = $1`, [order.orderId, currency]);
  }

  // Venta al exterior (comprador fuera del país, tienda habilitada en USD):
  // bien excluido de IVA (art. 481 E.T.). Se marca en la orden.
  if (String(currency).toUpperCase() === 'USD') {
    await pool.query(`UPDATE orders SET es_exportacion = TRUE WHERE id = $1`, [order.orderId]);
  }

  const checkout = epayco.buildOnpageData({
    invoice: order.orderNumber,
    amount: chargeAmount,
    currency,
    description: `Pedido ${order.orderNumber}`,
    confirmationUrl: baseUrl ? `${baseUrl}/api/payments/epayco/webhook` : undefined,
    responseUrl: responseUrl || undefined,
    billing,
    extras: { extra1: order.orderHash },
  });

  return {
    ok: true,
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    orderHash: order.orderHash,
    amount: chargeAmount,
    currency,
    checkout: {
      ...checkout,
      key: epayco.getEpaycoPublicKey(),
      test: checkout.test,
    },
  };
};

// Procesa el webhook de confirmación de ePayco (form-urlencoded).
export const processEpaycoConfirmation = async (payload = {}) => {
  await ensureCreds();
  if (!epayco.isEpaycoConfigured()) return { ok: false, status: 503, reason: 'epayco_no_configurado' };

  const configuredCustomerId = epayco.getEpaycoCustomerId();
  if (configuredCustomerId && String(payload.x_cust_id_cliente || '') !== String(configuredCustomerId)) {
    return { ok: false, status: 401, reason: 'cust_id_invalido' };
  }
  if (!epayco.verifyEpaycoSignature(payload)) {
    return { ok: false, status: 401, reason: 'firma_invalida' };
  }

  const refPayco = payload.x_ref_payco;
  const invoice = payload.x_id_invoice || payload.x_extra1;
  const state = epayco.normalizeEpaycoState(payload.x_transaction_state, payload.x_response);

  const order = await findOrder(invoice) || await findOrder(payload.x_extra1);
  if (!order) {
    console.warn(`[ePayco Webhook] Sin orden para invoice=${invoice} ref=${refPayco}`);
    return { ok: true, ignored: true, reason: 'orden_no_encontrada', invoice, refPayco };
  }

  const payloadExtra = {
    epayco_ref_payco: refPayco,
    epayco_invoice: invoice,
    epayco_state: payload.x_transaction_state || payload.x_response || null,
    epayco_test: String(payload.x_test_request || '').toUpperCase() === 'TRUE',
    epayco_event: payload,
  };

  const amount = Number(payload.x_amount);
  if (Number.isFinite(amount) && Math.abs(amount - Number(order.amount)) > 0.01) {
    console.warn(`[ePayco Webhook] Monto no coincide orden=${order.id} recibido=${amount} esperado=${order.amount}`);
    return { ok: false, status: 409, reason: 'monto_no_coincide', orderId: order.id };
  }

  if (state === 'approved') {
    if (order.status === 'Completado') return { ok: true, ignored: true, reason: 'ya_procesada', orderId: order.id };
    await markOrderPaid(order.id, { refPayco, payloadExtra });
    return { ok: true, orderId: order.id, status: 'Completado' };
  }

  if (state === 'rejected') {
    await updateOrderStatus(order.id, 'rejected', payloadExtra);
    return { ok: true, orderId: order.id, status: 'rejected' };
  }

  if (state === 'refunded') {
    await updateOrderStatus(order.id, 'refunded', payloadExtra);
    try {
      await recordRefundForOrder(order.id, { moneda: order.currency || 'COP', referenciaExterna: refPayco });
    } catch (error) {
      console.error('[ePayco Webhook] Error contabilizando reembolso:', error.message);
      return { ok: false, status: 500, reason: 'ledger_error', orderId: order.id };
    }
    return { ok: true, orderId: order.id, status: 'refunded' };
  }

  if (state === 'pending') {
    await updateOrderStatus(order.id, 'pending', payloadExtra);
    return { ok: true, orderId: order.id, status: 'pending' };
  }

  return { ok: true, ignored: true, orderId: order.id, state: payload.x_transaction_state || payload.x_response };
};

// Estado de la orden para el polling del frontend (el webhook es la fuente de verdad).
export const getEpaycoOrderStatus = async (reference) => {
  const order = await findOrder(reference);
  if (!order) return { ok: false, reason: 'orden_no_encontrada' };
  const map = {
    Completado: 'APPROVED',
    rejected: 'REJECTED',
    refunded: 'REFUNDED',
    pending: 'PENDING',
  };
  return {
    ok: true,
    orderId: order.id,
    status: map[order.status] || 'PENDING',
    orderStatus: order.status,
  };
};
