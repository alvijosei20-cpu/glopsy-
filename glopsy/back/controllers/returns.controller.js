import axios from 'axios';
import { pool } from '../db.js';
import { cleanString, cleanText, toNumber, toInt } from '../utils/validation.js';

// Estados locales del ticket de devolución
const RETURN_STATUS = {
  REQUESTED: 'RETURN_REQUESTED',
  PICKUP_SCHEDULED: 'PICKUP_SCHEDULED',
  IN_TRANSIT: 'IN_TRANSIT',
  COMPLETED: 'RETURN_COMPLETED',
  REJECTED: 'REJECTED',
};

// Estado que indica que el paquete devuelto llegó a bodega (webhook Mastershop)
const WAREHOUSE_RECEIVED_STATUS = 'RECEIVED_IN_WAREHOUSE';

// Obtiene la API key de Mastershop desde la tabla tienda_integraciones
const getMastershopApiKey = async (tiendaId) => {
  const { rows } = await pool.query(
    `SELECT api_key FROM tienda_integraciones WHERE user_id = $1 AND provider = 'mastershop' LIMIT 1`,
    [tiendaId || 1]
  );
  return rows[0]?.api_key || null;
};

const getMastershopBaseUrl = () =>
  process.env.MASTERSHOP_API_URL || 'https://prod.api.mastershop.com/api';

const generateReturnNumber = () => {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `RET-${Date.now().toString().slice(-6)}-${suffix}`;
};

// Suma días hábiles (lunes a viernes) a una fecha
const addBusinessDays = (date, days) => {
  const d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return d;
};

const RETURN_WINDOW_DAYS = 5;

// Verifica que la entrega esté dentro de la ventana de devolución (5 días hábiles)
const isWithinReturnWindow = (deliveredAt) => {
  if (!deliveredAt) return true;
  const delivered = new Date(deliveredAt);
  const deadline = addBusinessDays(delivered, RETURN_WINDOW_DAYS);
  const now = new Date();
  return now <= deadline && delivered <= now;
};

const getOrderDeliveredAt = async (orderId) => {
  const { rows } = await pool.query(
    `SELECT MAX(delivered_at) AS delivered_at
     FROM order_shipments
     WHERE order_id = $1 AND delivered_at IS NOT NULL`,
    [orderId]
  );
  return rows[0]?.delivered_at || null;
};

const resolveOrder = async (orderId) => {
  const id = toInt(orderId, { min: 1 });
  if (!id) return null;
  const { rows } = await pool.query(
    `SELECT * FROM orders WHERE id = $1 OR order_hash = $2 OR order_number = $3 OR payload->>'id_order' = $4 LIMIT 1`,
    [id, String(orderId), String(orderId), String(orderId)]
  );
  return rows[0] || null;
};

const resolveProductBySku = async (tiendaId, sku) => {
  if (!sku) return null;
  const { rows } = await pool.query(
    `SELECT id, stock_total FROM produc
     WHERE tienda_id = $1 AND (external_product_id = $2 OR public_id = $2 OR id::text = $2)
     LIMIT 1`,
    [tiendaId || 1, cleanString(sku, { maxLength: 100 })]
  );
  return rows[0] || null;
};

