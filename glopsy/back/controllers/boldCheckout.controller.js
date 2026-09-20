import {
  startBoldCheckout,
  createIntentForOrder,
  payOrder,
  getOrderPaymentStatus,
  refundOrder,
  listBanks,
} from '../services/boldCheckout.service.js';

const handle = (res, result) => {
  if (!result.ok) {
    const status = result.reason === 'orden_no_encontrada' ? 404 : 400;
    return res.status(status).json({ ok: false, message: result.reason });
  }
  return res.json(result);
};

// Crea la orden pendiente + la intención de pago (inicio del checkout transparente).
export const boldStart = async (req, res) => {
  try {
    const result = await startBoldCheckout(req.auth?.userId || null, req.body || {});
    if (!result.ok) return res.status(400).json({ ok: false, message: result.reason });
    return res.json(result);
  } catch (error) {
    console.error('Error iniciando checkout Bold:', error.message);
    return res.status(502).json({ ok: false, message: 'No fue posible iniciar el pago.' });
  }
};

export const boldIntent = async (req, res) => {
  try {
    const result = await createIntentForOrder(req.body || {});
    return handle(res, result);
  } catch (error) {
    console.error('Error creando intención Bold:', error.message);
    return res.status(502).json({ ok: false, message: 'No fue posible iniciar el pago.' });
  }
};

export const boldPay = async (req, res) => {
  try {
    const result = await payOrder(req.body || {});
    return handle(res, result);
  } catch (error) {
    console.error('Error procesando pago Bold:', error.message);
    return res.status(502).json({ ok: false, message: 'No fue posible procesar el pago.' });
  }
};

export const boldStatus = async (req, res) => {
  try {
    const result = await getOrderPaymentStatus(req.params.reference);
    return handle(res, result);
  } catch (error) {
    console.error('Error consultando estado Bold:', error.message);
    return res.status(502).json({ ok: false, message: 'No fue posible consultar el estado.' });
  }
};

export const boldRefund = async (req, res) => {
  try {
    const result = await refundOrder(req.params.reference, { reason: req.body?.reason });
    return handle(res, result);
  } catch (error) {
    console.error('Error reembolsando Bold:', error.message);
    return res.status(502).json({ ok: false, message: 'No fue posible reembolsar.' });
  }
};

export const boldBanks = async (req, res) => {
  try {
    const banks = await listBanks();
    return res.json({ ok: true, banks });
  } catch (error) {
    console.error('Error listando bancos PSE:', error.message);
    return res.status(502).json({ ok: false, message: 'No fue posible listar los bancos.' });
  }
};
