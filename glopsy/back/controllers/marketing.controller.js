import { pool } from '../db.js';
import {
  marketingOverview,
  listSuggestions,
  markSuggestionState,
  applySeoSuggestion,
  applyPromoSuggestion,
  updateSuggestionUrl,
  sanitizeCampaignUrl,
} from '../services/marketing.service.js';
import { runMarketingAnalysis } from '../services/marketing/engine.js';
import { formatPrice, configFromMoneda } from '../services/pais.service.js';
import { sendPushToUser } from '../services/push.service.js';
import {
  listFacebookAccounts,
  connectFacebookPage,
  deleteFacebookPage,
  getFacebookPageForTienda,
  publishToFacebookPage,
} from '../services/facebook.service.js';
import { toInt, isAllowedEnum } from '../utils/validation.js';

export const getMarketingOverview = async (req, res) => {
  try {
    const overview = await marketingOverview(req.auth.userId);
    return res.json({
      ok: true,
      ...overview,
      llm: { enabled: Boolean(process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY) },
    });
  } catch (err) {
    console.error('Error al obtener resumen de marketing:', err.message);
    return res.status(500).json({ ok: false, message: 'No fue posible obtener el resumen de marketing.' });
  }
};

export const getSuggestions = async (req, res) => {
  try {
    const tipo = req.query.tipo ? String(req.query.tipo).slice(0, 20) : null;
    const estado = req.query.estado ? String(req.query.estado).slice(0, 20) : null;
    const limit = toInt(req.query.limit, { min: 1, max: 100, fallback: 50 }) ?? 50;
    const offset = toInt(req.query.offset, { min: 0, fallback: 0 }) ?? 0;

    if (tipo && !isAllowedEnum(tipo, ['seo', 'promo', 'stock', 'social', 'email'])) {
      return res.status(400).json({ ok: false, message: 'Tipo de sugerencia inválido.' });
    }
    if (estado && !isAllowedEnum(estado, ['pendiente', 'aplicada', 'descartada'])) {
      return res.status(400).json({ ok: false, message: 'Estado inválido.' });
    }

    const suggestions = await listSuggestions({ tiendaId: req.auth.userId, tipo, estado, limit, offset });
    return res.json({ ok: true, suggestions });
  } catch (err) {
    console.error('Error al listar sugerencias de marketing:', err.message);
    return res.status(500).json({ ok: false, message: 'No fue posible listar las sugerencias.' });
  }
};

export const runMarketingManual = async (req, res) => {
  try {
    const result = await runMarketingAnalysis(req.auth.userId, { manual: true });
    return res.json({ ok: true, message: 'Análisis de marketing completado.', runId: result.runId, stats: result.stats });
  } catch (err) {
    console.error('Error al ejecutar análisis de marketing:', err.message);
    return res.status(500).json({ ok: false, message: err.message || 'No fue posible ejecutar el análisis de marketing.' });
  }
};

const getSuggestionOwned = async (tiendaId, id) => {
  const { rows } = await pool.query(
    `SELECT * FROM marketing_suggestions WHERE id = $1 AND tienda_id = $2 LIMIT 1`,
    [id, tiendaId]
  );
  return rows[0] || null;
};

export const applySuggestion = async (req, res) => {
  const tiendaId = req.auth.userId;
  const id = toInt(req.params.id, { min: 1 });
  if (!id) return res.status(400).json({ ok: false, message: 'ID inválido.' });
  try {
    const suggestion = await getSuggestionOwned(tiendaId, id);
    if (!suggestion) return res.status(404).json({ ok: false, message: 'Sugerencia no encontrada.' });
    if (suggestion.estado === 'aplicada') {
      return res.status(409).json({ ok: false, message: 'La sugerencia ya fue aplicada.' });
    }

    if (suggestion.tipo === 'seo') {
      await applySeoSuggestion(suggestion);
      await markSuggestionState(tiendaId, id, 'aplicada');
      return res.json({ ok: true, message: 'SEO aplicado al producto.' });
    }

    if (suggestion.tipo === 'promo') {
      const ofertaId = await applyPromoSuggestion(suggestion, tiendaId);
      await markSuggestionState(tiendaId, id, 'aplicada', { ofertaId });
      return res.json({ ok: true, message: 'Promoción creada y activada por 7 días.', ofertaId });
    }

    await markSuggestionState(tiendaId, id, 'aplicada');
    return res.json({ ok: true, message: 'Sugerencia aplicada.' });
  } catch (err) {
    console.error('Error al aplicar sugerencia:', err.message);
    return res.status(500).json({ ok: false, message: err.message || 'No fue posible aplicar la sugerencia.' });
  }
};

