import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { redisClient } from './redis.service.js';

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
