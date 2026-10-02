import {
  getIntegracionesForUser,
  saveIntegracionForUser,
  queryIntegrationProduct,
} from '../services/integracion.service.js';
import { getOAuthStatus, saveOAuthConfig } from '../services/oauthConfig.service.js';
import { getTiendaForUser, getTiktokPixelForUser } from '../services/tienda.service.js';
import { sendTikTokTestEvent } from '../services/tiktokEvents.service.js';
import { cleanString, cleanUrl, isAllowedEnum } from '../utils/validation.js';

export const createIntegracionController = ({
  getIntegraciones = getIntegracionesForUser,
  saveIntegracion = saveIntegracionForUser,
  queryProductService = queryIntegrationProduct,
} = {}) => ({
  get: async (req, res) => {
    try {
      const integraciones = await getIntegraciones(req.auth.userId);
      return res.json({ ok: true, integraciones });
    } catch (error) {
      console.error('Error al obtener integraciones:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible consultar las integraciones.' });
    }
  },

  save: async (req, res) => {
    const provider = cleanString(req.body?.provider, { maxLength: 30 });
    const apiKey = cleanString(req.body?.apiKey, { maxLength: 500 });

    if (!provider || !apiKey) {
      return res.status(400).json({
        ok: false,
        message: 'Proveedor y clave de API son requeridos.',
      });
    }
    if (!isAllowedEnum(provider, ['mastershop', 'dropi'])) {
      return res.status(400).json({
        ok: false,
        message: 'Proveedor de integración no válido.',
      });
    }

    try {
      const integraciones = await saveIntegracion(req.auth.userId, provider, apiKey);
      return res.json({
        ok: true,
        message: 'Integración guardada con éxito.',
        integraciones,
      });
    } catch (error) {
      console.error('Error al guardar integración:', error.message);
      return res.status(400).json({ ok: false, message: error.message || 'No fue posible guardar la integración.' });
    }
  },

  // Estado (enmascarado) de la integración TikTok de la tienda del vendedor.
  getTiktokPixel: async (req, res) => {
    try {
      return res.json({ ok: true, pixel: await getTiktokPixelForUser(req.auth.userId) });
    } catch (error) {
      console.error('Error al consultar TikTok Pixel:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible consultar la configuración.' });
    }
  },

  // Envía un evento de prueba (Events API) sin afectar las conversiones reales.
  sendTiktokTestEvent: async (req, res) => {
    try {
      const result = await sendTikTokTestEvent({
        tiendaId: req.auth.userId,
        testEventCode: cleanString(req.body?.test_event_code, { maxLength: 60 }) || null,
      });
      return res.json({ ok: true, ...result });
    } catch (error) {
      console.error('Error al enviar evento de prueba TikTok:', error.message);
      return res.status(400).json({ ok: false, message: error.message || 'No fue posible enviar el evento de prueba.' });
    }
  },

  // OAuth global de la plataforma (TikTok Login Kit). Solo la tienda principal.
  getTiktokAuth: async (req, res) => {
    try {
      const tienda = await getTiendaForUser(req.auth.userId);
      if (!tienda?.isMain) {
        return res.status(403).json({ ok: false, message: 'Esta configuración es de la tienda principal.' });
      }
      return res.json({ ok: true, auth: await getOAuthStatus('tiktok') });
    } catch (error) {
      console.error('Error al consultar TikTok Auth:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible consultar la configuración.' });
    }
  },

  saveTiktokAuth: async (req, res) => {
    try {
      const tienda = await getTiendaForUser(req.auth.userId);
      if (!tienda?.isMain) {
        return res.status(403).json({ ok: false, message: 'Esta configuración es de la tienda principal.' });
      }
      const auth = await saveOAuthConfig('tiktok', {
        clientId: cleanString(req.body?.clientId, { maxLength: 200 }),
        clientSecret: cleanString(req.body?.clientSecret, { maxLength: 300 }),
        redirectUri: cleanUrl(req.body?.redirectUri, { maxLength: 500 }),
        scopes: cleanString(req.body?.scopes, { maxLength: 200 }),
        enabled: req.body?.enabled,
      });
      return res.json({ ok: true, message: 'Credenciales de TikTok guardadas.', auth });
    } catch (error) {
      console.error('Error al guardar TikTok Auth:', error.message);
      return res.status(400).json({ ok: false, message: error.message || 'No fue posible guardar la configuración.' });
    }
  },

  queryProduct: async (req, res) => {
    const provider = cleanString(req.query?.provider, { maxLength: 30 });
    const productId = cleanString(req.query?.productId, { maxLength: 200 });

    if (!provider || !productId) {
      return res.status(400).json({
        ok: false,
        message: 'Proveedor e ID de producto son requeridos.',
      });
    }
    if (!isAllowedEnum(provider, ['mastershop', 'dropi'])) {
      return res.status(400).json({
        ok: false,
        message: 'Proveedor de integración no válido.',
      });
    }

    try {
      const data = await queryProductService(req.auth.userId, provider, productId);
      return res.json({
        ok: true,
        data,
      });
    } catch (error) {
      console.error('Error al consultar producto en integración:', error.message);
      const externalStatus = error.response?.status;
      const isAuthError = externalStatus === 401 || externalStatus === 403;
      const status = isAuthError ? 400 : externalStatus || 400;
      const message = isAuthError
        ? 'La API key de la integración es inválida o está expirada. Verifícala en Mi Tienda.'
        : error.response?.data?.message || error.message || 'No fue posible consultar el producto.';
      return res.status(status).json({ ok: false, message });
    }
  },
});

const integracionController = createIntegracionController();
export const {
  get: getIntegraciones,
  save: saveIntegracion,
  queryProduct,
  getTiktokPixel,
  sendTiktokTestEvent,
  getTiktokAuth,
  saveTiktokAuth,
} = integracionController;
