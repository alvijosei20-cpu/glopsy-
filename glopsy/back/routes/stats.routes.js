import { Router } from 'express';
import { getActiveUsers } from '../services/ga.service.js';

const router = Router();

router.get('/online', async (_req, res) => {
  try {
    const online = await getActiveUsers();
    if (online === null) {
      return res.status(503).json({ ok: false, message: 'Google Analytics no configurado.' });
    }
    res.json({ ok: true, online, source: 'google-analytics', window: '30min' });
  } catch (err) {
    console.error('Error al obtener usuarios activos:', err.message);
    res.status(500).json({ ok: false, message: 'Error al consultar Google Analytics.' });
  }
});

export default router;
