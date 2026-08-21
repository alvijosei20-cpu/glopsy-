import { pool } from '../db.js';
import { redisClient } from './redis.service.js';
import { encryptSecret, decryptSecret, maskSecret } from '../utils/crypto.js';

const CACHE_TTL_SECONDS = 60;
const cacheKey = (userId) => `tienda:${userId}`;

const mapTienda = (row) => ({
  id: row.hashid,
  name: row.nombres,
  imageUrl: row.avatar,
  isActive: row.activa,
  registeredAt: row.fechareg,
});

export const getTiendaForUser = async (userId) => {
  const key = cacheKey(userId);
  const cached = await redisClient.get(key);

  if (cached) return JSON.parse(cached);

  const { rows } = await pool.query(
    `SELECT hashid, nombres, avatar, activa, fechareg
     FROM tiendas
     WHERE usrid = $1
     LIMIT 1`,
    [userId]
  );

  const tienda = rows[0] ? mapTienda(rows[0]) : null;
  await redisClient.set(key, JSON.stringify(tienda), { EX: CACHE_TTL_SECONDS });
  return tienda;
};

export const updateTiendaStatus = async (userId, isActive) => {
  const { rows } = await pool.query(
    `UPDATE tiendas
     SET activa = $1
     WHERE usrid = $2
     RETURNING hashid, nombres, avatar, activa, fechareg`,
    [isActive, userId]
  );

  if (!rows[0]) return null;

  const tienda = mapTienda(rows[0]);
  await redisClient.set(cacheKey(userId), JSON.stringify(tienda), { EX: CACHE_TTL_SECONDS });
  return tienda;
};

export const getDianConfigForUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT sw_id, sw_pin, technical_key, prefix, test_set_id
     FROM tienda_dian
     WHERE tienda_id = $1
     LIMIT 1`,
    [userId]
  );
  return rows[0] || { sw_id: '', sw_pin: '', technical_key: '', prefix: '', test_set_id: '' };
};

export const saveDianConfigForUser = async (userId, data) => {
  const { sw_id, sw_pin, technical_key, prefix, test_set_id } = data;
  const { rows } = await pool.query(
    `INSERT INTO tienda_dian (tienda_id, sw_id, sw_pin, technical_key, prefix, test_set_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (tienda_id)
     DO UPDATE SET 
       sw_id = EXCLUDED.sw_id,
       sw_pin = EXCLUDED.sw_pin,
       technical_key = EXCLUDED.technical_key,
       prefix = EXCLUDED.prefix,
       test_set_id = EXCLUDED.test_set_id,
       updated_at = NOW()
     RETURNING sw_id, sw_pin, technical_key, prefix, test_set_id`,
    [userId, sw_id, sw_pin, technical_key, prefix, test_set_id]
  );
  return rows[0];
};

export const getCheckoutIntegrationsForUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT provider, mode, public_key, access_token, webhook_secret, updated_at
     FROM checkout_integrations
     WHERE tienda_id = $1`,
    [userId]
  );
  return rows.map((row) => ({
    provider: row.provider,
    mode: row.mode,
    public_key: row.public_key,
    access_token: maskSecret(decryptSecret(row.access_token)),
    webhook_secret: row.webhook_secret ? maskSecret(decryptSecret(row.webhook_secret)) : '',
    updated_at: row.updated_at,
  }));
};

export const saveCheckoutIntegrationForUser = async (userId, provider, mode, { publicKey, accessToken, webhookSecret } = {}) => {
  const encPublicKey = publicKey || null;
  const encAccessToken = accessToken ? encryptSecret(accessToken) : null;
  const encWebhookSecret = webhookSecret ? encryptSecret(webhookSecret) : null;

  const { rows: existing } = await pool.query(
    `SELECT id, access_token FROM checkout_integrations WHERE tienda_id = $1 AND provider = $2 AND mode = $3 LIMIT 1`,
    [userId, provider, mode || 'prueba']
  );

  if (existing[0]) {
    const { rows } = await pool.query(
      `UPDATE checkout_integrations
       SET public_key = COALESCE($4, public_key),
           access_token = COALESCE($5, access_token),
           webhook_secret = COALESCE($6, webhook_secret),
           updated_at = NOW()
       WHERE tienda_id = $1 AND provider = $2 AND mode = $3
       RETURNING provider, mode, public_key, access_token, webhook_secret, updated_at`,
      [userId, provider, mode || 'prueba', encPublicKey, encAccessToken, encWebhookSecret]
    );
    return {
      provider: rows[0].provider,
      mode: rows[0].mode,
      public_key: rows[0].public_key,
      access_token: maskSecret(decryptSecret(rows[0].access_token)),
      webhook_secret: rows[0].webhook_secret ? maskSecret(decryptSecret(rows[0].webhook_secret)) : '',
      updated_at: rows[0].updated_at,
    };
  }

  if (!encAccessToken) {
    throw new Error('El token de acceso es obligatorio y no puede quedar vacío.');
  }

  const { rows } = await pool.query(
    `INSERT INTO checkout_integrations (tienda_id, provider, mode, public_key, access_token, webhook_secret, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING provider, mode, public_key, access_token, webhook_secret, updated_at`,
    [userId, provider, mode || 'prueba', encPublicKey, encAccessToken, encWebhookSecret]
  );
  return {
    provider: rows[0].provider,
    mode: rows[0].mode,
    public_key: rows[0].public_key,
    access_token: maskSecret(decryptSecret(rows[0].access_token)),
    webhook_secret: rows[0].webhook_secret ? maskSecret(decryptSecret(rows[0].webhook_secret)) : '',
    updated_at: rows[0].updated_at,
  };
};

