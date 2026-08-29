import { Router } from 'express';
import { requireAdminKey } from '../middlewares/admin.js';
import { getBanners, saveBanners, resetBanners } from '../services/home.service.js';

const router = Router();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get(
  '/banners',
  asyncHandler(async (_req, res) => {
    const banners = await getBanners();
    res.json({ ok: true, banners });
  })
);

router.put(
  '/banners',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const banners = await saveBanners(req.body?.banners || req.body);
    res.json({ ok: true, banners });
  })
);

router.post(
  '/banners/reset',
  requireAdminKey,
  asyncHandler(async (_req, res) => {
    const banners = await resetBanners();
    res.json({ ok: true, banners });
  })
);

export default router;
