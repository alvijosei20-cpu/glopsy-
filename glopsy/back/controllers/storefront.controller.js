import { cleanString, toInt } from '../utils/validation.js';
import { getPublicStoreBySlug, getMainStore } from '../services/tienda.service.js';
import { getStorefrontProducts } from '../services/product.service.js';

// GET /api/storefront/:slug -> información pública de la tienda (vitrina del subdominio).
// El slug especial "main" resuelve la tienda principal (app.glopsy.shop).
export const storefrontInfo = async (req, res) => {
  try {
    const slug = cleanString(req.params.slug, { maxLength: 63 });
    const store = slug.toLowerCase() === 'main'
      ? await getMainStore()
      : await getPublicStoreBySlug(slug);
    if (!store) {
      return res.status(404).json({ ok: false, message: 'Tienda no encontrada.' });
    }
    return res.json({ ok: true, store });
  } catch (error) {
    console.error('Error al consultar vitrina de tienda:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible consultar la tienda.' });
  }
};

// GET /api/storefront/:slug/products -> SOLO los productos de esa tienda.
export const storefrontProducts = async (req, res) => {
  try {
    const slug = cleanString(req.params.slug, { maxLength: 63 });
    const q = cleanString(req.query.q, { maxLength: 120 });
    const limit = toInt(req.query.limit, { min: 1, max: 100, fallback: 48 });
    const offset = toInt(req.query.offset, { min: 0, fallback: 0 });
    const ciudad = cleanString(req.query.ciudad, { maxLength: 100 }) || null;
    const data = await getStorefrontProducts({ slug, q, limit, offset, ciudadName: ciudad });
    if (!data.store) {
      return res.status(404).json({ ok: false, message: 'Tienda no encontrada.' });
    }
    return res.json({ ok: true, ...data });
  } catch (error) {
    console.error('Error al listar productos de la tienda:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible listar los productos.' });
  }
};
