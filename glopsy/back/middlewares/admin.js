export const requireAdminKey = (req, res, next) => {
  const key = process.env.NOTIFICATIONS_ADMIN_KEY;
  if (!key) {
    return res.status(503).json({ ok: false, message: 'NOTIFICATIONS_ADMIN_KEY no configurada en el servidor.' });
  }
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (token && token === key) return next();
  return res.status(401).json({ ok: false, message: 'No autorizado.' });
};
