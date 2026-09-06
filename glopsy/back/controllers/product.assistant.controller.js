import { cleanString } from '../utils/validation.js';
import { getProductByPublicId } from '../services/product.service.js';
import {
  productAssistantChat,
  assistantConfigured,
} from '../services/product.assistant.service.js';

export const productAssistant = async (req, res) => {
  const pid = cleanString(req.params.id, { maxLength: 100 });
  const ciudad = cleanString(req.query.ciudad || req.body?.ciudad, { maxLength: 120 }) || null;
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];

  if (!pid) return res.status(400).json({ ok: false, message: 'ID de producto inválido.' });
  if (!messages.length) return res.status(400).json({ ok: false, message: 'No hay mensaje que responder.' });

  try {
    let product = null;
    try {
      product = await getProductByPublicId(pid, ciudad);
    } catch {
      product = null;
    }
    if (!product) {
      return res.status(404).json({ ok: false, message: 'Producto no encontrado en el catálogo.' });
    }

    if (!assistantConfigured()) {
      return res.status(503).json({
        ok: false,
        message: 'El asistente de IA no está configurado todavía. Escríbenos a soporte@glopsy.com',
      });
    }

    const result = await productAssistantChat({ product, ciudad, messages });
    return res.json(result);
  } catch (err) {
    console.error('Error en el asistente de producto:', err.message);
    return res.status(502).json({
      ok: false,
      message: 'No fue posible responder ahora. Intenta de nuevo en un momento.',
    });
  }
};