export const dismissSuggestion = async (req, res) => {
  const tiendaId = req.auth.userId;
  const id = toInt(req.params.id, { min: 1 });
  if (!id) return res.status(400).json({ ok: false, message: 'ID inválido.' });
  try {
    const updated = await markSuggestionState(tiendaId, id, 'descartada');
    if (!updated) return res.status(404).json({ ok: false, message: 'Sugerencia no encontrada.' });
    return res.json({ ok: true, message: 'Sugerencia descartada.' });
  } catch (err) {
    console.error('Error al descartar sugerencia:', err.message);
    return res.status(500).json({ ok: false, message: 'No fue posible descartar la sugerencia.' });
  }
};

export const updateCampaignUrl = async (req, res) => {
  const tiendaId = req.auth.userId;
  const id = toInt(req.params.id, { min: 1 });
  if (!id) return res.status(400).json({ ok: false, message: 'ID inválido.' });
  try {
    const suggestion = await getSuggestionOwned(tiendaId, id);
    if (!suggestion) return res.status(404).json({ ok: false, message: 'Sugerencia no encontrada.' });
    if (suggestion.tipo !== 'email') {
      return res.status(400).json({ ok: false, message: 'Solo las campañas de email/push tienen destino editable.' });
    }
    if (suggestion.estado !== 'pendiente') {
      return res.status(409).json({ ok: false, message: 'Solo se puede editar una campaña pendiente.' });
    }
    const publicIds = Array.isArray(suggestion.payload?.productos)
      ? suggestion.payload.productos.map((p) => p.public_id).filter(Boolean)
      : [];
    const url = sanitizeCampaignUrl(req.body?.url, { publicIds });
    if (!url) {
      return res.status(400).json({
        ok: false,
        message: 'Destino inválido. Usa una ruta de la app (/listpr, /product/..., /consultar-pedido) o una URL.',
      });
    }
    const updated = await updateSuggestionUrl(tiendaId, id, url);
    if (!updated) return res.status(404).json({ ok: false, message: 'Sugerencia no encontrada.' });
    return res.json({ ok: true, message: 'Destino de la campaña actualizado.', url });
  } catch (err) {
    console.error('Error al actualizar destino de campaña:', err.message);
    return res.status(500).json({ ok: false, message: 'No fue posible actualizar el destino de la campaña.' });
  }
};

export const sendPushCampaign = async (req, res) => {
  const tiendaId = req.auth.userId;
  const id = toInt(req.params.id, { min: 1 });
  if (!id) return res.status(400).json({ ok: false, message: 'ID inválido.' });
  try {
    const suggestion = await getSuggestionOwned(tiendaId, id);
    if (!suggestion) return res.status(404).json({ ok: false, message: 'Sugerencia no encontrada.' });
    if (suggestion.tipo !== 'email') {
      return res.status(400).json({ ok: false, message: 'Solo las campañas de email/push se envían.' });
    }
    if (suggestion.estado === 'aplicada') {
      return res.status(409).json({ ok: false, message: 'La campaña ya fue enviada.' });
    }

    const payload = suggestion.payload || {};
    const title = String(payload.title || 'Novedades en la tienda').slice(0, 120);
    const body = String(payload.body || 'Mira los nuevos productos.').slice(0, 200);
    const productIds = Array.isArray(payload.productos) ? payload.productos.map((p) => p.public_id).filter(Boolean) : [];
    const url = sanitizeCampaignUrl(payload.url, { publicIds: productIds }) || '/listpr';

    const { rows } = await pool.query(
      `SELECT DISTINCT o.user_id AS id
       FROM orders o
       JOIN users u ON u.id = o.user_id
       WHERE o.tienda_id = $1 AND o.user_id IS NOT NULL AND u.push_subscription IS NOT NULL
       LIMIT 500`,
      [tiendaId]
    );

    let sent = 0;
    for (const row of rows) {
      const ok = await sendPushToUser(row.id, { title, body, url, scheme: 'glopsy', fallbackUrl: url });
      if (ok) sent += 1;
    }

    await markSuggestionState(tiendaId, id, 'aplicada');
    return res.json({
      ok: true,
      message: `Campaña enviada a ${sent} dispositivo(s).`,
      sent,
      targets: rows.length,
    });
  } catch (err) {
    console.error('Error al enviar campaña push:', err.message);
    return res.status(500).json({ ok: false, message: err.message || 'No fue posible enviar la campaña.' });
  }
};

export const facebookListPages = async (req, res) => {
  try {
    const result = await listFacebookAccounts(req.body?.token);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Error al listar páginas de Facebook:', err.message);
    return res.status(400).json({ ok: false, message: err.message });
  }
};

export const facebookConnect = async (req, res) => {
  const tiendaId = req.auth.userId;
  try {
    const page = await connectFacebookPage(tiendaId, {
      token: req.body?.token,
      pageId: req.body?.pageId,
    });
    return res.json({
      ok: true,
      message: `Página "${page.pageName}" conectada. Ya puedes publicar los posts con IA.`,
      page,
    });
  } catch (err) {
    console.error('Error al conectar página de Facebook:', err.message);
    return res.status(400).json({ ok: false, message: err.message });
  }
};

