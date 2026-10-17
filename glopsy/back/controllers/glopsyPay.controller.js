import {
  startGlopsyPayCheckout,
  processGlopsyPayWebhook,
  getGlopsyPayOrderStatus,
  getCartUsdtAvailability,
} from '../services/glopsyPay.service.js';

export const glopsyPayStart = async (req, res) => {
  try {
    const body = req.body || {};
    const result = await startGlopsyPayCheckout(req.auth?.userId || null, {
      items: body.items,
      customerInfo: body.customer_info || {},
      guestHash: body.guestHash || null,
      shippingCost: body.shipping_cost || 0,
      shippingPayload: body.shipping_payload || null,
      redirectBase: body.redirect_base || null,
    });
    if (!result.ok) {
      const status = result.reason === 'glopsypay_no_configurado' ? 503 : 400;
      const messages = {
        glopsypay_no_configurado: 'Glopsy Pay no está configurado para esta tienda.',
        usdt_no_habilitado: 'Esta tienda no tiene habilitado el cobro en USDT.',
        carrito_vacio: 'Tu carrito está vacío.',
      };
      return res.status(status).json({ ok: false, message: messages[result.reason] || result.reason, orderNumber: result.orderNumber || null });
    }
    return res.json(result);
  } catch (error) {
    console.error('Error iniciando checkout Glopsy Pay:', error.message);
    return res.status(502).json({ ok: false, message: 'No fue posible iniciar el pago con Glopsy Pay.' });
  }
};

export const glopsyPayAvailability = async (req, res) => {
  try {
    const result = await getCartUsdtAvailability(req.body?.items || []);
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Error consultando disponibilidad USDT:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible consultar la disponibilidad.' });
  }
};

export const glopsyPayWebhook = async (req, res) => {
  try {
    const result = await processGlopsyPayWebhook({
      rawBody: req.rawBody || Buffer.from(JSON.stringify(req.body || {})),
      signature: req.get('x-glopsy-signature') || null,
    });
    if (result.status === 401) return res.status(401).send('FIRMA_INVALIDA');
    if (result.status === 409) return res.status(409).send('MONTO_INVALIDO');
    if (result.ok === false) return res.status(result.status || 500).send('ERROR');
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Error procesando webhook Glopsy Pay:', error.message);
    return res.status(500).send('ERROR');
  }
};

export const glopsyPayStatus = async (req, res) => {
  try {
    const result = await getGlopsyPayOrderStatus(req.params.reference);
    if (!result.ok) return res.status(404).json({ ok: false, message: result.reason });
    return res.json(result);
  } catch (error) {
    console.error('Error consultando estado Glopsy Pay:', error.message);
    return res.status(502).json({ ok: false, message: 'No fue posible consultar el estado.' });
  }
};
