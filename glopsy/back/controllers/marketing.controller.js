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
import { sendPushToUser } from '../services/push.service.js';
import { toInt, isAllowedEnum } from '../utils/validation.js';

export const getMarketingOverview = async (req, res) => {
  try {
    const overview = await marketingOverview(req.auth.userId);
    return res.json({
      ok: true,
      ...overview,
      llm: { enabled: Boolean(process.env.DEEPSEEK_API_KEY) },
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

export default {
  getMarketingOverview,
  getSuggestions,
  runMarketingManual,
  applySuggestion,
  dismissSuggestion,
  updateCampaignUrl,
  sendPushCampaign,
};
