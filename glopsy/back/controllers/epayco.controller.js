import { startEpaycoCheckout, processEpaycoConfirmation, getEpaycoOrderStatus } from '../services/epayco.service.js';

export const epaycoStart = async (req, res) => {
  try {
    const body = req.body || {};
    const result = await startEpaycoCheckout(req.auth?.userId || null, {
      items: body.items,
      customerInfo: body.customer_info || {},
      guestHash: body.guestHash || null,
      shippingCost: body.shipping_cost || 0,
      shippingPayload: body.shipping_payload || null,
      billing: body.billing || null,
      baseUrl: `${req.protocol}://${req.get('host')}`,
    });
    if (!result.ok) {
      const status = result.reason === 'epayco_no_configurado' ? 503 : 400;
      const messages = {
        epayco_no_configurado: 'ePayco no está configurado.',
        carrito_vacio: 'Tu carrito está vacío.',
      };
      return res.status(status).json({ ok: false, message: messages[result.reason] || result.reason });
    }
    return res.json(result);
  } catch (error) {
    console.error('Error iniciando checkout ePayco:', error.message);
    return res.status(502).json({ ok: false, message: 'No fue posible iniciar el pago con ePayco.' });
  }
};

// ePayco invoca la confirmación por GET o POST.
export const epaycoConfirmation = async (req, res) => {
  try {
    const payload = { ...(req.query || {}), ...(req.body || {}) };
    const result = await processEpaycoConfirmation(payload);
    if (result.status === 401) return res.status(401).send('FIRMA_INVALIDA');
    if (result.ok === false) return res.status(result.status || 500).send('ERROR');
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Error procesando confirmación ePayco:', error.message);
    return res.status(500).send('ERROR');
  }
};

export const epaycoStatus = async (req, res) => {
  try {
    const result = await getEpaycoOrderStatus(req.params.reference);
    if (!result.ok) return res.status(404).json({ ok: false, message: result.reason });
    return res.json(result);
  } catch (error) {
    console.error('Error consultando estado ePayco:', error.message);
    return res.status(502).json({ ok: false, message: 'No fue posible consultar el estado.' });
  }
};
