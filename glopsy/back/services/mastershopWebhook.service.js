import { pool } from '../db.js';
import { redisClient } from './redis.service.js';
import { cleanString, toNumber } from '../utils/validation.js';

const pickTracking = (sh) => sh?.guide ?? sh?.tracking ?? sh?.waybill ?? sh?.guide_number ?? sh?.guideNumber ?? sh?.tracking_id ?? sh?.trackingId ?? sh?.tracking_code ?? null;

const updateOrderShipmentsFromWebhook = async (orderId, data) => {
  let list = [];
  if (Array.isArray(data?.shipments) && data.shipments.length > 0) list = data.shipments;
  else if (Array.isArray(data?.envios) && data.envios.length > 0) list = data.envios;
  else if (data && (data.shipment_id || data.shipment_number || pickTracking(data) || data.status)) list = [data];

  if (!orderId || list.length === 0) return 0;

  let updated = 0;
  for (const sh of list) {
    const shipmentNumber = toNumber(sh?.shipment_number ?? sh?.shipmentNumber ?? sh?.number, { min: 1, fallback: 0 });
    const tracking = cleanString(pickTracking(sh), { maxLength: 200 }) || null;
    const status = cleanString(sh?.status ?? sh?.status_name ?? sh?.fulfillment_status, { maxLength: 50 }) || null;
    const statusId = toNumber(sh?.status_id ?? sh?.mastershop_status_id, { min: 1, fallback: 0 });
    const shippingUrl = cleanString(sh?.shipping_url ?? sh?.tracking_url ?? sh?.guide_url ?? sh?.url, { maxLength: 500 }) || null;

    const params = [Number(orderId) || 0];
    const sets = ['updated_at = NOW()'];
    if (status) { sets.push(`fulfillment_status = $${params.length + 1}`); params.push(status); }
    if (tracking) { sets.push(`tracking_code = $${params.length + 1}`); params.push(tracking); }
    if (shippingUrl) { sets.push(`shipping_url = $${params.length + 1}`); params.push(shippingUrl); }
    if (statusId) { sets.push(`mastershop_status_id = $${params.length + 1}`); params.push(statusId); }
    sets.push(`payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{webhook}', $${params.length + 1}::jsonb)`);
    params.push(JSON.stringify(sh));

    let where;
    if (shipmentNumber) {
      where = `shipment_number = $${params.length + 1}`;
      params.push(shipmentNumber);
    } else if (tracking) {
      where = `(tracking_code = $${params.length + 1} OR payload->>'guide' = $${params.length + 1} OR payload->>'tracking' = $${params.length + 1} OR payload->>'guide_number' = $${params.length + 1})`;
      params.push(tracking);
    } else {
      where = `(SELECT count(*) FROM order_shipments WHERE order_id = $1) = 1`;
    }

    const res = await pool.query(
      `UPDATE order_shipments SET ${sets.join(', ')} WHERE order_id = $1 AND ${where}`,
      params
    );
    updated += res.rowCount || 0;
  }
  return updated;
};

const resolveTiendaIdForWebhook = async (productId, publicId) => {
  const { rows: existing } = await pool.query(
    `SELECT tienda_id FROM produc WHERE id = $1 OR public_id = $2 LIMIT 1`,
    [Number(productId) || 0, publicId || '']
  );
  if (existing[0]?.tienda_id) return Number(existing[0].tienda_id);

  const { rows: tiendaRows } = await pool.query(`SELECT usrid FROM tiendas ORDER BY usrid LIMIT 1`);
  return tiendaRows[0]?.usrid ? Number(tiendaRows[0].usrid) : 1;
};

export const processMastershopWebhookEvent = async (payload) => {
  const eventType = payload.event || payload.type || payload.action || 'unknown';
  const data = payload.data || payload;

  console.log(`[Mastershop Webhook] Procesando evento: ${eventType}`, JSON.stringify(data).slice(0, 200));

  if (eventType.includes('order') || eventType.includes('shipment') || eventType.includes('tracking') || eventType.includes('guide') || data.order_id || data.order_hash || data.shipment_id) {
    const orderId = cleanString(data.order_id ?? data.id, { maxLength: 100 });
    const status = cleanString(data.status, { maxLength: 50 });
    if (orderId) {
      if (status) {
        await pool.query(
          `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 OR order_hash = $3`,
          [status, Number(orderId) || 0, String(orderId)]
        );
      }
      await updateOrderShipmentsFromWebhook(orderId, data);
    }
  }

  if (eventType.includes('product') || data.product_id || data.public_id) {
    const product = data.product || data;
    const productId = cleanString(product.id ?? product.product_id, { maxLength: 100 });
    const publicId = cleanString(product.public_id, { maxLength: 100 });
    const name = cleanString(product.name, { maxLength: 255 });
    const price = toNumber(product.price ?? product.base_price, { min: 0, fallback: 0 });
    
    if (productId || publicId) {
      const tiendaId = data.tienda_id
        ? toNumber(data.tienda_id, { min: 1, fallback: 1 })
        : await resolveTiendaIdForWebhook(productId, publicId);

      await pool.query(
        `INSERT INTO produc (tienda_id, id, public_id, name, base_price, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO UPDATE SET tienda_id = EXCLUDED.tienda_id, name = EXCLUDED.name, base_price = EXCLUDED.base_price, updated_at = NOW()`,
        [tiendaId, Number(productId) || Math.floor(Math.random() * 1000000), publicId || String(productId), name || 'Producto Webhook', price]
      );
      
      if (productId) {
        await redisClient.del(`producto:${productId}`);
        const keys = [`product:detail:${productId}`];
        if (publicId) keys.push(`product:detail:${publicId}`);
        await redisClient.del(keys).catch(() => {});
      }
    }
  }

  return { ok: true, event: eventType, processed_at: new Date().toISOString() };
};
