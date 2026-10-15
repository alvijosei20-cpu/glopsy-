import { processEnviaWebhookEvent } from '../services/enviaWebhook.service.js';

export const enviaWebhookController = async (req, res) => {
  try {
    const result = await processEnviaWebhookEvent(req.body || {}, {
      rawBody: req.rawBody,
      headers: req.headers,
    });
    if (result?.status === 401) {
      return res.status(401).send('FIRMA_INVALIDA');
    }
    return res.status(200).json({ ok: true, received: true, ...result });
  } catch (error) {
    console.error('[ENVIA Webhook] Error procesando:', error.message);
    return res.status(500).json({ ok: false, message: 'Error procesando webhook.' });
  }
};

export default { enviaWebhookController };
