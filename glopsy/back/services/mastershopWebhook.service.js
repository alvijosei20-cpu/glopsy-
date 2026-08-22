import { pool } from '../db.js';
import { redisClient } from './redis.service.js';
import { cleanString, toNumber } from '../utils/validation.js';
import { completeReturnsForOrder } from '../controllers/returns.controller.js';

const MASTERSHOP_STATUS_NAMES = {
  1: 'Por Confirmar',
  2: 'Pendiente',
  3: 'Por Alistar',
  4: 'Por Recolectar',
  5: 'Recolectada',
  6: 'En Tránsito',
  8: 'Entregada',
  9: 'Cancelada',
  10: 'Devuelta',
  11: 'Reclamaciones',
};

const FULFILLMENT_FROM_STATUS = {
  1: 'pending',
  2: 'pending',
  3: 'guia_generada',
  4: 'ready_for_pickup',
  5: 'shipped',
  6: 'in_transit',
  8: 'delivered',
  9: 'cancelled',
  10: 'returned',
  11: 'claim',
};

const pickTracking = (sh) => sh?.carrier_tracking_code ?? sh?.tracking_code ?? sh?.guide ?? sh?.tracking ?? sh?.waybill ?? sh?.guide_number ?? sh?.guideNumber ?? sh?.tracking_id ?? sh?.trackingId ?? null;

const deriveFulfillmentStatus = (idStatus, carrierStatus) => {
  const base = FULFILLMENT_FROM_STATUS[idStatus] || null;
  if (carrierStatus && idStatus === 6) {
    const s = String(carrierStatus).toLowerCase();
    if (/deliver|entregad/.test(s)) return 'delivered';
    if (/reparto|repartici/.test(s)) return 'out_for_delivery';
    if (/oficina|office/.test(s)) return 'in_office';
    if (/novedad|incident|anomal|novelty/.test(s)) return 'exception';
    return cleanString(carrierStatus, { maxLength: 50 }) || base;
  }
  return base;
};

const buildLogisticsShipment = (logistics, idStatus, carrierStatus) => {
  if (!logistics || typeof logistics !== 'object') return null;
  return {
    carrier: cleanString(logistics.carrier_name ?? logistics.carrier, { maxLength: 100 }) || null,
    tracking: cleanString(pickTracking(logistics), { maxLength: 200 }) || null,
    shippingUrl: cleanString(logistics.url_tracking ?? logistics.tracking_url, { maxLength: 500 }) || null,
    shippingLabel: cleanString(logistics.shipping_label, { maxLength: 500 }) || null,
    shippingRate: toNumber(logistics.shipping_rate, { min: 0, fallback: null }),
    idStatus: toNumber(idStatus, { min: 1, fallback: 0 }),
    fulfillmentStatus: deriveFulfillmentStatus(toNumber(idStatus, { min: 1, fallback: 0 }), carrierStatus),
    raw: logistics,
  };
};

