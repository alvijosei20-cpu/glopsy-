import { pool } from '../db.js';
import { cleanString } from '../utils/validation.js';
import { generateBanner, storeBanner, getBanner, FORMATS } from '../services/banners.service.js';

const publicBase = (req) => {
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
};

// Genera un banner publicitario con la foto real de un producto de la tienda.
export const generateStoreBanner = async (req, res) => {
  const tiendaId = req.auth.userId;
  const format = FORMATS.includes(String(req.body?.format || '')) ? String(req.body.format) : 'feed';
  const publicId = cleanString(req.body?.public_id, { maxLength: 100 });
  const headline = cleanString(req.body?.headline, { maxLength: 100 });
  const badge = cleanString(req.body?.badge, { maxLength: 30 });

  try {
    const values = [tiendaId];
    let sql = `
      SELECT p.id, p.public_id, p.name, p.description, p.images, p.suggested_price, p.base_price,
             cat.nombre AS categoria_nombre,
             t.nombres AS tienda_nombre,
             (SELECT COALESCE(AVG(rv.rating),0)::numeric(3,2) FROM reviews rv WHERE rv.product_id = p.id) AS avg_rating
      FROM produc p
      LEFT JOIN categorias cat ON cat.id = p.categoria_id
      LEFT JOIN tiendas t ON t.usrid = p.tienda_id
      WHERE p.tienda_id = $1 AND COALESCE(p.status,'active') = 'active'`;
    if (publicId) {
      values.push(publicId);
      sql += ` AND p.public_id = $${values.length}`;
    }
    sql += ' ORDER BY p.updated_at DESC LIMIT 1';

    const { rows } = await pool.query(sql, values);
    const p = rows[0];
    if (!p) return res.status(404).json({ ok: false, message: 'No hay un producto activo para generar el banner.' });

    const base = Number(p.suggested_price ?? p.base_price ?? 0);
    const price = base > 0 ? `$${Math.round(base).toLocaleString('es-CO')} COP` : '';
    const brand = p.tienda_nombre || 'Glopsy';
    const category = p.categoria_nombre || '';
    const name = headline || p.name;

    const payload = {
      name,
      category,
      price,
      badge,
      brand,
      images: Array.isArray(p.images) ? p.images : [],
      format,
      productId: p.public_id,
    };
    const buffer = await generateBanner(payload);
    const key = storeBanner(payload, buffer);

    const url = `${publicBase(req)}/api/banners/${key}.png`;
    return res.json({ ok: true, url, product: { public_id: p.public_id, name: p.name }, format });
  } catch (err) {
    console.error('Error generando banner:', err.message);
    return res.status(500).json({ ok: false, message: 'No fue posible generar el banner.' });
  }
};

// Sirve el PNG generado (público, con caché).
export const serveBanner = async (req, res) => {
  const key = String(req.params.key || '');
  if (!/^[a-f0-9]{40}$/i.test(key)) return res.status(404).json({ ok: false, message: 'Banner no encontrado.' });
  const buffer = getBanner(key);
  if (!buffer) return res.status(404).json({ ok: false, message: 'Banner expirado o no encontrado.' });
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'public, max-age=300');
  return res.send(buffer);
};
