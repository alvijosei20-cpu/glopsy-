import jwt from 'jsonwebtoken';
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
