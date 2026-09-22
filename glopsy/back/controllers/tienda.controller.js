import { 
  getTiendaForUser, 
  ensureTiendaForUser,
  recordTiendaTermsAcceptance,
  updateTiendaForUser,
  updateTiendaStatus, 
  getProductionIntegrationsForUser,
  getDianConfigForUser, 
  saveDianConfigForUser,
  saveDianFiscalForUser,
  getPayoutAccountForUser,
  savePayoutAccountForUser,
  getPublicPaymentMethods,
  requestUsdActivation as requestUsdActivationForUser,
  getUsdActivationStatus,
  saveStorefrontAppearanceForUser,
} from '../services/tienda.service.js';
import { getBaVenNif12Report } from '../services/fiscalReport.service.js';
import { buildDianPlantillaFromStore } from '../services/dianStorePlantilla.service.js';
import { getLibroVentasData, buildLibroVentasPdf } from '../services/libroVentas.service.js';
import {
  getCheckoutIntegrationsForUser,
  saveCheckoutIntegrationForUser,
  deleteCheckoutIntegrationForUser,
  getStoreAnalytics
} from '../services/tienda.service.js';
import { generateDianPlantillaFile } from '../services/dianPlantilla.service.js';
import { getStoreLedgerForUser } from '../services/ledger.service.js';
import { pool } from '../db.js';
import { getShippingOptionsFromEnvia } from '../services/envia.service.js';
import { cleanString, isAllowedEnum } from '../utils/validation.js';
import { getDocumentType, isValidDocumentNumber, isValidPhoneForCountry, normalizePhone, isValidEmail } from '../utils/countryFields.js';
import { invalidateEdgeCache } from '../utils/cacheInvalidate.js';
import { invalidateCatalogCache, invalidateProductDetailCachesForStore } from '../services/product.service.js';

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
  ensureTienda = ensureTiendaForUser,
  updateTienda = updateTiendaForUser,
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

  // Alta de tienda para un vendedor nuevo (idempotente: si ya existe la devuelve).
  createStore: async (req, res) => {
    try {
      // Solo usuarios autorizados por el administrador (users.can_sell) pueden crear tienda.
      const { rows: uRows } = await pool.query(`SELECT can_sell FROM users WHERE id = $1 LIMIT 1`, [req.auth.userId]);
      if (!uRows[0]?.can_sell) {
        return res.status(403).json({ ok: false, message: 'No estás autorizado para crear una tienda. Contacta al administrador.' });
      }
      const name = cleanString(req.body?.name, { maxLength: 100 });
      const slug = cleanString(req.body?.slug, { maxLength: 63 });
      const gaRaw = req.body?.ga_id;
      const paisRaw = req.body?.pais_id;
      const contactoEmail = cleanString(req.body?.contacto_email, { maxLength: 160 });
      const contactoTelefonoRaw = cleanString(req.body?.contacto_telefono, { maxLength: 30 });

      // Validación de campos según la información solicitada.
      if (!name || String(name).trim().length < 3) {
        return res.status(400).json({ ok: false, message: 'El nombre de la tienda debe tener al menos 3 caracteres.' });
      }
      if (!slug || String(slug).trim() === '') {
        return res.status(400).json({ ok: false, message: 'El subdominio de la tienda es obligatorio.' });
      }

      // País de operación (para validar teléfono y documento).
      const paisIdNum = paisRaw !== undefined && paisRaw !== null && String(paisRaw).trim() !== ''
        ? Number(paisRaw)
        : null;
      let paisCodigo = 'CO';
      if (paisIdNum) {
        const { rows: pr } = await pool.query(`SELECT codigo_iso FROM paises WHERE id = $1 LIMIT 1`, [paisIdNum]);
        if (!pr[0]) {
          return res.status(400).json({ ok: false, message: 'País no válido.' });
        }
        paisCodigo = pr[0].codigo_iso;
      }

      if (!isValidEmail(contactoEmail)) {
        return res.status(400).json({ ok: false, message: 'Ingresa un correo de contacto válido.' });
      }
      if (!isValidPhoneForCountry(paisCodigo, contactoTelefonoRaw)) {
        return res.status(400).json({ ok: false, message: 'Ingresa un teléfono de contacto válido para el país de tu tienda.' });
      }
      const contactoTelefono = normalizePhone(paisCodigo, contactoTelefonoRaw);

      // Aceptación de Términos y Condiciones (y Contrato de Mandato): obligatoria.
      const terms = req.body?.terms && typeof req.body.terms === 'object' && !Array.isArray(req.body.terms)
        ? req.body.terms
        : {};
      if (terms.accepted !== true) {
        return res.status(400).json({
          ok: false,
          code: 'TERMS_REQUIRED',
          message: 'Debes aceptar los Términos y Condiciones y el Contrato de Mandato para crear tu tienda.',
        });
      }
      const termsVersion = cleanString(terms.version, { maxLength: 30 }) || 'v1';

      const tienda = await ensureTienda(req.auth.userId, {
        name,
        slug,
        ga_id: gaRaw !== undefined && gaRaw !== null ? String(gaRaw).trim().slice(0, 40) : null,
        pais_id: paisIdNum,
        contacto_email: contactoEmail,
        contacto_telefono: contactoTelefono,
      });
      if (!tienda) {
        return res.status(400).json({ ok: false, message: 'No fue posible crear la tienda.' });
      }

      // Trazabilidad clara de la aceptación: usuario, IP, timestamp, navegador,
      // dispositivo, país, idioma y coordenadas. No bloquea la creación si falla.
      try {
        const visitorCountry = String(req.get('x-visitor-country') || req.get('cf-ipcountry') || '').trim();
        await recordTiendaTermsAcceptance({
          userId: req.auth.userId,
          tiendaUsrid: req.auth.userId,
          termsVersion,
          ip: req.ip,
          forwardedFor: req.get('x-forwarded-for'),
          userAgent: req.get('user-agent'),
          language: req.get('accept-language') || terms.language,
          timezone: terms.timezone,
          country: visitorCountry,
          latitude: terms.latitude,
          longitude: terms.longitude,
          referrer: terms.referrer || req.get('referer'),
          metadata: {
            screen: terms.screen || null,
            platform: terms.platform || null,
            visitorCountry: visitorCountry || null,
            acceptLanguage: req.get('accept-language') || null,
          },
        });
      } catch (auditError) {
        console.error('Error al registrar la aceptación de términos:', auditError.message);
      }

      await invalidateCatalogCache().catch(() => {});
      return res.json({ ok: true, tienda });
    } catch (error) {
      if (error.code === 'DUPLICATE_SLUG') {
        return res.status(409).json({ ok: false, message: error.message });
      }
      if (error.code === 400) {
        return res.status(400).json({ ok: false, message: error.message });
      }
      console.error('Error al crear tienda:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible crear la tienda.' });
    }
  },

  // Actualiza nombre/subdominio/GA de la tienda del usuario logueado.
  updateStore: async (req, res) => {
    try {
      const name = cleanString(req.body?.name, { maxLength: 100 });
      const slug = cleanString(req.body?.slug, { maxLength: 63 });
      const gaRaw = req.body?.ga_id;
      const paisRaw = req.body?.pais_id;
      const zoomOrigenRaw = req.body?.zoom_origen_codciudad;
      const internationalDispatchRaw = req.body?.international_dispatch_provider;
      const hasName = name !== undefined && name !== null && String(name).trim() !== '';
      const hasSlug = slug !== undefined && slug !== null && String(slug).trim() !== '';
      const hasGa = gaRaw !== undefined && gaRaw !== null;
      const hasPais = paisRaw !== undefined && paisRaw !== null && String(paisRaw).trim() !== '';
      const hasZoomOrigen = zoomOrigenRaw !== undefined && zoomOrigenRaw !== null && String(zoomOrigenRaw).trim() !== '';
      const hasInternationalDispatch = internationalDispatchRaw !== undefined;
      if (!hasName && !hasSlug && !hasGa && !hasPais && !hasZoomOrigen && !hasInternationalDispatch) {
        return res.status(400).json({ ok: false, message: 'No hay cambios que aplicar.' });
      }
      const tienda = await updateTienda(req.auth.userId, {
        name: hasName ? name : null,
        slug: hasSlug ? slug : null,
        ga_id: hasGa ? String(gaRaw).trim() : undefined,
        pais_id: hasPais ? Number(paisRaw) : undefined,
        zoom_origen_codciudad: hasZoomOrigen ? Number(zoomOrigenRaw) : undefined,
        international_dispatch_provider: internationalDispatchRaw === null || internationalDispatchRaw === ''
          ? null
          : (['mastershop'].includes(internationalDispatchRaw) ? internationalDispatchRaw : undefined),
      });
      if (!tienda) {
        return res.status(404).json({ ok: false, message: 'No tienes una tienda registrada.' });
      }
      return res.json({ ok: true, tienda });
    } catch (error) {
      if (error.code === 'DUPLICATE_SLUG') {
        return res.status(409).json({ ok: false, message: error.message });
      }
      if (error.code === 400) {
        return res.status(400).json({ ok: false, message: error.message });
      }
      console.error('Error al actualizar tienda:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible actualizar la tienda.' });
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
      // Dar de alta (activar) exige credenciales de PRODUCCIÓN de pagos y envíos.
      if (req.body.isActive === true) {
        const setup = await getProductionIntegrationsForUser(req.auth.userId);
        if (!setup.ok) {
          return res.status(400).json({
            ok: false,
            message: `No puedes activar la tienda sin: ${setup.missing.join(', ')}. Configúralas en producción e inténtalo de nuevo.`,
          });
        }
      }

      const tienda = await updateStatus(req.auth.userId, req.body.isActive);
      if (!tienda) {
        return res.status(404).json({ ok: false, message: 'No tienes una tienda registrada.' });
      }
      await invalidateEdgeCache();
      await invalidateCatalogCache();
      await invalidateProductDetailCachesForStore(req.auth.userId);
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
    const sw_id = cleanString(req.body.sw_id, { maxLength: 255 });
    const sw_pin = cleanString(req.body.sw_pin, { maxLength: 255 });
    const technical_key = cleanString(req.body.technical_key, { maxLength: 50000, allowNewlines: true });
    const prefix = cleanString(req.body.prefix, { maxLength: 50 });
    const test_set_id = cleanString(req.body.test_set_id, { maxLength: 255 });
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
      const config = await saveDianConfig(req.auth.userId, { sw_id, sw_pin, technical_key, prefix, test_set_id });
      return res.json({ ok: true, dian: config, message: 'Configuración DIAN guardada con éxito.' });
    } catch (error) {
      console.error('Error al guardar configuración DIAN:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible guardar la configuración DIAN.' });
    }
  },

  generateDianPlantilla: async (req, res) => {
    try {
      const result = generateDianPlantillaFile(req.body || {});
      if (!result.ok) {
        return res.status(400).json({
          ok: false,
          message: 'La plantilla tiene errores de validación.',
          errors: result.errors,
        });
      }
      return res.json({
        ok: true,
        filename: result.filename,
        plantilla: result.plantilla,
        content: result.content,
      });
    } catch (error) {
      console.error('Error al generar plantilla DIAN:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible generar la plantilla DIAN.' });
    }
  },

  getPayoutAccount: async (req, res) => {
    try {
      const account = await getPayoutAccountForUser(req.auth.userId);
      return res.json({ ok: true, account });
    } catch (error) {
      console.error('Error al consultar la cuenta de pagos:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible consultar la cuenta de pagos.' });
    }
  },

  savePayoutAccount: async (req, res) => {
    const banco_codigo = cleanString(req.body.banco_codigo, { maxLength: 20 });
    const banco_nombre = cleanString(req.body.banco_nombre, { maxLength: 120 });
    const tipo_cuenta = cleanString(req.body.tipo_cuenta, { maxLength: 20 });
    const numero_cuenta = cleanString(req.body.numero_cuenta, { maxLength: 40 });
    const titular_cuenta = cleanString(req.body.titular_cuenta, { maxLength: 150 });
    const titular_documento = cleanString(req.body.titular_documento, { maxLength: 40 });
    const tipo_documento = cleanString(req.body.tipo_documento, { maxLength: 20 });
    const tipo_proveedor = cleanString(req.body.tipo_proveedor, { maxLength: 20 });

    if (!banco_codigo || !tipo_cuenta || !numero_cuenta || !titular_cuenta || !titular_documento || !tipo_documento) {
      return res.status(400).json({ ok: false, message: 'Banco, tipo de cuenta, número de cuenta, titular, tipo y número de documento son obligatorios.' });
    }
    if (!isAllowedEnum(tipo_proveedor, ['natural', 'juridica'])) {
      return res.status(400).json({ ok: false, message: 'Selecciona si eres persona natural o jurídica.' });
    }
    // La persona jurídica siempre es responsable de IVA; la natural lo declara.
    const responsable_iva = tipo_proveedor === 'juridica'
      ? true
      : req.body.responsable_iva === true || req.body.responsable_iva === 'true';
    if (!isAllowedEnum(tipo_cuenta, ['ahorro', 'corriente'])) {
      return res.status(400).json({ ok: false, message: 'El tipo de cuenta debe ser ahorro o corriente.' });
    }
    // El tipo y el número de documento deben corresponder al país donde opera la tienda.
    const tiendaActual = await getTiendaForUser(req.auth.userId);
    const paisCodigo = tiendaActual?.paisCodigo || 'CO';
    const docType = getDocumentType(paisCodigo, tipo_documento);
    if (!docType) {
      return res.status(400).json({ ok: false, message: 'Selecciona un tipo de documento válido para el país de tu tienda.' });
    }
    if (!isValidDocumentNumber(paisCodigo, tipo_documento, titular_documento)) {
      return res.status(400).json({ ok: false, message: `El número de documento no es válido (${docType.hint}).` });
    }
    const esBinance = banco_codigo === 'BINANCE_PAY';
    const cuentaValida = esBinance
      ? /^[A-Za-z0-9._@-]{4,60}$/.test(numero_cuenta)
      : /^\d{4,40}$/.test(numero_cuenta);
    if (!cuentaValida) {
      return res.status(400).json({
        ok: false,
        message: esBinance
          ? 'Ingresa tu Binance Pay ID o correo (4 a 60 caracteres).'
          : 'El número de cuenta debe tener entre 4 y 40 dígitos.',
      });
    }

    try {
      const account = await savePayoutAccountForUser(req.auth.userId, {
        banco_codigo, banco_nombre, tipo_cuenta, numero_cuenta, titular_cuenta, titular_documento, tipo_documento,
        tipo_proveedor, responsable_iva,
      });
      return res.json({ ok: true, account, message: 'Cuenta de pagos guardada con éxito.' });
    } catch (error) {
      if (error.code === 'BANCO_INVALIDO') {
        return res.status(400).json({ ok: false, message: error.message });
      }
      console.error('Error al guardar la cuenta de pagos:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible guardar la cuenta de pagos.' });
    }
  },

  saveDianFiscal: async (req, res) => {
    const numero_resolucion = cleanString(req.body?.numero_resolucion, { maxLength: 40 });
    const resolucion_fecha_desde = cleanString(req.body?.resolucion_fecha_desde, { maxLength: 10 });
    const resolucion_fecha_hasta = cleanString(req.body?.resolucion_fecha_hasta, { maxLength: 10 });
    const direccion_fiscal = cleanString(req.body?.direccion_fiscal, { maxLength: 200 });
    const regimen = cleanString(req.body?.regimen, { maxLength: 5 });
    const responsabilidad = cleanString(req.body?.responsabilidad, { maxLength: 10 });
    try {
      const fiscal = await saveDianFiscalForUser(req.auth.userId, {
        numero_resolucion, resolucion_fecha_desde, resolucion_fecha_hasta,
        direccion_fiscal, regimen, responsabilidad,
      });
      return res.json({ ok: true, fiscal, message: 'Datos fiscales DIAN guardados.' });
    } catch (error) {
      console.error('Error al guardar datos fiscales DIAN:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible guardar los datos fiscales.' });
    }
  },

  getDianPlantillaFromStore: async (req, res) => {
    const regimen = cleanString(req.body?.regimen, { maxLength: 5 }) || '48';
    const responsabilidad = cleanString(req.body?.responsabilidad, { maxLength: 10 }) || 'O-47';
    try {
      const result = await buildDianPlantillaFromStore(req.auth.userId, { regimen, responsabilidad });
      if (!result.ok) {
        return res.status(400).json({ ok: false, message: 'La plantilla tiene errores de validación.', errors: result.errors });
      }
      return res.json({ ok: true, filename: result.filename, content: result.content });
    } catch (error) {
      console.error('Error al generar la plantilla DIAN desde ventas:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible generar la plantilla DIAN.' });
    }
  },

  getLedger: async (req, res) => {
    try {
      const moneda = cleanString(req.query.moneda, { maxLength: 10 }) || 'COP';
      const ledger = await getStoreLedgerForUser(req.auth.userId, moneda.toUpperCase());
      return res.json({ ok: true, ...ledger });
    } catch (error) {
      console.error('Error al consultar el ledger de la tienda:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible consultar el saldo.' });
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

  // Público: pasarelas disponibles y cuál es la predeterminada (para el checkout).
  getPaymentMethods: async (req, res) => {
    try {
      const moneda = cleanString(req.query.moneda, { maxLength: 10 }) || 'COP';
      const methods = await getPublicPaymentMethods({ moneda });
      return res.json({ ok: true, ...methods });
    } catch (error) {
      console.error('Error al consultar métodos de pago:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible consultar los métodos de pago.' });
    }
  },

  requestUsdActivation: async (req, res) => {
    const note = cleanString(req.body?.note, { maxLength: 500 });
    try {
      const status = await requestUsdActivationForUser(req.auth.userId, note || null);
      return res.json({ ok: true, status, message: 'Solicitud enviada. Te avisaremos cuando sea aprobada.' });
    } catch (error) {
      console.error('Error al solicitar activación USD:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible enviar la solicitud.' });
    }
  },

  getUsdActivation: async (req, res) => {
    try {
      const status = await getUsdActivationStatus(req.auth.userId);
      return res.json({ ok: true, status });
    } catch (error) {
      console.error('Error al consultar activación USD:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible consultar la solicitud.' });
    }
  },

  saveStorefrontAppearance: async (req, res) => {
    const template = cleanString(req.body.template, { maxLength: 20 });
    const theme = cleanString(req.body.theme, { maxLength: 10 });
    const palette = cleanString(req.body.palette, { maxLength: 30 });
    const color = cleanString(req.body.color, { maxLength: 9 });
    const banner = cleanString(req.body.banner, { maxLength: 500 });

    if (!isAllowedEnum(template, ['dashboard', 'catalog', 'boutique'])) {
      return res.status(400).json({ ok: false, message: 'Plantilla no válida.' });
    }
    if (!isAllowedEnum(theme, ['light', 'dark', 'auto'])) {
      return res.status(400).json({ ok: false, message: 'Tema no válido.' });
    }
    if (!isAllowedEnum(palette, ['fucsia', 'azul', 'esmeralda', 'naranja', 'grafito', 'custom'])) {
      return res.status(400).json({ ok: false, message: 'Paleta no válida.' });
    }
    if (palette === 'custom' && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return res.status(400).json({ ok: false, message: 'El color personalizado debe ser un hex como #7c3aed.' });
    }

    try {
      const appearance = await saveStorefrontAppearanceForUser(req.auth.userId, {
        template, theme, palette,
        color: palette === 'custom' ? color : null,
        banner: banner || null,
      });
      return res.json({ ok: true, appearance, message: 'Apariencia guardada con éxito.' });
    } catch (error) {
      console.error('Error al guardar la apariencia:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible guardar la apariencia.' });
    }
  },

  getFiscalReport: async (req, res) => {
    const desde = cleanString(req.query.desde, { maxLength: 10 });
    const hasta = cleanString(req.query.hasta, { maxLength: 10 });
    try {
      const report = await getBaVenNif12Report(req.auth.userId, { desde, hasta });
      if (!report) return res.status(404).json({ ok: false, message: 'No tienes una tienda registrada.' });
      return res.json({ ok: true, report });
    } catch (error) {
      console.error('Error al generar el reporte fiscal:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible generar el reporte.' });
    }
  },

  getLibroVentasPdf: async (req, res) => {
    const desde = cleanString(req.query.desde, { maxLength: 10 });
    const hasta = cleanString(req.query.hasta, { maxLength: 10 });
    try {
      const data = await getLibroVentasData(req.auth.userId, { desde, hasta });
      if (!data) return res.status(404).json({ ok: false, message: 'No tienes una tienda registrada.' });
      const pdf = await buildLibroVentasPdf(data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="libro-ventas-${data.periodo.hasta}.pdf"`);
      return res.send(pdf);
    } catch (error) {
      console.error('Error al generar el libro de ventas:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible generar el libro de ventas.' });
    }
  },

  getAnalytics: async (req, res) => {
    try {
      const analytics = await getStoreAnalytics(req.auth.userId);
      return res.json({ ok: true, analytics });
    } catch (error) {
      console.error('Error al consultar estadísticas de la tienda:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible consultar las estadísticas de la tienda.' });
    }
  },

  saveCheckoutIntegration: async (req, res) => {
    const provider = cleanString(req.body.provider, { maxLength: 50 });
    const mode = cleanString(req.body.mode, { maxLength: 20 });
    const public_key = cleanString(req.body.public_key, { maxLength: 2048 });
    const access_token = cleanString(req.body.access_token, { maxLength: 2048 });
    const webhook_secret = cleanString(req.body.webhook_secret, { maxLength: 2048 });
    const is_default = req.body.is_default === true;

    if (!provider || !isAllowedEnum(provider, ['mercadopago', 'envia', 'epayco'])) {
      return res.status(400).json({ ok: false, message: 'Proveedor no válido.' });
    }

    const integrationMode = mode && isAllowedEnum(mode, ['prueba', 'produccion']) ? mode : 'prueba';

    const cleanAccessToken = access_token
      ? String(access_token).trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      : '';
    const cleanPublicKey = public_key
      ? String(public_key).trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      : null;
    const cleanWebhookSecret = webhook_secret
      ? String(webhook_secret).trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      : '';

    if (provider === 'mercadopago' && !cleanPublicKey) {
      return res.status(400).json({ ok: false, message: 'La Public Key es obligatoria para Mercado Pago.' });
    }
    if (provider === 'epayco' && !cleanPublicKey) {
      return res.status(400).json({ ok: false, message: 'La Public Key es obligatoria para ePayco.' });
    }

    // Permitir explícitamente guiones (-), underscores, puntos y caracteres válidos de credenciales (ej. Mercado Pago APP_USR-)
    const credentialPattern = /^[a-zA-Z0-9_\-\.\+\=\/\:\s]+$/;
    if (cleanAccessToken && !credentialPattern.test(cleanAccessToken)) {
      return res.status(400).json({ ok: false, message: 'El token de acceso contiene caracteres no válidos. Se permiten guiones (-).' });
    }
    if (cleanPublicKey && !credentialPattern.test(cleanPublicKey)) {
      return res.status(400).json({ ok: false, message: 'La Public Key contiene caracteres no válidos. Se permiten guiones (-).' });
    }

    try {
      const saved = await saveCheckoutIntegration(req.auth.userId, provider, integrationMode, {
        publicKey: cleanPublicKey,
        accessToken: cleanAccessToken || undefined,
        webhookSecret: cleanWebhookSecret || undefined,
        isDefault: is_default,
      });
      const provName = provider === 'mercadopago' ? 'Mercado Pago' : provider === 'epayco' ? 'ePayco' : 'ENVIA';
      const modeName = integrationMode === 'prueba' ? 'Prueba' : 'Producción';
      return res.json({ ok: true, integration: saved, message: `Configuración de ${provName} (${modeName}) guardada con éxito.` });
    } catch (error) {
      console.error('Error al guardar integración de checkout:', error.message);
      return res.status(500).json({ ok: false, message: 'No fue posible guardar la configuración de checkout.' });
    }
  },

  deleteCheckoutIntegration: async (req, res) => {
    const provider = cleanString(req.params.provider, { maxLength: 50 });
    const mode = cleanString(req.query.mode || req.body?.mode, { maxLength: 20 });
    if (!provider || !isAllowedEnum(provider, ['mercadopago', 'envia', 'epayco'])) {
      return res.status(400).json({ ok: false, message: 'Proveedor no válido.' });
    }

    const integrationMode = mode && isAllowedEnum(mode, ['prueba', 'produccion']) ? mode : 'prueba';

    try {
      const deleted = await deleteCheckoutIntegration(req.auth.userId, provider, integrationMode);
      if (!deleted) {
        return res.status(404).json({ ok: false, message: 'No se encontró la configuración para eliminar.' });
      }
      const provName = provider === 'mercadopago' ? 'Mercado Pago' : provider === 'epayco' ? 'ePayco' : 'ENVIA';
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
  createStore,
  updateStore,
  changeStatus, 
  getDian, 
  saveDian,
  generateDianPlantilla,
  saveDianFiscal,
  getDianPlantillaFromStore,
  getPayoutAccount,
  savePayoutAccount,
  getLedger,
  getPaymentMethods,
  requestUsdActivation,
  getUsdActivation,
  saveStorefrontAppearance,
  getFiscalReport,
  getLibroVentasPdf,
  getCheckoutIntegrations,
  saveCheckoutIntegration,
  deleteCheckoutIntegration,
  getAnalytics
} = tiendaController;
