import { 
  getTiendaForUser, 
  updateTiendaStatus, 
  getDianConfigForUser, 
  saveDianConfigForUser,
  getCheckoutIntegrationsForUser,
  saveCheckoutIntegrationForUser,
  deleteCheckoutIntegrationForUser
} from '../services/tienda.service.js';
import { pool } from '../db.js';
import { getShippingOptionsFromEnvia } from '../services/envia.service.js';

export const createTiendaController = ({
  getShippingCosts = async (req, res) => {
    try {
      // Lógica para agrupar productos por idbusiness y ciudad
      const productos = await pool.query('SELECT * FROM produc;');
      const fullments = await pool.query('SELECT * FROM fullments;');

      // Agrupar productos
      const agrupados = {};

      for (const producto of productos.rows) {
        const fullment = fullments.rows.find(f => f.producto_id === producto.id);
        if (fullment) {
          const idbusiness = producto.product_owner?.idbusiness;
          const ciudadID = fullment.ciudad_id;

          const key = `${idbusiness}-${ciudadID}`;

          if (!agrupados[key]) {
            agrupados[key] = { pesoTotal: 0, productos: [] };
          }

          // Calcular peso volumétrico (usando dimensiones)
          const pesoVolumetrico = (producto.peso || 3) + (producto.largo || 30) + (producto.alto || 30) + (producto.ancho || 30);
          agrupados[key].pesoTotal += pesoVolumetrico;
          agrupados[key].productos.push(producto);
        }
      }

      // Consultar costos de envío para cada grupo
      const costos = {};
      for (const key in agrupados) {
        const { pesoTotal, productos } = agrupados[key];
        // Realizar consulta a envia.com
        const ciudad = productos[0]?.fullm_id || productos[0]?.ciudad_id || productos[0]?.ciudad || undefined;
        const { shippingOptions, shippingCost } = await getShippingOptionsFromEnvia(productos, ciudad);
        costos[key] = { costoEnvio: shippingCost, shippingOptions, productos };
      }

      return res.json({ ok: true, costos });
    } catch (error) {
      console.error('Error al obtener costos de envío:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible obtener costos de envío.' });
    }
  },
  getTienda = getTiendaForUser,
  updateStatus = updateTiendaStatus,
  getDianConfig = getDianConfigForUser,
  saveDianConfig = saveDianConfigForUser,
  getCheckoutIntegrations = getCheckoutIntegrationsForUser,
  saveCheckoutIntegration = saveCheckoutIntegrationForUser,
  deleteCheckoutIntegration = deleteCheckoutIntegrationForUser
} = {}) => ({
  getMine: async (req, res) => {
    try {
      const tienda = await getTienda(req.auth.userId);
      return res.json({ ok: true, tienda });
    } catch (error) {
      console.error('Error al consultar tienda:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible consultar la tienda.' });
    }
  },

  changeStatus: async (req, res) => {
    if (typeof req.body?.isActive !== 'boolean') {
      return res.status(400).json({
        ok: false,
        message: 'El campo isActive debe ser booleano.',
      });
    }

    try {
      const tienda = await updateStatus(req.auth.userId, req.body.isActive);
      if (!tienda) {
        return res.status(404).json({ ok: false, message: 'No tienes una tienda registrada.' });
      }
      return res.json({ ok: true, tienda });
    } catch (error) {
      console.error('Error al actualizar estado de tienda:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible actualizar la tienda.' });
    }
  },

  getDian: async (req, res) => {
    try {
      const config = await getDianConfig(req.auth.userId);
      return res.json({ ok: true, dian: config });
    } catch (error) {
      console.error('Error al consultar configuración DIAN:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible consultar la configuración DIAN.' });
    }
  },

  saveDian: async (req, res) => {
    const { sw_id, sw_pin, technical_key, prefix, test_set_id } = req.body;
    if (
      !sw_id || !String(sw_id).trim() ||
      !sw_pin || !String(sw_pin).trim() ||
      !technical_key || !String(technical_key).trim() ||
      !prefix || !String(prefix).trim() ||
      !test_set_id || !String(test_set_id).trim()
    ) {
      return res.status(400).json({ ok: false, message: 'Todos los campos de la DIAN son obligatorios y no pueden quedar vacíos.' });
    }
    try {
      const config = await saveDianConfig(req.auth.userId, req.body);
      return res.json({ ok: true, dian: config, message: 'Configuración DIAN guardada con éxito.' });
    } catch (error) {
      console.error('Error al guardar configuración DIAN:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible guardar la configuración DIAN.' });
    }
  },

  getCheckoutIntegrations: async (req, res) => {
    try {
      const integrations = await getCheckoutIntegrations(req.auth.userId);
      return res.json({ ok: true, integrations });
    } catch (error) {
      console.error('Error al consultar integraciones de checkout:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible consultar las integraciones de checkout.' });
    }
  },

  saveCheckoutIntegration: async (req, res) => {
    const { provider, mode, public_key, access_token } = req.body;
    
    if (!provider || !['mercadopago', 'envia'].includes(provider)) {
      return res.status(400).json({ ok: false, message: 'Proveedor no válido.' });
    }

    const integrationMode = mode && ['prueba', 'produccion'].includes(mode) ? mode : 'prueba';

    if (!access_token || !String(access_token).trim()) {
      return res.status(400).json({ ok: false, message: 'El token de acceso es obligatorio y no puede estar vacío.' });
    }

    if (provider === 'mercadopago') {
      if (!public_key || !String(public_key).trim()) {
        return res.status(400).json({ ok: false, message: 'La Public Key is obligatoria para Mercado Pago.' });
      }
    }

    const cleanAccessToken = String(access_token).trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    const cleanPublicKey = public_key ? String(public_key).trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') : null;

    // Permitir explícitamente guiones (-), underscores, puntos y caracteres válidos de credenciales (ej. Mercado Pago APP_USR-)
    const credentialPattern = /^[a-zA-Z0-9_\-\.\+\=\/\:\s]+$/;
    if (!credentialPattern.test(cleanAccessToken)) {
      return res.status(400).json({ ok: false, message: 'El token de acceso contiene caracteres no válidos. Se permiten guiones (-).' });
    }
    if (cleanPublicKey && !credentialPattern.test(cleanPublicKey)) {
      return res.status(400).json({ ok: false, message: 'La Public Key contiene caracteres no válidos. Se permiten guiones (-).' });
    }

    try {
      const saved = await saveCheckoutIntegration(req.auth.userId, provider, integrationMode, cleanPublicKey, cleanAccessToken);
      const provName = provider === 'mercadopago' ? 'Mercado Pago' : 'ENVIA';
      const modeName = integrationMode === 'prueba' ? 'Prueba' : 'Producción';
      return res.json({ ok: true, integration: saved, message: `Configuración de ${provName} (${modeName}) guardada con éxito.` });
    } catch (error) {
      console.error('Error al guardar integración de checkout:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible guardar la configuración de checkout.' });
    }
  },

  deleteCheckoutIntegration: async (req, res) => {
    const { provider } = req.params;
    const mode = req.query.mode || req.body?.mode;
    if (!provider || !['mercadopago', 'envia'].includes(provider)) {
      return res.status(400).json({ ok: false, message: 'Proveedor no válido.' });
    }

    const integrationMode = mode && ['prueba', 'produccion'].includes(mode) ? mode : 'prueba';

    try {
      const deleted = await deleteCheckoutIntegration(req.auth.userId, provider, integrationMode);
      if (!deleted) {
        return res.status(404).json({ ok: false, message: 'No se encontró la configuración para eliminar.' });
      }
      const provName = provider === 'mercadopago' ? 'Mercado Pago' : 'ENVIA';
      const modeName = integrationMode === 'prueba' ? 'Prueba' : 'Producción';
      return res.json({ ok: true, message: `Configuración de ${provName} (${modeName}) eliminada con éxito.` });
    } catch (error) {
      console.error('Error al eliminar integración de checkout:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible eliminar la configuración.' });
    }
  },
});

const tiendaController = createTiendaController();
export const { 
  getMine, 
  changeStatus, 
  getDian, 
  saveDian,
  getCheckoutIntegrations,
  saveCheckoutIntegration,
  deleteCheckoutIntegration
} = tiendaController;