// ==========================================
// POST /api/returns/request
// ==========================================
export const requestReturn = async (req, res) => {
  const orderId = cleanString(req.body.orderId ?? req.body.order_id, { maxLength: 100 });
  const reason = cleanString(req.body.reason, { maxLength: 500 });
  const customerNotes = cleanText(req.body.customerNotes ?? req.body.customer_notes, { maxLength: 2000 });
  const productSku = cleanString(req.body.productSku ?? req.body.product_sku, { maxLength: 100 });

  // Soporta devolución de múltiples productos (products: [{ sku, quantity }])
  const products = Array.isArray(req.body.products)
    ? req.body.products.map((p) => ({
        sku: cleanString(p?.sku ?? p?.productSku ?? p?.public_id ?? p?.product_id, { maxLength: 100 }),
        quantity: toInt(p?.quantity, { min: 1, fallback: 1 }),
      })).filter((p) => p.sku)
    : [];

  const hasSingle = !!productSku;
  const hasMany = products.length > 0;

  if (!orderId || !reason) {
    return res.status(400).json({
      ok: false,
      message: 'orderId y reason son obligatorios para solicitar la devolución.',
    });
  }

  if (!hasSingle && !hasMany) {
    return res.status(400).json({
      ok: false,
      message: 'Indica al menos un producto (productSku o products) a devolver.',
    });
  }

  let order;
  try {
    // 1) Buscamos la orden en Mastershop para validar estado
    const tiendaId = req.auth?.userId || 1;
    const apiKey = await getMastershopApiKey(tiendaId);

    if (!apiKey) {
      return res.status(503).json({ ok: false, message: 'No hay integración Mastershop configurada.' });
    }

    const msResponse = await axios.get(`${getMastershopBaseUrl()}/orders/${orderId}`, {
      headers: { 'ms-api-key': apiKey },
      timeout: 8000,
    });

    const msOrder = msResponse.data?.data || msResponse.data;
    const idStatus = toNumber(msOrder?.id_status, { min: 1, fallback: 0 });
    const fulfillmentStatus = cleanString(msOrder?.fulfillment_status, { maxLength: 50 });
    const statusName = cleanString(msOrder?.status, { maxLength: 50 });

    const isDelivered =
      idStatus === 8 ||
      /deliver|entregad/i.test(fulfillmentStatus || '') ||
      /entregad|delivered/i.test(statusName || '');

    if (!isDelivered) {
      return res.status(400).json({
        ok: false,
        message:
          'La orden no está en estado ENTREGADO. Las devoluciones solo aplican a pedidos entregados.',
        mastershopStatus: { id_status: idStatus, fulfillment_status: fulfillmentStatus, status: statusName },
      });
    }

    // 2) Resolvemos la orden local (si existe)
    order = await resolveOrder(orderId);

    // 2b) Validamos ventana de devolución: máximo 5 días hábiles desde la entrega
    const deliveredAt = order ? await getOrderDeliveredAt(order.id) : null;
    if (deliveredAt && !isWithinReturnWindow(deliveredAt)) {
      const deadline = addBusinessDays(new Date(deliveredAt), RETURN_WINDOW_DAYS);
      return res.status(400).json({
        ok: false,
        message: 'La ventana de devolución (5 días hábiles desde la entrega) ya expiró.',
        deliveredAt,
        deadline: deadline.toISOString(),
      });
    }

    // 3) Construimos la lista de productos a devolver
    const skus = hasMany
      ? products
      : [{ sku: productSku, quantity: 1 }];

    const createdReturns = [];

    for (const entry of skus) {
      const product = await resolveProductBySku(order?.tienda_id || tiendaId, entry.sku);
      const returnNumber = generateReturnNumber();

      const { rows } = await pool.query(
        `INSERT INTO returns (
           return_number, order_id, order_ref, tienda_id, product_id, product_sku,
           quantity, reason, customer_notes, status, mastershop_status, payload
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, return_number, order_id, order_ref, product_sku, quantity, reason, status, created_at`,
        [
          returnNumber,
          order?.id || null,
          orderId,
          order?.tienda_id || tiendaId,
          product?.id || null,
          entry.sku,
          entry.quantity,
          reason,
          customerNotes || null,
          RETURN_STATUS.REQUESTED,
          statusName || null,
          JSON.stringify({ mastershop: msOrder, orderHash: order?.order_hash || null }),
        ]
      );
      createdReturns.push(rows[0]);
    }

    // 4) Mastershop gestiona las devoluciones como NOVEDAD/POSTVENTA internamente
    //    (panel de Mastershop). No se crea nada vía API: solo registramos el ticket local.
    return res.status(201).json({
      ok: true,
      message: `Solicitud de devolución creada para ${createdReturns.length} producto(s).`,
      returns: createdReturns,
    });
  } catch (error) {
    console.error('Error al solicitar devolución:', error.response?.data || error.message);
    if (error.response?.status === 404) {
      return res.status(404).json({ ok: false, message: 'La orden no existe en Mastershop.' });
    }
    return res.status(500).json({
      ok: false,
      message: 'No fue posible procesar la solicitud de devolución.',
    });
  }
};