const updateOrderShipmentsFromWebhook = async (orderId, { logistics, idStatus, carrierStatus, legacy = [] }) => {
  let list = legacy;
  if (logistics) list = [logistics];

  if (!orderId || list.length === 0) return 0;

  let updated = 0;
  for (const sh of list) {
    const shipmentNumber = toNumber(sh?.shipment_number ?? sh?.shipmentNumber ?? sh?.number, { min: 1, fallback: 0 });
    const tracking = cleanString(pickTracking(sh), { maxLength: 200 }) || null;
    const status = cleanString(sh?.status ?? sh?.status_name ?? sh?.fulfillment_status, { maxLength: 50 }) || null;
    const statusId = toNumber(sh?.id_status ?? sh?.status_id ?? sh?.mastershop_status_id, { min: 1, fallback: 0 }) || toNumber(idStatus, { min: 1, fallback: 0 });
    const fulfillmentStatus = cleanString(sh?.fulfillment_status ?? deriveFulfillmentStatus(statusId, carrierStatus), { maxLength: 50 }) || null;
    const shippingUrl = cleanString(sh?.shipping_url ?? sh?.url_tracking ?? sh?.tracking_url ?? sh?.guide_url ?? sh?.url, { maxLength: 500 }) || null;
    const carrier = cleanString(sh?.carrier_name ?? sh?.carrier, { maxLength: 100 }) || null;
    const shippingCost = toNumber(sh?.shipping_rate ?? sh?.shippingRate ?? sh?.shipping_cost, { min: 0, fallback: null });

    const params = [Number(orderId) || 0];
    const sets = ['updated_at = NOW()'];
    if (statusId) { sets.push(`mastershop_status_id = $${params.length + 1}`); params.push(statusId); }
    if (status || fulfillmentStatus) { sets.push(`fulfillment_status = $${params.length + 1}`); params.push(fulfillmentStatus || status); }
    // Fija delivered_at una sola vez cuando el envío pasa a entregado
    if (statusId === 8 || /deliver|entregad/i.test(String(fulfillmentStatus || status || ''))) {
      sets.push(`delivered_at = COALESCE(delivered_at, NOW())`);
    }
    if (tracking) { sets.push(`tracking_code = $${params.length + 1}`); params.push(tracking); }
    if (shippingUrl) { sets.push(`shipping_url = $${params.length + 1}`); params.push(shippingUrl); }
    if (carrier) { sets.push(`carrier = $${params.length + 1}`); params.push(carrier); }
    if (shippingCost !== null) { sets.push(`shipping_cost = $${params.length + 1}`); params.push(shippingCost); }
    sets.push(`payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{webhook}', $${params.length + 1}::jsonb)`);
    params.push(JSON.stringify(sh));

    let where;
    if (shipmentNumber) {
      where = `shipment_number = $${params.length + 1}`;
      params.push(shipmentNumber);
    } else if (tracking) {
      where = `(tracking_code = $${params.length + 1} OR payload->>'carrier_tracking_code' = $${params.length + 1} OR payload->>'tracking_code' = $${params.length + 1} OR payload->>'guide' = $${params.length + 1})`;
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

const updateOrderFromWebhook = async (mastershopOrderId, data) => {
  const idStatus = toNumber(data?.id_status ?? data?.status_id, { min: 1, fallback: 0 });
  const statusName = cleanString(data?.status ?? data?.status_name ?? MASTERSHOP_STATUS_NAMES[idStatus] ?? data?.confirmation_status_name, { maxLength: 50 });
  const carrierStatus = cleanString(data?.carrier_status_info?.carrier_status, { maxLength: 100 });
  const fulfillmentStatus = deriveFulfillmentStatus(idStatus, carrierStatus);
  const logistics = buildLogisticsShipment(data?.order_logistics, idStatus, carrierStatus);

  let params = [];
  const sets = ['updated_at = NOW()'];
  if (statusName) { sets.push(`status = $${params.length + 1}`); params.push(statusName); }
  if (fulfillmentStatus) { sets.push(`fulfillment_status = $${params.length + 1}`); params.push(fulfillmentStatus); }
  if (idStatus) { sets.push(`mastershop_status_id = $${params.length + 1}`); params.push(idStatus); }
  if (logistics?.tracking) { sets.push(`tracking_code = $${params.length + 1}`); params.push(logistics.tracking); }
  if (logistics?.carrier) { sets.push(`carrier = $${params.length + 1}`); params.push(logistics.carrier); }
  if (logistics?.shippingUrl) { sets.push(`shipping_url = $${params.length + 1}`); params.push(logistics.shippingUrl); }
  sets.push(`payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{id_order}', $${params.length + 1}::jsonb)`);
  params.push(JSON.stringify(String(mastershopOrderId)));
  sets.push(`payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{webhook}', $${params.length + 1}::jsonb)`);
  params.push(JSON.stringify(data));

  const matchIdx = params.length;
  params.push(Number(mastershopOrderId) || 0, String(mastershopOrderId), String(mastershopOrderId), String(mastershopOrderId));
  const where = `id = $${matchIdx + 1} OR order_hash = $${matchIdx + 2} OR order_number = $${matchIdx + 3} OR payload->>'id_order' = $${matchIdx + 4}`;

  const res = await pool.query(`UPDATE orders SET ${sets.join(', ')} WHERE ${where}`, params);
  return res.rowCount || 0;
};

export const processMastershopWebhookEvent = async (payload) => {
  const eventType = payload.event || payload.type || payload.action || 'unknown';
  const data = payload.data || payload;

  console.log(`[Mastershop Webhook] Procesando evento: ${eventType}`, JSON.stringify(data).slice(0, 200));

  const isOrderEvent =
    eventType.includes('order') ||
    eventType.includes('shipment') ||
    eventType.includes('tracking') ||
    eventType.includes('guide') ||
    data?.id_order ||
    data?.id_status ||
    data?.order_logistics ||
    data?.carrier_status_info ||
    data?.order_id ||
    data?.order_hash ||
    data?.shipment_id;

  if (isOrderEvent) {
    const orderId = cleanString(data?.id_order ?? data?.order_id ?? data?.id, { maxLength: 100 });
    if (orderId) {
      const updatedOrders = await updateOrderFromWebhook(orderId, data);

      const legacy = Array.isArray(data?.shipments) && data.shipments.length > 0
        ? data.shipments
        : Array.isArray(data?.envios) && data.envios.length > 0
          ? data.envios
          : [];
      const updatedShipments = await updateOrderShipmentsFromWebhook(orderId, {
        logistics: buildLogisticsShipment(data?.order_logistics, toNumber(data?.id_status, { min: 1, fallback: 0 }), cleanString(data?.carrier_status_info?.carrier_status, { maxLength: 100 })),
        idStatus: toNumber(data?.id_status, { min: 1, fallback: 0 }),
        carrierStatus: cleanString(data?.carrier_status_info?.carrier_status, { maxLength: 100 }),
        legacy,
      });

      console.log(`[Mastershop Webhook] Orden ${orderId}: ${updatedOrders} orden(es), ${updatedShipments} envío(s) actualizados.`);

      // Si la orden pasó a DEVUELTA (id_status 10 / fulfillment_status returned),
      // completamos los tickets de devolución pendientes y reponemos el stock.
      const returnedIdStatus = toNumber(data?.id_status, { min: 1, fallback: 0 });
      const returnedFulfillment = cleanString(data?.fulfillment_status, { maxLength: 50 });
      const isReturned =
        returnedIdStatus === 10 ||
        /^returned$/i.test(returnedFulfillment) ||
        /devuelta|devuelt/i.test(cleanString(data?.status, { maxLength: 50 }));

      if (isReturned) {
        const completed = await completeReturnsForOrder(orderId, data);
        if (completed > 0) {
          console.log(`[Mastershop Webhook] Orden ${orderId} devuelta: ${completed} devolución(es) completada(s).`);
        }
      }
    }
  }

  if (eventType.includes('product') || data?.product_id || data?.public_id) {
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
