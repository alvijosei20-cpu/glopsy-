import { processMastershopWebhookEvent } from '../services/mastershopWebhook.service.js';

export const mastershopWebhookController = async (req, res) => {
  try {
    const payload = req.body;
    const result = await processMastershopWebhookEvent(payload);
    res.json({ ok: true, message: 'Webhook procesado con éxito', ...result });
  } catch (error) {
    console.error('Error procesando webhook de Mastershop:', error.message);
    res.status(500).json({ ok: false, message: 'Error procesando webhook.' });
  }
};
