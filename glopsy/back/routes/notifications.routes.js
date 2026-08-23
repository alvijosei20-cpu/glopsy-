import { Router } from 'express';
import { query } from '../db.js';
import { optionalAuth } from '../middlewares/auth.js';
import { requireAdminKey } from '../middlewares/admin.js';
import {
  createNotification,
  listAll,
  listForClient,
  markRead,
  getSeenCounts,
  updateNotification,
  deleteNotifications,
  clientKeyFor,
} from '../services/notifications.service.js';

const router = Router();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { key, userId } = clientKeyFor(req);
    const list = await listForClient({ clientKey: key, userId });
    res.json({ ok: true, notifications: list });
  })
);

router.post(
  '/:id/read',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { key } = clientKeyFor(req);
    await markRead(req.params.id, key);
    res.json({ ok: true });
  })
);

router.get(
  '/users',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ ok: true, users: [] });
    const { rows } = await query(
      `SELECT id, email, name FROM users
       WHERE email ILIKE $1 OR name ILIKE $1 OR phone ILIKE $1
       ORDER BY created_at DESC LIMIT 8`,
      [`%${q}%`]
    );
    res.json({ ok: true, users: rows });
  })
);

router.get(
  '/admin',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const list = await listAll();
    const ids = [...new Set(list.map((n) => n.userId).filter(Boolean))];
    let users = [];
    if (ids.length) {
      const { rows } = await query(
        `SELECT id, email, name FROM users WHERE id = ANY($1::bigint[])`,
        [ids]
      );
      users = rows;
    }
    const byId = new Map(users.map((u) => [String(u.id), u]));
    const counts = await getSeenCounts(list);
    const enriched = list.map((n) => ({
      ...n,
      seenCount: counts.get(n.id) || 0,
      user: n.target === 'user' ? byId.get(String(n.userId)) || null : null,
    }));
    res.json({ ok: true, notifications: enriched });
  })
);

router.post(
  '/',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const notif = await createNotification(req.body || {});
    res.status(201).json({ ok: true, notification: notif });
  })
);

router.patch(
  '/:id',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const notif = await updateNotification(req.params.id, req.body || {});
    if (!notif) return res.status(404).json({ ok: false, message: 'Notificación no encontrada.' });
    res.json({ ok: true, notification: notif });
  })
);

router.delete(
  '/:id',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    await deleteNotifications([req.params.id]);
    res.json({ ok: true });
  })
);

export default router;
