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
import axios from 'axios';
import * as tiktokPublish from '../services/tiktokPublish.service.js';
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

// --- TikTok (subir video a la bandeja de borradores) ---
const requestBaseUrl = (req) => {
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
};

export const tiktokStatus = async (req, res) => {
  try {
    const tk = await tiktokPublish.getTikTokIntegration(req.auth.userId);
    return res.json({ ok: true, tiktok: { connected: Boolean(tk), openId: tk?.openId || null, scope: tk?.scope || null } });
  } catch (err) {
    console.error('Error consultando TikTok:', err.message);
    return res.status(500).json({ ok: false, message: 'No fue posible consultar TikTok.' });
  }
};

export const tiktokConnect = async (req, res) => {
  try {
    const redirectUri = `${requestBaseUrl(req)}/api/tienda/marketing/tiktok/callback`;
    const state = tiktokPublish.buildState({ userId: req.auth.userId, redirectUri, ts: Date.now() });
    const url = await tiktokPublish.buildAuthorizeUrl({ redirectUri, state });
    return res.json({ ok: true, url });
  } catch (err) {
    console.error('Error iniciando TikTok OAuth:', err.message);
    return res.status(400).json({ ok: false, message: err.message || 'No fue posible iniciar la conexión.' });
  }
};

// Callback público de TikTok (sin sesión): valida el state firmado y guarda el token.
export const tiktokCallback = async (req, res) => {
  try {
    const error = req.query.error || req.query.error_description;
    if (error) return res.redirect(`${process.env.FRONTEND_URL}/market/marketing?tiktok=error`);
    const code = req.query.code;
    const parsed = tiktokPublish.parseState(req.query.state);
    if (!code || !parsed?.userId || !parsed?.redirectUri) {
      return res.status(400).send('Solicitud de TikTok inválida.');
    }
    const data = await tiktokPublish.exchangeCode({ code, redirectUri: parsed.redirectUri });
    if (!data?.access_token || !data?.open_id) {
      console.error('TikTok token error:', data?.error, data?.error_description);
      return res.redirect(`${process.env.FRONTEND_URL}/market/marketing?tiktok=error`);
    }
    await tiktokPublish.saveTikTokIntegration(parsed.userId, {
      openId: data.open_id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      scope: data.scope,
      expiresIn: data.expires_in,
    });
    return res.redirect(`${process.env.FRONTEND_URL}/market/marketing?tiktok=connected`);
  } catch (err) {
    console.error('Error en callback de TikTok:', err.response?.data || err.message);
    return res.redirect(`${process.env.FRONTEND_URL}/market/marketing?tiktok=error`);
  }
};

export const tiktokDisconnect = async (req, res) => {
  try {
    await tiktokPublish.deleteTikTokIntegration(req.auth.userId);
    return res.json({ ok: true, message: 'Cuenta de TikTok desconectada.' });
  } catch (err) {
    console.error('Error desconectando TikTok:', err.message);
    return res.status(500).json({ ok: false, message: 'No fue posible desconectar TikTok.' });
  }
};

// Sube un video (por URL) a la bandeja de borradores del creador.
export const tiktokUpload = async (req, res) => {
  const tiendaId = req.auth.userId;
  const videoUrl = String(req.body?.videoUrl || '').trim();
  const suggestionId = toInt(req.body?.suggestionId, { min: 1 });
  if (!/^https?:\/\//i.test(videoUrl)) {
    return res.status(400).json({ ok: false, message: 'Indica una URL de video válida (mp4).' });
  }
  try {
    const tk = await tiktokPublish.getTikTokIntegration(tiendaId);
    if (!tk) return res.status(400).json({ ok: false, message: 'Conecta tu cuenta de TikTok primero.' });

    const resp = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
      maxContentLength: 80 * 1024 * 1024,
      maxBodyLength: Infinity,
    });
    const buffer = Buffer.from(resp.data);
    if (buffer.length === 0) return res.status(400).json({ ok: false, message: 'El video está vacío.' });
    if (buffer.length > 80 * 1024 * 1024) return res.status(400).json({ ok: false, message: 'El video supera 80 MB.' });
    const ct = String(resp.headers['content-type'] || '');
    const contentType = /^video\//i.test(ct) ? ct.split(';')[0] : 'video/mp4';

    const { publishId } = await tiktokPublish.uploadVideoToInbox({ accessToken: tk.accessToken, videoBuffer: buffer, contentType });
    if (suggestionId) await markSuggestionState(tiendaId, suggestionId, 'aplicada').catch(() => {});

    return res.json({
      ok: true,
      publishId,
      message: 'Video enviado a tu bandeja de TikTok. Ábrela para terminar de publicar.',
    });
  } catch (err) {
    console.error('Error subiendo video a TikTok:', err.response?.data || err.message);
    const msg = err.response?.data?.error?.message || err.message || 'No fue posible enviar el video.';
    return res.status(500).json({ ok: false, message: `TikTok: ${msg}` });
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
  tiktokStatus,
  tiktokConnect,
  tiktokCallback,
  tiktokUpload,
  tiktokDisconnect,
};
