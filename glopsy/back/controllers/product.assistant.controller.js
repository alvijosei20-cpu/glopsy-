import { pool } from '../db.js';
import { cleanString } from '../utils/validation.js';
import { getProductByPublicId } from '../services/product.service.js';
import { productAssistantChat } from '../services/product.assistant.service.js';

export const productAssistant = async (req, res) => {
  const pid = cleanString(req.params.id, { maxLength: 100 });
  const ciudad = cleanString(req.query.ciudad || req.body?.ciudad, { maxLength: 120 }) || null;
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const ip = String(
    req.headers['cf-connecting-ip'] ||
    String(req.headers['x-forwarded-for'] || '').split(',')[0] ||
    req.socket?.remoteAddress ||
    ''
  ).trim().slice(0, 64);
  const budgetKey = `${pid}:${ip}`;

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

    // El detalle no trae el proveedor; se adjunta para sugerencias del mismo vendedor.
    // También la moneda/locale de la tienda para formatear precios (multicountry).
    try {
      const { rows } = await pool.query(
        `SELECT t.nombres AS proveedor,
                COALESCE(t.moneda, pa.moneda, 'COP') AS moneda,
                COALESCE(t.locale, pa.locale, 'es-CO') AS locale
         FROM produc p
         JOIN tiendas t ON t.usrid = p.tienda_id
         LEFT JOIN paises pa ON pa.id = t.pais_id
         WHERE p.public_id = $1 LIMIT 1`,
        [pid]
      );
      if (rows[0]?.proveedor) product.proveedor = rows[0].proveedor;
      if (rows[0]?.moneda) product.moneda = rows[0].moneda;
      if (rows[0]?.locale) product.locale = rows[0].locale;
    } catch {}

    const result = await productAssistantChat({ product, ciudad, messages, budgetKey });
    return res.json(result);
  } catch (err) {
    console.error('Error en el asistente de producto:', err.message);
    return res.status(502).json({
      ok: false,
      message: 'No fue posible responder ahora. Intenta de nuevo en un momento.',
    });
  }
};
