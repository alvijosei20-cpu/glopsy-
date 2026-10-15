// ==========================================
// Webhook de ENVIA (tracking.simple / surcharge).
//
// ENVIA envía un POST cuando cambia el estado de un envío. Actualizamos el
// envío local (order_shipments) por tracking_code y el agregado de la orden.
// Doc: https://docs.envia.com/docs/webhooks
// ==========================================

import crypto from 'node:crypto';
import { pool } from '../db.js';
import { decryptSecret } from '../utils/crypto.js';

// Mapea el estado de ENVIA al fulfillment_status interno.
const deriveFulfillment = (status) => {
  const s = String(status || '').trim().toLowerCase();
  if (!s) return null;
  if (/deliver|entregad|receiv/.test(s)) return 'delivered';
  if (/out.?for.?deliver|reparto|en camino|en ruta|última milla|ultima milla/.test(s)) return 'out_for_delivery';
  if (/in.?transit|transito|tránsito|en transito|en tránsito|movimiento|transit/.test(s)) return 'in_transit';
  if (/pick|recolect|recogid|collect|admit|admiti|bodega|warehouse/.test(s)) return 'shipped';
  if (/return|devol/.test(s)) return 'returned';
  if (/except|fail|novedad|intento|rechaz|anomal|problema|retras|demorad/.test(s)) return 'exception';
  if (/label|guia|guía|cread|generad|ready|listo/.test(s)) return 'guia_generada';
  return s.slice(0, 50);
};

const pickTracking = (d = {}) =>
  d.tracking_number || d.trackingNumber || d.tracking || d.guide || d.guide_number || d.waybill || null;

// Verifica la firma X-Webhook-Signature: v1=HMAC(ts + "." + event + "." + body_json, secret).
// Si no hay secret, no se exige (permite el test).
export const verifyEnviaSignature = (rawBody, headers = {}, secret = process.env.ENVIA_WEBHOOK_SECRET) => {
  if (!secret) return true;
  const received = headers['x-webhook-signature'];
  if (!received) return false;
  const ts = headers['x-webhook-timestamp'] || '';
  const event = headers['x-webhook-event'] || '';
  const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : String(rawBody || '');
  const expected = 'v1=' + crypto.createHmac('sha256', secret).update(`${ts}.${event}.${raw}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(received));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Secreto de firma configurado por la tienda dueña del envío (panel > ENVIA).
const getStoreEnviaWebhookSecret = async (tracking) => {
  if (!tracking) return null;
  const { rows } = await pool.query(
    `SELECT ci.webhook_secret
     FROM order_shipments s
     JOIN orders o ON o.id = s.order_id
     JOIN checkout_integrations ci ON ci.tienda_id = o.tienda_id AND ci.provider = 'envia'
     WHERE s.tracking_code = $1 AND ci.webhook_secret IS NOT NULL
     ORDER BY (ci.mode = 'produccion') DESC
     LIMIT 1`,
    [String(tracking)]
  );
  const enc = rows[0]?.webhook_secret;
  return enc ? decryptSecret(enc) : null;
};

export const processEnviaWebhookEvent = async (payload = {}, { rawBody = null, headers = {} } = {}) => {
  const type = payload.type || payload.event || 'unknown';
  const data = payload.data || payload;
  const tracking = pickTracking(data);

  // Firma: usa el secreto de la tienda del envío; si no, el global (env).
  const storeSecret = await getStoreEnviaWebhookSecret(tracking).catch(() => null);
  const secret = storeSecret || process.env.ENVIA_WEBHOOK_SECRET || null;
  if (secret && rawBody != null && !verifyEnviaSignature(rawBody, headers, secret)) {
    return { ok: false, status: 401, reason: 'firma_invalida' };
  }

  const status = data.status || data.status_description || data.statustext || null;
  const fulfillment = deriveFulfillment(data.status || data.status_description);
  const carrier = data.carrier_name || data.carrier || null;

  console.log(`[ENVIA Webhook] ${type} | tracking=${tracking} | status=${status} | -> ${fulfillment}`);

  if (!tracking) {
    return { ok: true, ignored: true, reason: 'sin_tracking', type };
  }

  // Estado previo de los envíos con ese tracking (para notificar solo en cambios).
  const prevRows = (
    await pool.query(
      `SELECT id, order_id, fulfillment_status FROM order_shipments WHERE tracking_code = $1`,
      [tracking]
    )
  ).rows;

  const { rows } = await pool.query(
    `UPDATE order_shipments
     SET fulfillment_status = COALESCE($2, fulfillment_status),
         carrier = COALESCE($3, carrier),
         delivered_at = CASE WHEN $2 = 'delivered' THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END,
         payload = COALESCE(payload, '{}'::jsonb) || $4::jsonb,
         updated_at = NOW()
     WHERE tracking_code = $1
     RETURNING order_id`,
    [tracking, fulfillment, carrier, JSON.stringify({ envia_webhook: data, webhook_type: type })]
  );

  const orderIds = [...new Set(rows.map((r) => r.order_id).filter(Boolean))];
  for (const orderId of orderIds) {
    await pool.query(
      `UPDATE orders
       SET fulfillment_status = COALESCE($2, fulfillment_status),
           tracking_code = COALESCE($3, tracking_code),
           carrier = COALESCE($4, carrier),
           payload = COALESCE(payload, '{}'::jsonb) || $5::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [orderId, fulfillment, tracking, carrier, JSON.stringify({ envia_webhook: data })]
    );
  }

  // Notifica al comprador en hitos relevantes (sin repetir el mismo estado).
  const NOTIFY = {
    out_for_delivery: 'Tu pedido está en reparto',
    delivered: 'Tu pedido fue entregado',
    exception: 'Novedad en tu pedido',
    returned: 'Tu pedido fue devuelto',
  };
  if (fulfillment && NOTIFY[fulfillment] && prevRows.length > 0) {
    const changed = prevRows.some((p) => p.fulfillment_status !== fulfillment);
    if (changed && orderIds.length > 0) {
      try {
        const { rows: orderRows } = await pool.query(
          `SELECT id, user_id, guest_hash, order_hash, order_number FROM orders WHERE id = ANY($1::int[])`,
          [orderIds]
        );
        const { createNotification } = await import('./product.service.js');
        for (const o of orderRows) {
          await createNotification(
            o.user_id,
            o.guest_hash,
            o.id,
            `Pedido #${o.order_number || o.id}: ${NOTIFY[fulfillment]}`,
            `${NOTIFY[fulfillment]}. Guía ${tracking}${data.location ? ` · ${data.location}` : ''}.`,
            'order_status',
            { tracking, status: fulfillment, location: data.location || null },
            o.order_hash ? `/compras/${o.order_hash}` : '/consultar-pedido'
          );
        }
      } catch (e) {
        console.error('[ENVIA Webhook] No se pudo notificar al comprador:', e.message);
      }
    }
  }

  return { ok: true, type, tracking, status: fulfillment, shipments: rows.length, orders: orderIds.length };
};

export default { processEnviaWebhookEvent, verifyEnviaSignature };
