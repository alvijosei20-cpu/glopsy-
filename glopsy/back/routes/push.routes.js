import { Router } from 'express';
import { getVapidPublicKey } from '../services/push.service.js';

const router = Router();

router.get('/vapid-key', (req, res) => {
  res.json({ ok: true, publicKey: getVapidPublicKey() });
});

export default router;
