// ==========================================
// Checkout transparente Bold (API Pagos en línea).
//
// La tarjeta se captura en la web de glopsy y se envía al backend, que
// habla con Bold. Para 3DS/PSE/Bancolombia/Nequi Bold devuelve
// next_actions.redirect_url (redirección del banco, inevitable).
//
// Solo opera sobre órdenes existentes (reference = order_number u order_hash)
// para no exponer la llave de la plataforma a referencias arbitrarias.
// ==========================================

import { pool } from '../db.js';
import * as bold from './bold.service.js';
import { createPendingOrderForCart } from './product.service.js';
import { recordSaleForOrder } from './ledger.service.js';
import { loadBoldCredentials } from './paymentConfig.service.js';
import { resolveCheckoutCurrency, convertAmount } from './checkoutCurrency.service.js';

const ensureCreds = () => loadBoldCredentials().catch(() => null);

const findOrder = async (reference) => {
  if (!reference) return null;
  const { rows } = await pool.query(
    `SELECT id, tienda_id, order_number, order_hash, status, amount
     FROM orders
     WHERE order_number = $1 OR order_hash = $1
     ORDER BY id DESC
     LIMIT 1`,
    [String(reference)]
  );
  return rows[0] || null;
};

const orderRef = (order) => order.order_number || order.order_hash;

const markOrderPaid = async (orderId, { paymentId = null, payloadExtra = {} } = {}) => {
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
    await recordSaleForOrder(orderId, { provider: 'bold', moneda, referenciaExterna: paymentId });
  } catch (error) {
    console.error('[Bold] Error contabilizando venta en el ledger:', error.message);
  }
};

// Inicia el checkout transparente: crea la orden pendiente y la intención de pago.
export const startBoldCheckout = async (userId, {
  items,
  customerInfo = {},
  guestHash = null,
  shippingCost = 0,
  shippingPayload = null,
  callbackUrl,
  taxes,
  deviceFingerprint,
  visitor = null,
} = {}) => {
  await ensureCreds();
  if (!Array.isArray(items) || items.length === 0) return { ok: false, reason: 'carrito_vacio' };

  const order = await createPendingOrderForCart(userId, items, {
    customerInfo,
    guestHash,
    shippingCost,
    shippingPayload,
  });

  // Moneda de cobro: local (COP, Bold) para visitantes del país; USD para el resto.
  const { currency, rate, converted } = await resolveCheckoutCurrency(order.tiendaId, visitor);
  const chargeAmount = convertAmount(order.totalAmount, rate);

  if (converted) {
    await pool.query(`UPDATE orders SET amount = $2, currency = $3 WHERE id = $1`, [order.orderId, chargeAmount, currency]);
  } else {
    await pool.query(`UPDATE orders SET currency = $2 WHERE id = $1`, [order.orderId, currency]);
  }

  const intent = await bold.createPaymentIntent({
    referenceId: order.orderNumber,
    amount: chargeAmount,
    currency,
    taxes,
    customer: {
      name: customerInfo.customer_name || undefined,
      email: customerInfo.email || undefined,
      phone: customerInfo.telefono || undefined,
    },
    callbackUrl,
    deviceFingerprint,
  });

  return {
    ok: true,
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    orderHash: order.orderHash,
    amount: chargeAmount,
    currency,
    intent,
  };
};

// Paso 1: intención de pago con el monto de la orden.
export const createIntentForOrder = async ({
  reference,
  currency = 'COP',
  taxes,
  customer,
  callbackUrl,
  deviceFingerprint,
} = {}) => {
  const order = await findOrder(reference);
  if (!order) return { ok: false, reason: 'orden_no_encontrada' };
  const intent = await bold.createPaymentIntent({
    referenceId: orderRef(order),
    amount: order.amount,
    currency,
    taxes,
    customer,
    callbackUrl,
    deviceFingerprint,
  });
  return { ok: true, orderId: order.id, intent };
};

// Paso 2: intento de pago (tarjeta/PSE/Nequi/Bancolombia/QR).
export const payOrder = async ({ reference, payer, paymentMethod, deviceFingerprint, metadata } = {}) => {
  await ensureCreds();
  const order = await findOrder(reference);
  if (!order) return { ok: false, reason: 'orden_no_encontrada' };
  const attempt = await bold.createPaymentAttempt({
    referenceId: orderRef(order),
    payer,
    paymentMethod,
    deviceFingerprint,
    metadata,
  });

  if (attempt?.status === 'APPROVED') {
    await markOrderPaid(order.id, {
      paymentId: attempt.transaction_id,
      payloadExtra: { bold_transaction_id: attempt.transaction_id, bold_status: 'APPROVED' },
    });
  }

  return { ok: true, orderId: order.id, attempt };
};

export const getOrderPaymentStatus = async (reference) => {
  await ensureCreds();
  const order = await findOrder(reference);
  if (!order) return { ok: false, reason: 'orden_no_encontrada' };
  const status = await bold.getPaymentStatus(orderRef(order));
  if (status?.status === 'APPROVED') {
    await markOrderPaid(order.id, {
      paymentId: status.transaction_id,
      payloadExtra: { bold_transaction_id: status.transaction_id, bold_status: 'APPROVED' },
    });
  }
  return { ok: true, orderId: order.id, status };
};

export const refundOrder = async (reference, { reason = 'Reembolso' } = {}) => {
  await ensureCreds();
  const order = await findOrder(reference);
  if (!order) return { ok: false, reason: 'orden_no_encontrada' };
  const status = await bold.getPaymentStatus(orderRef(order));
  if (!status?.transaction_id) return { ok: false, reason: 'sin_transaccion' };
  await bold.refundPayment({ referenceId: orderRef(order), transactionId: status.transaction_id, reason });
  return { ok: true, orderId: order.id, transactionId: status.transaction_id };
};

export const listBanks = () => bold.listPseBanks();