// ==========================================
// Completar devoluciones cuando la orden se marca como DEVUELTA en Mastershop (id_status 10)
// ==========================================
export const completeReturnsForOrder = async (mastershopOrderId, mastershopData) => {
  try {
    if (!mastershopOrderId) return 0;

    const order = await resolveOrder(mastershopOrderId);
    if (!order) return 0;

    const { rows } = await pool.query(
      `SELECT * FROM returns
       WHERE (order_id = $1 OR order_ref = $2)
         AND status != $3
       ORDER BY id DESC`,
      [order.id, String(mastershopOrderId), RETURN_STATUS.COMPLETED]
    );

    if (rows.length === 0) return 0;

    let completed = 0;
    for (const ret of rows) {
      await pool.query(
        `UPDATE returns SET status = $2, mastershop_status = $3,
           payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{returned}', $4::jsonb),
           updated_at = NOW()
         WHERE id = $1`,
        [ret.id, RETURN_STATUS.COMPLETED, 'RETURNED', JSON.stringify(mastershopData || {})]
      );

      const quantity = toInt(ret.quantity, { min: 1, fallback: 1 });
      let stockUpdated = 0;
      if (ret.product_id) {
        const stockRes = await pool.query(
          `UPDATE produc SET stock_total = stock_total + $1, updated_at = NOW() WHERE id = $2`,
          [quantity, ret.product_id]
        );
        stockUpdated = stockRes.rowCount || 0;
      } else if (ret.product_sku) {
        const prod = await resolveProductBySku(ret.tienda_id, ret.product_sku);
        if (prod) {
          const stockRes = await pool.query(
            `UPDATE produc SET stock_total = stock_total + $1, updated_at = NOW() WHERE id = $2`,
            [quantity, prod.id]
          );
          stockUpdated = stockRes.rowCount || 0;
        }
      }
      completed += 1;
      console.log(`[Returns] Orden ${mastershopOrderId} devuelta: ticket ${ret.return_number} completado, stock restituido: ${stockUpdated}`);
    }

    return completed;
  } catch (error) {
    console.error('[Returns] Error completando devoluciones:', error.message);
    return 0;
  }
};

