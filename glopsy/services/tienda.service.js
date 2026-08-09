import { pool } from '../db.js';
import { redisClient } from './redis.service.js';

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
    `SELECT provider, mode, public_key, access_token, updated_at
     FROM checkout_integrations
     WHERE tienda_id = $1`,
    [userId]
  );
  return rows;
};

export const saveCheckoutIntegrationForUser = async (userId, provider, mode, publicKey, accessToken) => {
  const { rows } = await pool.query(
    `INSERT INTO checkout_integrations (tienda_id, provider, mode, public_key, access_token, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (tienda_id, provider, mode)
     DO UPDATE SET 
       public_key = EXCLUDED.public_key,
       access_token = EXCLUDED.access_token,
       updated_at = NOW()
     RETURNING provider, mode, public_key, access_token, updated_at`,
    [userId, provider, mode || 'prueba', publicKey || null, accessToken]
  );
  return rows[0];
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
