import { pool } from '../db.js';
import { redisClient } from './redis.service.js';

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
      await pool.query(
        `INSERT INTO produc (id, public_id, name, base_price, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, base_price = EXCLUDED.base_price, updated_at = NOW()`,
        [Number(productId) || Math.floor(Math.random() * 1000000), publicId || String(productId), name || 'Producto Webhook', Number(price) || 0]
      );
      
      if (productId) {
        await redisClient.del(`producto:${productId}`);
      }
    }
  }

  return { ok: true, event: eventType, processed_at: new Date().toISOString() };
};