// ==========================================
// POST /webhooks/mastershop/reverse-logistics
// ==========================================
export const reverseLogisticsWebhook = async (req, res) => {
  try {
    const data = req.body?.data || req.body;
    const status = cleanString(
      data?.status ?? data?.return_status ?? data?.id_status ?? data?.reverse_status,
      { maxLength: 60 }
    );
    const returnNumber = cleanString(
      data?.return_number ?? data?.returns_number ?? data?.reference,
      { maxLength: 40 }
    );
    const orderRef = cleanString(
      data?.order_id ?? data?.id_order ?? data?.order_ref ?? data?.order_number,
      { maxLength: 100 }
    );
    const tracking = cleanString(
      data?.tracking_code ?? data?.tracking ?? data?.guide,
      { maxLength: 200 }
    );

    console.log(`[Returns Webhook] Estado: ${status} | Return: ${returnNumber} | Orden: ${orderRef}`);

    // Localizamos el ticket de devolución por número de retorno, orden o tracking
    let params = [];
    let where = '';
    if (returnNumber) {
      params.push(returnNumber);
      where = `return_number = $${params.length}`;
    } else if (orderRef) {
      params.push(String(orderRef), String(orderRef), String(orderRef));
      where = `(order_ref = $${params.length - 2} OR order_id::text = $${params.length - 1} OR payload->>'orderHash' = $${params.length})`;
    } else if (tracking) {
      params.push(tracking);
      where = `mastershop_tracking = $${params.length}`;
    } else {
      return res.status(400).json({ ok: false, message: 'No se pudo identificar la devolución en el webhook.' });
    }

    const { rows } = await pool.query(`SELECT * FROM returns WHERE ${where} ORDER BY id DESC LIMIT 1`, params);
    const returnRecord = rows[0];

    if (!returnRecord) {
      return res.status(404).json({ ok: false, message: 'Devolución no encontrada para este webhook.' });
    }

    const updates = [`updated_at = NOW()`];
    const updParams = [];
    if (status) {
      updParams.push(status);
      updates.push(`mastershop_status = $${updParams.length}`);
    }
    if (tracking) {
      updParams.push(tracking);
      updates.push(`mastershop_tracking = $${updParams.length}`);
    }
    updParams.push(JSON.stringify(data));
    updates.push(`payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{reverse_webhook}', $${updParams.length}::jsonb)`);

    // Si el paquete llegó a bodega → RETURN_COMPLETED + incrementar stock
    if (status && status.toUpperCase().includes(WAREHOUSE_RECEIVED_STATUS)) {
      updParams.push(RETURN_STATUS.COMPLETED);
      updates.push(`status = $${updParams.length}`);

      await pool.query(`UPDATE returns SET ${updates.join(', ')} WHERE id = $1`, [...updParams, returnRecord.id]);

      const quantity = toInt(returnRecord.quantity, { min: 1, fallback: 1 });
      let stockUpdated = 0;
      if (returnRecord.product_id) {
        const stockRes = await pool.query(
          `UPDATE produc SET stock_total = stock_total + $1, updated_at = NOW() WHERE id = $2`,
          [quantity, returnRecord.product_id]
        );
        stockUpdated = stockRes.rowCount || 0;
      } else if (returnRecord.product_sku) {
        const prod = await resolveProductBySku(returnRecord.tienda_id, returnRecord.product_sku);
        if (prod) {
          const stockRes = await pool.query(
            `UPDATE produc SET stock_total = stock_total + $1, updated_at = NOW() WHERE id = $2`,
            [quantity, prod.id]
          );
          stockUpdated = stockRes.rowCount || 0;
        }
      }

      return res.json({
        ok: true,
        message: 'Devolución completada y stock restituido.',
        return: { ...returnRecord, status: RETURN_STATUS.COMPLETED },
        stock_restored: stockUpdated,
      });
    }

    // Otros estados (recogida, en tránsito, etc.) solo actualizan el ticket
    await pool.query(`UPDATE returns SET ${updates.join(', ')} WHERE id = $1`, [...updParams, returnRecord.id]);
    return res.json({ ok: true, message: 'Webhook de logística inversa procesado.', return: returnRecord });
  } catch (error) {
    console.error('Error procesando webhook de logística inversa:', error.response?.data || error.message);
    return res.status(500).json({ ok: false, message: 'Error procesando webhook de logística inversa.' });
  }
};

// ==========================================
// GET /api/returns (listado de devoluciones del usuario)
// ==========================================
export const listReturns = async (req, res) => {
  try {
    const userId = req.auth?.userId || null;
    const { rows } = await pool.query(
      `SELECT r.id, r.return_number, r.order_id, r.order_ref, r.product_sku, r.quantity,
              r.reason, r.customer_notes, r.status, r.mastershop_status, r.mastershop_tracking,
              r.created_at, r.updated_at,
              p.name AS product_name, p.public_id,
              p.images AS product_images,
              o.order_hash, o.created_at AS order_created_at
       FROM returns r
       LEFT JOIN orders o ON o.id = r.order_id
       LEFT JOIN produc p ON p.id = r.product_id
       WHERE $1::bigint IS NULL OR o.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );
    return res.json({ ok: true, returns: rows });
  } catch (error) {
    console.error('Error listando devoluciones:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible listar las devoluciones.' });
  }
};

// ==========================================
// GET /api/returns/:orderId (consulta estado de devolución)
// ==========================================
export const getReturnByOrder = async (req, res) => {
  try {
    const orderId = cleanString(req.params.orderId, { maxLength: 100 });
    if (!orderId) {
      return res.status(400).json({ ok: false, message: 'orderId inválido.' });
    }
    const { rows } = await pool.query(
      `SELECT id, return_number, order_ref, product_sku, reason, status, mastershop_status, mastershop_tracking, created_at, updated_at
       FROM returns
       WHERE order_ref = $1 OR order_id::text = $1
       ORDER BY id DESC`,
      [orderId]
    );
    return res.json({ ok: true, returns: rows });
  } catch (error) {
    console.error('Error consultando devoluciones:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible consultar la devolución.' });
  }
};
