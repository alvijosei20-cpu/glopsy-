import { processBoldWebhook } from '../services/boldWebhook.service.js';

export const boldWebhookController = async (req, res) => {
  try {
    const signature = req.headers['x-bold-signature'];
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const result = await processBoldWebhook(req.body, { rawBody, signature });

    if (result.status === 401) {
      return res.status(401).json({ ok: false, message: 'Firma inválida.' });
    }
    if (result.ok === false) {
      console.warn('[Bold Webhook] Error:', JSON.stringify(result));
      return res.status(500).json({ ok: false, ...result });
    }
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Error procesando webhook de Bold:', error.message);
    return res.status(500).json({ ok: false, message: 'Error procesando webhook.' });
  }
};
