import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db.js';
import { redisClient } from './redis.service.js';

export const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

export const verifyPassword = (password, storedHash) => {
  if (!storedHash) return false;
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(key, 'hex'));
};

export const registerWithEmail = async ({ email, name, password }) => {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
  if (existing.rows[0]) {
    throw new Error('El correo electrónico ya está registrado.');
  }

  const password_hash = hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO users (email, name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, avatar_url`,
    [email, name || email.split('@')[0], password_hash]
  );
  const user = rows[0];

  const tokenPayload = { userId: user.id, email: user.email };
  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '7d' });

  await redisClient.set(`session:${user.id}`, token, { EX: 7 * 24 * 60 * 60 });

  return { user, token };
};

export const loginWithEmail = async ({ email, password }) => {
  const { rows } = await pool.query(
    'SELECT id, email, name, avatar_url, password_hash FROM users WHERE email = $1 LIMIT 1',
    [email]
  );
  const user = rows[0];

  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    throw new Error('Correo o contraseña incorrectos.');
  }

  const tokenPayload = { userId: user.id, email: user.email };
  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '7d' });

  await redisClient.set(`session:${user.id}`, token, { EX: 7 * 24 * 60 * 60 });

  const { password_hash, ...safeUser } = user;
  return { user: safeUser, token };
};

/**
 * Procesa un usuario proveniente de OAuth (Google/Discord)
 * 1. Upsert en BD (Crea o actualiza usuario)
 * 2. Genera JWT
 * 3. Guarda la sesión activa en Redis
 */
export const processOAuthUser = async ({ email, name, avatar_url, provider, provider_id }) => {
  const providerColumns = {
    google: 'google_id',
    discord: 'discord_id',
  };
  const providerColumn = providerColumns[provider];

  if (!providerColumn) {
    throw new Error('Proveedor OAuth no compatible');
  }

  // 1. Insertar o actualizar usuario en la base de datos (Upsert)
  const query = `
    INSERT INTO users (email, name, avatar_url, ${providerColumn})
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (email) 
    DO UPDATE SET 
      name = EXCLUDED.name,
      avatar_url = EXCLUDED.avatar_url,
      ${providerColumn} = EXCLUDED.${providerColumn},
      updated_at = NOW()
    RETURNING id, email, name, avatar_url;
  `;

  const values = [email, name, avatar_url, provider_id];
  const { rows } = await pool.query(query, values);
  const user = rows[0];

  // 2. Generar token JWT con la sesión del usuario
  const tokenPayload = { userId: user.id, email: user.email };
  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
    expiresIn: '7d', // El token expira en 7 días
  });

  // 3. Guardar la sesión en Redis para revocación rápida o consulta de estado
  // Usamos EX (segundos) sincronizado con los 7 días del JWT (604,800 segundos)
  await redisClient.set(`session:${user.id}`, token, {
    EX: 7 * 24 * 60 * 60,
  });

  return { user, token };
};

export const revokeSession = async (userId) => {
  await redisClient.del(`session:${userId}`);
};

export const savePushSubscriptionService = async (userId, subscription) => {
  await pool.query(
    'UPDATE users SET push_subscription = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(subscription), userId]
  );
  return { success: true };
};

export const saveBiometricCredentialService = async (userId, credential) => {
  await pool.query(
    'UPDATE users SET webauthn_credential = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(credential), userId]
  );
  return { success: true };
};
