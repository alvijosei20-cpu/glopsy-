// ==========================================
// Cobro por QR Bre-B con la API de Pagos en Línea de Bold.
//
// Flujo:
//   1. Crea la orden pendiente (reserva stock) -> createPendingOrderForCart.
//   2. Aplica el recargo de la pasarela (método QR Bre-B) si el front lo envía.
//   3. Crea la intención de pago y el intento QR en Bold y devuelve el qr_payload.
//   4. El front renderiza el QR; el estado se consulta aquí (polling) y por webhook.
//
// Requiere que la cuenta Bold tenga Cuenta Bold + QR activos y las llaves de la
// integración "API pagos en línea".
// ==========================================

import { pool } from '../db.js';
import { createPendingOrderForCart } from './product.service.js';
import { loadBoldCredentials } from './paymentConfig.service.js';
import { resolveCheckoutCurrency, convertAmount } from './checkoutCurrency.service.js';
import { markOrderPaid } from './boldCheckout.service.js';
import {
  createPaymentIntent,
  createQrPayment,
  getPaymentStatus,
  isBoldApiConfigured,
  isBoldWebhookSecretConfigured,
  setBoldApiIdentityKey,
  setBoldApiSecretKey,
  verifyBoldWebhookSignature,
} from './boldApi.service.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const cleanString = (v, { maxLength = 30 } = {}) => String(v || '').trim().slice(0, maxLength);

const DOC_TYPE_MAP = {
  CC: 'CEDULA',
  CEDULA: 'CEDULA',
  CE: 'CEDULA_EXTRANJERIA',
  CEDULA_EXTRANJERIA: 'CEDULA_EXTRANJERIA',
  PAS: 'PASAPORTE',
  PP: 'PASAPORTE',
  PASAPORTE: 'PASAPORTE',
  NIT: 'NIT',
  TI: 'TARJETA_IDENTIDAD',
};
const boldDocType = (value) => DOC_TYPE_MAP[String(value || '').toUpperCase()] || 'CEDULA';

const ensureCreds = async () => {
  const creds = await loadBoldCredentials().catch(() => null);
  if (creds?.publicKey) setBoldApiIdentityKey(creds.publicKey);
  if (creds?.privateKey) setBoldApiSecretKey(creds.privateKey);
  return creds;
};

