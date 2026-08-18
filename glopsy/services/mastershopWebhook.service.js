import { pool } from '../db.js';
import { redisClient } from './redis.service.js';

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

  if (eventType.includes('order') || data.order_id || data.order_hash) {
    const orderId = data.order_id || data.id;
    const status = data.status;
    if (orderId && status) {
      await pool.query(
        `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 OR order_hash = $3`,
        [status, Number(orderId) || 0, String(orderId)]
      );
    }
  }

  if (eventType.includes('product') || data.product_id || data.public_id) {
    const product = data.product || data;
    const productId = product.id || product.product_id;
    const publicId = product.public_id;
    const name = product.name;
    const price = product.price || product.base_price;
    
    if (productId || publicId) {
      const tiendaId = data.tienda_id
        ? Number(data.tienda_id)
        : await resolveTiendaIdForWebhook(productId, publicId);

      await pool.query(
        `INSERT INTO produc (tienda_id, id, public_id, name, base_price, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO UPDATE SET tienda_id = EXCLUDED.tienda_id, name = EXCLUDED.name, base_price = EXCLUDED.base_price, updated_at = NOW()`,
        [tiendaId, Number(productId) || Math.floor(Math.random() * 1000000), publicId || String(productId), name || 'Producto Webhook', Number(price) || 0]
      );
      
      if (productId) {
        await redisClient.del(`producto:${productId}`);
      }
    }
  }

  return { ok: true, event: eventType, processed_at: new Date().toISOString() };
};
