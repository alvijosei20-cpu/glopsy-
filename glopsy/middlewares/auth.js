import jwt from 'jsonwebtoken';
import { redisClient } from '../services/redis.service.js';

export const requireAuth = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ ok: false, message: 'Autenticación requerida.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ ok: false, message: 'Token inválido o vencido.' });
  }
};

export const optionalAuth = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.auth = payload;
    } catch {}
  }
  next();
};
