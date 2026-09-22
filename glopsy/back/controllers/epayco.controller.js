import { visitorCountryFromReq } from '../services/checkoutCurrency.service.js';
import {
  startEpaycoCheckout,
  processEpaycoConfirmation,
  getEpaycoOrderStatus,
} from '../services/epaycoCheckout.service.js';

const baseUrlFromReq = (req) => `${req.protocol}://${req.get('host')}`;

export const epaycoStart = async (req, res) => {
  try {
    const body = req.body || {};
    const result = await startEpaycoCheckout(req.auth?.userId || null, {
      ...body,
      visitor: visitorCountryFromReq(req),
      baseUrl: baseUrlFromReq(req),
    });
    if (!result.ok) {
      const status = result.reason === 'epayco_no_configurado' ? 503 : 400;
      return res.status(status).json({ ok: false, message: result.reason });
    }
    return res.json(result);
  } catch (error) {
    console.error('Error iniciando checkout ePayco:', error.message);
    return res.status(502).json({ ok: false, message: 'No fue posible iniciar el pago.' });
  }
};

// ePayco espera HTTP 200 para dar por recibida la confirmación.
export const epaycoWebhook = async (req, res) => {
  try {
    const result = await processEpaycoConfirmation(req.body || {});
    if (result.status === 401) {
      return res.status(401).send('FIRMA_INVALIDA');
    }
    if (result.ok === false && result.status === 503) {
      return res.status(503).send('NO_CONFIGURADO');
    }
    if (result.ok === false) {
      console.warn('[ePayco Webhook] Error:', JSON.stringify(result));
      return res.status(result.status || 500).send('ERROR');
    }
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Error procesando webhook de ePayco:', error.message);
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