export const deleteCheckoutIntegrationForUser = async (userId, provider, mode) => {
  const { rows } = await pool.query(
    `DELETE FROM checkout_integrations
     WHERE tienda_id = $1 AND provider = $2 AND mode = $3
     RETURNING provider, mode`,
    [userId, provider, mode || 'prueba']
  );
  return rows[0];
};

export const getStoreAnalytics = async (userId) => {
  const tiendaId = Number(userId);
  const analyticsKey = `tienda:analytics:${tiendaId}`;

  const cached = await redisClient.get(analyticsKey).catch(() => null);
  if (cached) return JSON.parse(cached);

  const [summaryRes, productsRes, reviewsRes, dayRes, topRes, catRes, statusRes] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'Completado')::int AS total_orders,
         COALESCE(SUM(amount) FILTER (WHERE status = 'Completado'), 0) AS total_revenue,
         COUNT(*) FILTER (WHERE status <> 'Completado')::int AS pending_orders,
         COALESCE(AVG(amount) FILTER (WHERE status = 'Completado'), 0) AS avg_order_value
       FROM orders
       WHERE tienda_id = $1`,
      [tiendaId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total_products,
              COALESCE(SUM(stock_total), 0)::int AS total_stock
       FROM produc
       WHERE tienda_id = $1`,
      [tiendaId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total_reviews,
              COALESCE(AVG(r.rating), 0)::numeric(3,2) AS avg_rating
       FROM reviews r
       JOIN produc p ON p.id = r.product_id
       WHERE p.tienda_id = $1`,
      [tiendaId]
    ),
    pool.query(
      `SELECT TO_CHAR(d.dia, 'YYYY-MM-DD') AS date,
              COALESCE(SUM(o.amount), 0)::numeric(12,2) AS ventas,
              COUNT(o.id)::int AS ordenes
       FROM generate_series(CURRENT_DATE - 29, CURRENT_DATE, '1 day') d(dia)
       LEFT JOIN orders o
         ON o.created_at::date = d.dia
        AND o.tienda_id = $1
        AND o.status = 'Completado'
       GROUP BY d.dia
       ORDER BY d.dia`,
      [tiendaId]
    ),
    pool.query(
      `SELECT oi.product_name AS name,
              SUM(oi.line_total)::numeric(12,2) AS ventas,
              SUM(oi.quantity)::int AS unidades,
              COUNT(DISTINCT o.id)::int AS ordenes
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.tienda_id = $1 AND o.status = 'Completado'
       GROUP BY oi.product_id, oi.product_name
       ORDER BY ventas DESC
       LIMIT 10`,
      [tiendaId]
    ),
    pool.query(
      `SELECT COALESCE(cat.nombre, 'Sin categoría') AS categoria,
              SUM(oi.line_total)::numeric(12,2) AS ventas,
              SUM(oi.quantity)::int AS cantidad
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN produc p ON p.id = oi.product_id
       LEFT JOIN categorias cat ON cat.id = p.categoria_id
       WHERE o.tienda_id = $1 AND o.status = 'Completado'
       GROUP BY cat.nombre
       ORDER BY ventas DESC`,
      [tiendaId]
    ),
    pool.query(
      `SELECT status, COUNT(*)::int AS cantidad
       FROM orders
       WHERE tienda_id = $1
       GROUP BY status
       ORDER BY cantidad DESC`,
      [tiendaId]
    ),
  ]);

  const summaryRow = summaryRes.rows[0] || {};
  const productsRow = productsRes.rows[0] || {};
  const reviewsRow = reviewsRes.rows[0] || {};

  const result = {
    summary: {
      total_revenue: Number(summaryRow.total_revenue || 0),
      total_orders: Number(summaryRow.total_orders || 0),
      pending_orders: Number(summaryRow.pending_orders || 0),
      avg_order_value: Number(summaryRow.avg_order_value || 0),
      total_products: Number(productsRow.total_products || 0),
      total_stock: Number(productsRow.total_stock || 0),
      total_reviews: Number(reviewsRow.total_reviews || 0),
      avg_rating: Number(reviewsRow.avg_rating || 0),
    },
    salesByDay: dayRes.rows,
    topProducts: topRes.rows,
    salesByCategory: catRes.rows,
    ordersByStatus: statusRes.rows,
  };

  await redisClient.set(analyticsKey, JSON.stringify(result), { EX: 60 }).catch(() => {});
  return result;
};
