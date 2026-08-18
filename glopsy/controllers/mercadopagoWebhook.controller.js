import { processMercadopagoWebhook } from '../services/mercadopagoWebhook.service.js';

export const mercadopagoWebhookController = async (req, res) => {
  try {
    const rawBody = JSON.stringify(req.body);
    const result = await processMercadopagoWebhook(req.body, rawBody, req.headers);

    if (result.status === 401) {
      return res.status(401).json({ ok: false, message: 'Firma inválida.' });
    }
    if (!result.ok) {
      console.warn('[MP Webhook] Error:', JSON.stringify(result));
    }
    return res.json({ ok: result.ok !== false, ...result });
  } catch (error) {
    console.error('Error procesando webhook de Mercado Pago:', error.message);
    return res.status(500).json({ ok: false, message: 'Error procesando webhook.' });
  }
};
