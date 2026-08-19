import {
  getIntegracionesForUser,
  saveIntegracionForUser,
  queryIntegrationProduct,
} from '../services/integracion.service.js';
import { cleanString, isAllowedEnum } from '../utils/validation.js';

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
      const status = error.response?.status || 400;
      return res.status(status).json({
        ok: false,
        message: error.response?.data?.message || error.message || 'No fue posible consultar el producto.',
      });
    }
  },
});

const integracionController = createIntegracionController();
export const { get: getIntegraciones, save: saveIntegracion, queryProduct } = integracionController;