const findOrder = async (reference) => {
  if (!reference) return null;
  const { rows } = await pool.query(
    `SELECT id, tienda_id, order_number, order_hash, status, amount, currency
     FROM orders
     WHERE order_number = $1
        OR order_hash = $1
        OR payload->>'bold_qr_reference' = $1
     ORDER BY id DESC
     LIMIT 1`,
    [String(reference)]
  );
  return rows[0] || null;
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

// Inicia el cobro por QR Bre-B: crea la orden y devuelve el QR a mostrar.
export const startBoldQrCheckout = async (userId, {
  items,
  customerInfo = {},
  guestHash = null,
  shippingCost = 0,
  shippingPayload = null,
  visitor = null,
  billing = {},
  paymentMethod = 'qr_breb',
  gatewayFee = null,
  qrFormat = 'BOLD_BASE64',
} = {}) => {
  await ensureCreds();
  if (!isBoldApiConfigured()) return { ok: false, reason: 'bold_no_configurado' };
  if (!Array.isArray(items) || items.length === 0) return { ok: false, reason: 'carrito_vacio' };

  const order = await createPendingOrderForCart(userId, items, {
    customerInfo,
    guestHash,
    shippingCost,
    shippingPayload,
  });

  const { currency, rate, converted } = await resolveCheckoutCurrency(order.tiendaId, visitor);
  let chargeAmount = converted ? convertAmount(order.totalAmount, rate) : order.totalAmount;

  let fee = null;
  if (gatewayFee && Number.isFinite(Number(gatewayFee.total)) && Number(gatewayFee.total) >= 0) {
    const feeTotal = round2(Number(gatewayFee.total));
    const maxFee = round2(Number(order.totalAmount) * 0.10) + 10000;
    if (feeTotal <= maxFee) {
      fee = {
        method: cleanString(paymentMethod, { maxLength: 30 }) || 'qr_breb',
        base: Number.isFinite(Number(gatewayFee.base)) ? round2(Number(gatewayFee.base)) : 0,
        iva: Number.isFinite(Number(gatewayFee.iva)) ? round2(Number(gatewayFee.iva)) : 0,
        total: feeTotal,
      };
      chargeAmount = round2(chargeAmount + feeTotal);
    }
  }

  await pool.query(
    `UPDATE orders SET amount = $2, currency = $3,
          payload = COALESCE(payload, '{}'::jsonb) || $4::jsonb
     WHERE id = $1`,
    [order.orderId, chargeAmount, currency, JSON.stringify(fee ? { bold_fee: fee } : {})]
  );

  if (String(currency).toUpperCase() === 'USD') {
    await pool.query(`UPDATE orders SET es_exportacion = TRUE WHERE id = $1`, [order.orderId]);
  }

  const customer = {
    ...(billing.name ? { name: cleanString(billing.name, { maxLength: 120 }) } : {}),
    ...(billing.phone ? { phone: cleanString(billing.phone, { maxLength: 20 }) } : {}),
    ...(billing.email ? { email: cleanString(billing.email, { maxLength: 120 }) } : {}),
  };

  const intent = await createPaymentIntent({
    referenceId: order.orderNumber,
    amount: chargeAmount,
    currency,
    description: `Pedido ${order.orderNumber}`,
    customer,
    metadata: { key: 'order_id', value: String(order.orderId) },
  });
  if (!intent.ok) return { ok: false, reason: 'bold_intent_error', error: intent.error };

  const payer = {
    person_type: 'NATURAL_PERSON',
    name: cleanString(billing.name, { maxLength: 120 }) || 'Cliente Glopsy',
    phone: cleanString(billing.phone, { maxLength: 20 }) || '3000000000',
    email: cleanString(billing.email, { maxLength: 120 }) || 'pagos@glopsy.co',
    document_type: boldDocType(billing.documentType),
    document_number: cleanString(billing.documentNumber, { maxLength: 30 }) || '222222222222',
    ...(billing.address ? {
      billing_address: {
        street1: cleanString(billing.address, { maxLength: 120 }),
        city: 'Bogotá',
        country: 'CO',
      },
    } : {}),
  };

  const payment = await createQrPayment({
    referenceId: order.orderNumber,
    payer,
    qrFormat,
    metadata: { key: 'order_id', value: String(order.orderId) },
  });
  if (!payment.ok) return { ok: false, reason: 'bold_qr_error', error: payment.error };

  const qrPayload = payment.data?.next_actions?.qr_payload || null;
  const expiresAt = payment.data?.next_actions?.expires_at || null;
  const transactionId = payment.data?.transaction_id || null;

  if (!qrPayload) return { ok: false, reason: 'bold_qr_sin_payload', error: payment.data };

  await pool.query(
    `UPDATE orders SET payload = COALESCE(payload, '{}'::jsonb) || $2::jsonb, updated_at = NOW()
     WHERE id = $1`,
    [order.orderId, JSON.stringify({
      bold_qr_reference: order.orderNumber,
      bold_qr: {
        reference_id: order.orderNumber,
        transaction_id: transactionId,
        qr_format: qrFormat,
        expires_at: expiresAt,
      },
    })]
  );

  return {
    ok: true,
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    orderHash: order.orderHash,
    amount: chargeAmount,
    currency,
    gatewayFee: fee,
    qr: {
      payload: qrPayload,
      format: qrFormat,
      expiresAt,
      transactionId,
    },
  };
};

// Marca la orden según el estado reportado por la API de Bold (idempotente).
const applyBoldStatus = async (order, boldStatus, extra = {}) => {
  const st = String(boldStatus || '').toUpperCase();
  if (st === 'APPROVED') {
    if (order.status === 'Completado') return 'APPROVED';
    await markOrderPaid(order.id, {
      refBold: extra.transactionId || null,
      payloadExtra: { bold_qr_status: st, ...extra.payloadExtra },
    });
    return 'APPROVED';
  }
  if (st === 'REJECTED') {
    await updateOrderStatus(order.id, 'rejected', { bold_qr_status: st, ...extra.payloadExtra });
    return 'REJECTED';
  }
  return 'PENDING';
};

// Estado de la orden QR para el polling del frontend. Consulta a Bold si sigue
// pendiente y contabiliza la venta cuando la transacción fue aprobada.
export const getBoldQrStatus = async (reference) => {
  await ensureCreds();
  const order = await findOrder(reference);
  if (!order) return { ok: false, reason: 'orden_no_encontrada' };

  const map = {
    Completado: 'APPROVED',
    rejected: 'REJECTED',
    refunded: 'REFUNDED',
    pending: 'PENDING',
  };

  if (order.status === 'Completado' || order.status === 'rejected') {
    return { ok: true, orderId: order.id, status: map[order.status], orderStatus: order.status };
  }
  if (!isBoldApiConfigured()) {
    return { ok: true, orderId: order.id, status: 'PENDING', orderStatus: order.status };
  }

  const res = await getPaymentStatus(order.order_number);
  if (!res.ok) {
    return { ok: true, orderId: order.id, status: 'PENDING', orderStatus: order.status };
  }

  const st = String(res.data?.status || '').toUpperCase();
  const status = await applyBoldStatus(order, st, {
    transactionId: res.data?.transaction_id || null,
    payloadExtra: { bold_qr_status_detail: res.data?.status_detail || null },
  });
  return {
    ok: true,
    orderId: order.id,
    status,
    orderStatus: status === 'APPROVED' ? 'Completado' : order.status,
  };
};

// Webhook de la API de Bold (x-bold-signature). Idempotente.
export const processBoldQrWebhook = async (payload = {}, { rawBody = null, signature = null } = {}) => {
  await ensureCreds();
  const hasSecret = isBoldWebhookSecretConfigured();
  if (hasSecret && !verifyBoldWebhookSignature(rawBody, signature)) {
    return { ok: false, status: 401, reason: 'firma_invalida' };
  }

  const type = String(payload.type || '').toUpperCase();
  const reference = payload?.data?.metadata?.reference || null;
  const order = await findOrder(reference);
  if (!order) {
    console.warn(`[Bold QR Webhook] Sin orden para reference=${reference} type=${type}`);
    return { ok: true, ignored: true, reason: 'orden_no_encontrada' };
  }

  const transactionId = payload?.data?.payment_id || payload.subject || null;

  if (type === 'SALE_APPROVED') {
    if (order.status === 'Completado') return { ok: true, ignored: true, reason: 'ya_procesada', orderId: order.id };
    await markOrderPaid(order.id, {
      refBold: transactionId,
      payloadExtra: { bold_qr_status: 'APPROVED', bold_qr_event: type, bold_qr_transaction: transactionId },
    });
    return { ok: true, orderId: order.id, status: 'Completado' };
  }
  if (type === 'SALE_REJECTED') {
    await updateOrderStatus(order.id, 'rejected', { bold_qr_status: 'REJECTED', bold_qr_event: type });
    return { ok: true, orderId: order.id, status: 'rejected' };
  }
  if (type.startsWith('VOID')) {
    await updateOrderStatus(order.id, 'refunded', { bold_qr_status: 'REFUNDED', bold_qr_event: type });
    return { ok: true, orderId: order.id, status: 'refunded' };
  }

  return { ok: true, ignored: true, orderId: order.id, type };
};