export const facebookDisconnect = async (req, res) => {
  const tiendaId = req.auth.userId;
  try {
    const removed = await deleteFacebookPage(tiendaId);
    if (!removed) return res.status(404).json({ ok: false, message: 'No hay una página conectada.' });
    return res.json({ ok: true, message: 'Página de Facebook desconectada.' });
  } catch (err) {
    console.error('Error al desconectar página de Facebook:', err.message);
    return res.status(500).json({ ok: false, message: 'No fue posible desconectar la página.' });
  }
};

export const publishFacebook = async (req, res) => {
  const tiendaId = req.auth.userId;
  const id = toInt(req.params.id, { min: 1 });
  if (!id) return res.status(400).json({ ok: false, message: 'ID inválido.' });
  try {
    const suggestion = await getSuggestionOwned(tiendaId, id);
    if (!suggestion) return res.status(404).json({ ok: false, message: 'Sugerencia no encontrada.' });
    if (suggestion.tipo !== 'social') {
      return res.status(400).json({ ok: false, message: 'Solo los posts sociales se publican en Facebook.' });
    }
    if (suggestion.estado === 'aplicada') {
      return res.status(409).json({ ok: false, message: 'Este post ya fue publicado.' });
    }
    if (suggestion.estado === 'descartada') {
      return res.status(409).json({ ok: false, message: 'Este post fue descartado. Genera uno nuevo.' });
    }

    const { rows } = await pool.query(
      `SELECT s.payload, p.images, p.suggested_price, p.base_price, p.name,
              COALESCE(t.moneda, pa.moneda, 'COP') AS moneda,
              COALESCE(t.locale, pa.locale, 'es-CO') AS locale
       FROM marketing_suggestions s
       LEFT JOIN produc p ON p.id = s.product_id
       LEFT JOIN tiendas t ON t.usrid = s.tienda_id
       LEFT JOIN paises pa ON pa.id = t.pais_id
       WHERE s.id = $1 AND s.tienda_id = $2
       LIMIT 1`,
      [id, tiendaId]
    );
    const payload = rows[0]?.payload || suggestion.payload || {};
    const images = Array.isArray(rows[0]?.images)
      ? rows[0].images.map((i) => i?.src || i).filter(Boolean)
      : [];
    const texto = String(payload.texto || '').trim();
    const hashtags = String(payload.hashtags || '').trim();
    const message = hashtags ? `${texto}\n\n${hashtags}` : texto;
    const firstSrc = (x) => (typeof x === 'string' ? x : x?.src || '');
    let photoUrl = firstSrc(payload.imagen) || (images.length ? firstSrc(images[0]) : '') || null;

    // Intenta publicar con un banner generado (foto real + texto). Si falla, usa la foto simple.
    try {
      const bannerSvc = await import('../services/banners.service.js');
      const base = Number(rows[0]?.suggested_price ?? rows[0]?.base_price ?? 0);
      const buf = await bannerSvc.generateBanner({
        name: rows[0]?.name || suggestion.titulo || 'Descubre este producto',
        category: '',
        price: base > 0 ? formatPrice(base, configFromMoneda(rows[0]?.moneda, rows[0]?.locale)) : '',
        badge: payload.badge || '',
        brand: 'Glopsy',
        images,
        format: 'feed',
      });
      const key = bannerSvc.storeBanner({ name: suggestion.titulo, images }, buf);
      const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
      const host = req.headers['x-forwarded-host'] || req.get('host');
      photoUrl = `${proto}://${host}/api/banners/${key}.png`;
    } catch (bannerErr) {
      console.warn('[marketing] banner no generado, se usa la foto del producto:', bannerErr.message);
    }

    const page = await getFacebookPageForTienda(tiendaId);
    if (!page) {
      return res.status(400).json({
        ok: false,
        message: 'Conecta tu página de Facebook primero para poder publicar.',
      });
    }

    const result = await publishToFacebookPage({
      accessToken: page.access_token,
      pageId: page.fb_page_id,
      message,
      photoUrl,
    });

    await markSuggestionState(tiendaId, id, 'aplicada');
    return res.json({
      ok: true,
      message: result.kind === 'photo'
        ? `Publicado con foto en "${page.fb_page_name}".`
        : `Publicado en "${page.fb_page_name}" (sin imagen).`,
      postId: result.postId,
      page: page.fb_page_name,
    });
  } catch (err) {
    console.error('Error al publicar en Facebook:', err.message);
    return res.status(500).json({ ok: false, message: err.message || 'No fue posible publicar en Facebook.' });
  }
};

export default {
  getMarketingOverview,
  getSuggestions,
  runMarketingManual,
  applySuggestion,
  dismissSuggestion,
  updateCampaignUrl,
  sendPushCampaign,
  facebookListPages,
  facebookConnect,
  facebookDisconnect,
  publishFacebook,
};
