import { visitorCountryFromReq } from '../services/checkoutCurrency.service.js';
import {
  startBoldCheckout,
  processBoldConfirmation,
  getBoldOrderStatus,
} from '../services/boldCheckout.service.js';
import {
  startBoldQrCheckout,
  getBoldQrStatus,
  processBoldQrWebhook,
} from '../services/boldQr.service.js';

const baseUrlFromReq = (req) => `${req.protocol}://${req.get('host')}`;

export const boldStart = async (req, res) => {
  try {
    const body = req.body || {};
    const result = await startBoldCheckout(req.auth?.userId || null, {
      ...body,
      visitor: visitorCountryFromReq(req),
      baseUrl: baseUrlFromReq(req),
    });
    if (!result.ok) {
      const status = result.reason === 'bold_no_configurado' ? 503 : 400;
      return res.status(status).json({ ok: false, message: result.reason });
    }
    return res.json(result);
  } catch (error) {
    console.error('Error iniciando checkout Bold:', error.message);
    return res.status(502).json({ ok: false, message: 'No fue posible iniciar el pago.' });
  }
};

// Bold espera HTTP 200 para dar por recibida la confirmación.
export const boldWebhook = async (req, res) => {
  try {
    const result = await processBoldConfirmation(req.body || {});
    if (result.status === 401) {
      return res.status(401).send('FIRMA_INVALIDA');
    }
    if (result.ok === false && result.status === 503) {
      return res.status(503).send('NO_CONFIGURADO');
    }
    if (result.ok === false) {
      console.warn('[Bold Webhook] Error:', JSON.stringify(result));
      return res.status(result.status || 500).send('ERROR');
    }
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Error procesando webhook de Bold:', error.message);
    return res.status(500).send('ERROR');
  }
};

export const boldStatus = async (req, res) => {
  try {
    const result = await getBoldOrderStatus(req.params.reference);
    if (!result.ok) return res.status(404).json({ ok: false, message: result.reason });
    return res.json(result);
  } catch (error) {
    console.error('Error consultando estado Bold:', error.message);
    return res.status(502).json({ ok: false, message: 'No fue posible consultar el estado.' });
  }
};

// --- QR Bre-B (API de Pagos en Línea de Bold) ---

export const boldQrStart = async (req, res) => {
  try {
    const body = req.body || {};
    const result = await startBoldQrCheckout(req.auth?.userId || null, {
      ...body,
      visitor: visitorCountryFromReq(req),
    });
    if (!result.ok) {
      const status = result.reason === 'bold_no_configurado' ? 503 : 400;
      return res.status(status).json({ ok: false, message: result.reason });
    }
    return res.json(result);
  } catch (error) {
    console.error('Error iniciando checkout QR Bold:', error.message);
    return res.status(502).json({ ok: false, message: 'No fue posible generar el QR.' });
  }
};

export const boldQrStatus = async (req, res) => {
  try {
    const result = await getBoldQrStatus(req.params.reference);
    if (!result.ok) return res.status(404).json({ ok: false, message: result.reason });
    return res.json(result);
  } catch (error) {
    console.error('Error consultando estado QR Bold:', error.message);
    return res.status(502).json({ ok: false, message: 'No fue posible consultar el estado.' });
  }
};

// Bold espera HTTP 200 para dar por recibida la notificación.
export const boldQrWebhook = async (req, res) => {
  try {
    const result = await processBoldQrWebhook(req.body || {}, {
      rawBody: req.rawBody || null,
      signature: req.get('x-bold-signature') || null,
    });
    if (result.status === 401) return res.status(401).send('FIRMA_INVALIDA');
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Error procesando webhook QR Bold:', error.message);
    return res.status(500).send('ERROR');
  }
};