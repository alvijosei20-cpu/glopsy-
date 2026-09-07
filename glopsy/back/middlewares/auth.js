import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { redisClient } from '../services/redis.service.js';
import { AUTH_COOKIE } from '../utils/cookies.js';

const extractToken = (req) => {
  const [scheme, headerToken] = (req.headers.authorization || '').split(' ');
  if (scheme === 'Bearer' && headerToken) return headerToken;
  return req.cookies?.[AUTH_COOKIE] || null;
};

export const requireAuth = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ ok: false, message: 'Autenticación requerida.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.userId === undefined || payload.userId === null) {
      return res.status(401).json({ ok: false, message: 'Token inválido o vencido.' });
    }

    const session = await redisClient.get(`session:${payload.userId}`).catch(() => null);
    if (!session || session !== token) {
      return res.status(401).json({ ok: false, message: 'Sesión inválida o cerrada. Inicia sesión de nuevo.' });
    }

    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ ok: false, message: 'Token inválido o vencido.' });
  }
};

export const optionalAuth = async (req, res, next) => {
  const token = extractToken(req);

  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.auth = payload;
    } catch {}
  }
  next();
};

// Se usa DESPUÉS de requireAuth: exige que el usuario esté autorizado por el
// administrador para operar su tienda (users.can_sell). Si lo deshabilitan, pierde
// el acceso al panel de vendedor aunque conserve una tienda existente.
export const requireSeller = async (req, res, next) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ ok: false, message: 'Autenticación requerida.' });
    }
    const { rows } = await pool.query(`SELECT can_sell FROM users WHERE id = $1 LIMIT 1`, [req.auth.userId]);
    if (!rows[0]?.can_sell) {
      return res.status(403).json({ ok: false, message: 'No estás autorizado para vender en esta plataforma. Contacta al administrador.' });
    }
    next();
  } catch (err) {
    console.error('Error en requireSeller:', err.message);
    return res.status(500).json({ ok: false, message: 'No fue posible validar tu autorización.' });
  }
};
