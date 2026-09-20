import { cleanString, toInt } from '../utils/validation.js';
import { query } from '../db.js';
import { getPublicStoreBySlug, getMainStore } from '../services/tienda.service.js';
import { getStorefrontProducts, getStorefrontHome } from '../services/product.service.js';
import { getUsdRateTo } from '../services/rates.service.js';

const visitorCountry = (req) => {
  const raw = req.headers['x-visitor-country'] || req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || '';
  const c = String(raw).trim().toUpperCase();
  return c && c !== 'XX' && c !== 'T1' ? c : null;
};

// Precio local para visitantes del país de una tienda habilitada en USD.
const buildPricing = async (store, req) => {
  const storeCurrency = String(store.moneda || 'COP').toUpperCase();
  const base = { displayCurrency: storeCurrency, rate: 1, converted: false };
  if (storeCurrency !== 'USD' || !store.paisId) return base;

  const { rows } = await query(`SELECT codigo_iso, moneda FROM paises WHERE id = $1 LIMIT 1`, [store.paisId]);
  const pais = rows[0];
  const visitor = visitorCountry(req);
  const localCur = String(pais?.moneda || '').toUpperCase();
  if (!pais || !visitor || localCur === 'USD' || visitor !== String(pais.codigo_iso).toUpperCase()) return base;

  const rate = await getUsdRateTo(localCur);
  if (!rate || rate <= 0) return base;
  return { displayCurrency: localCur, rate, converted: true };
};

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
    const pricing = await buildPricing(store, req).catch(() => ({ displayCurrency: store.moneda, rate: 1, converted: false }));
    return res.json({ ok: true, store: { ...store, pricing } });
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

// GET /api/storefront/:slug/home -> secciones del dashboard (últimos, promociones, descuentos).
export const storefrontHome = async (req, res) => {
  try {
    const slug = cleanString(req.params.slug, { maxLength: 63 });
    const ciudad = cleanString(req.query.ciudad, { maxLength: 100 }) || null;
    const data = await getStorefrontHome({ slug, ciudadName: ciudad });
    if (!data.store) {
      return res.status(404).json({ ok: false, message: 'Tienda no encontrada.' });
    }
    return res.json({ ok: true, ...data });
  } catch (error) {
    console.error('Error al cargar la vitrina:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible cargar la vitrina.' });
  }
};
