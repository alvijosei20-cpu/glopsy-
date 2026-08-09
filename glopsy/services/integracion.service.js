import axios from 'axios';
import { pool } from '../db.js';
import { redisClient } from './redis.service.js';

const CACHE_TTL_SECONDS = 60;
const cacheKey = (userId) => `integraciones:${userId}`;

const GLOBAL_API_URLS = {
  mastershop: process.env.MASTERSHOP_API_URL || 'https://prod.api.mastershop.com/api',
  dropi: process.env.DROPI_API_URL || 'https://api.dropi.co/api',
};

// Sanitización y prevención de código malicioso / XSS básico
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>]/g, '') // Elimina caracteres potenciales de inyección HTML/XSS
    .slice(0, 500); // Límite de longitud razonable para una API key
};

export const getIntegracionesForUser = async (userId) => {
  const key = cacheKey(userId);
  const cached = await redisClient.get(key);

  if (cached) {
    return JSON.parse(cached);
  }

  // Consulta parametrizada para evitar SQL Injection
  const { rows } = await pool.query(
    `SELECT provider, api_key 
     FROM tienda_integraciones 
     WHERE user_id = $1`,
    [userId]
  );

  const integraciones = {};
  rows.forEach((row) => {
    integraciones[row.provider] = row.api_key;
  });

  await redisClient.set(key, JSON.stringify(integraciones), { EX: CACHE_TTL_SECONDS });
  return integraciones;
};

export const saveIntegracionForUser = async (userId, provider, apiKey) => {
  const allowedProviders = ['mastershop', 'dropi'];
  if (!allowedProviders.includes(provider)) {
    throw new Error('Proveedor de integración no válido.');
  }

  const sanitizedKey = sanitizeInput(apiKey);
  if (!sanitizedKey) {
    throw new Error('La clave de API no puede estar vacía.');
  }

  // Upsert con consulta parametrizada (Previene SQL Injection)
  const { rows } = await pool.query(
    `INSERT INTO tienda_integraciones (user_id, provider, api_key, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, provider)
     DO UPDATE SET api_key = EXCLUDED.api_key, updated_at = NOW()
     RETURNING provider, api_key`,
    [userId, provider, sanitizedKey]
  );

  // Invalidar/Actualizar caché en Redis
  const key = cacheKey(userId);
  const current = (await redisClient.get(key)) ? JSON.parse(await redisClient.get(key)) : {};
  current[provider] = rows[0].api_key;
  await redisClient.set(key, JSON.stringify(current), { EX: CACHE_TTL_SECONDS });

  return current;
};

export const queryIntegrationProduct = async (userId, provider, productId) => {
  const allowedProviders = ['mastershop', 'dropi'];
  if (!allowedProviders.includes(provider)) {
    throw new Error('Proveedor de integración no válido.');
  }

  const sanitizedProductId = sanitizeInput(String(productId));
  if (!sanitizedProductId) {
    throw new Error('ID de producto inválido.');
  }

  // 1. Intentar obtener la API key desde la caché de Redis del usuario
  let apiKey = null;
  const integracionesCacheKey = cacheKey(userId);
  const cachedIntegraciones = await redisClient.get(integracionesCacheKey);

  if (cachedIntegraciones) {
    const parsed = JSON.parse(cachedIntegraciones);
    if (parsed[provider]) {
      apiKey = parsed[provider];
    }
  }

  // 2. Si no estaba en Redis, consultar a la base de datos y cachear en Redis
  if (!apiKey) {
    const { rows } = await pool.query(
      `SELECT api_key 
       FROM tienda_integraciones 
       WHERE user_id = $1 AND provider = $2 
       LIMIT 1`,
      [userId, provider]
    );

    if (!rows[0] || !rows[0].api_key) {
      throw new Error(`No se encontró una API key configurada para ${provider}. Configúrala en Mi Tienda.`);
    }

    apiKey = rows[0].api_key;

    const current = cachedIntegraciones ? JSON.parse(cachedIntegraciones) : {};
    current[provider] = apiKey;
    await redisClient.set(integracionesCacheKey, JSON.stringify(current), { EX: CACHE_TTL_SECONDS });
  }

  const baseUrl = GLOBAL_API_URLS[provider];

  if (provider === 'mastershop') {
    const targetUrl = `${baseUrl}/products/${sanitizedProductId}`;
    const redisCacheKey = `product:query:${provider}:${sanitizedProductId}`;
    const cachedProduct = await redisClient.get(redisCacheKey);
    if (cachedProduct) {
      return JSON.parse(cachedProduct);
    }

    const response = await axios.get(targetUrl, {
      headers: {
        'ms-api-key': apiKey,
      },
    });

    const data = response.data;
    await redisClient.set(redisCacheKey, JSON.stringify(data), { EX: 3600 });
    return data;
  }

  if (provider === 'dropi') {
    throw new Error('La integración con Dropi estará disponible próximamente.');
  }

  throw new Error('Proveedor no soportado.');
};
