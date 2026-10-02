// TikTok Events API (server-side). Envía conversiones desde el backend usando el
// Pixel ID y el Access Token de la tienda (configurados en el panel), con
// respaldo en variables de entorno. Datos personales hasheados (SHA-256).
//
// Docs: POST https://business-api.tiktok.com/open_api/v1.3/event/track/

import crypto from 'node:crypto';
import { pool } from '../db.js';
import { decryptSecret } from '../utils/crypto.js';

const ENDPOINT = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

const sha256 = (value) =>
  crypto.createHash('sha256').update(String(value ?? '').trim().toLowerCase()).digest('hex');

const sha256Phone = (value) =>
  crypto.createHash('sha256').update(String(value ?? '').replace(/[^0-9]/g, '')).digest('hex');

// Resuelve pixel + token: tienda del pedido → tienda principal → entorno.
const getPixelConfig = async (tiendaId = null) => {
  const ids = [];
  if (tiendaId) ids.push(tiendaId);
  const { rows: main } = await pool.query('SELECT usrid FROM tiendas WHERE is_main = true LIMIT 1');
  if (main[0]?.usrid && !ids.includes(main[0].usrid)) ids.push(main[0].usrid);

  for (const id of ids) {
    const { rows } = await pool.query(
      'SELECT tiktok_pixel_id, tiktok_access_token FROM tiendas WHERE usrid = $1 LIMIT 1',
      [id]
    );
    const r = rows[0];
    if (r?.tiktok_pixel_id && r?.tiktok_access_token) {
      return { pixelId: r.tiktok_pixel_id, token: decryptSecret(r.tiktok_access_token), source: 'db' };
    }
  }
  if (process.env.TIKTOK_PIXEL_ID && process.env.TIKTOK_ACCESS_TOKEN) {
    return { pixelId: process.env.TIKTOK_PIXEL_ID, token: process.env.TIKTOK_ACCESS_TOKEN, source: 'env' };
  }
  return null;
};

const postEvent = async ({ pixelId, token, data }) => {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_source: 'web', event_source_id: pixelId, data }),
    signal: AbortSignal.timeout(8000),
  });
  const json = await res.json().catch(() => ({}));
  return { httpStatus: res.status, json, ok: res.ok && json?.code === 0 };
};

// Envía el evento de compra (CompletePayment). Idempotente por pedido.
export const sendTikTokPurchase = async ({
  userId = null,
  guestHash = null,
  tiendaId = null,
  orderId = null,
  orderNumber = null,
  orderHash = null,
  value = 0,
  currency = 'COP',
  items = [],
  phone = null,
  eventTime = null,
} = {}) => {
  try {
    const cfg = await getPixelConfig(tiendaId);
    if (!cfg) return { skipped: true, reason: 'sin pixel/token configurado' };

    const eventId = `purchase_${orderHash || orderId || Date.now()}`;
    const { rows: reg } = await pool.query(
      `INSERT INTO tiktok_events (event_id, event_name, user_id, tienda_id, pixel_id)
       VALUES ($1, 'CompletePayment', $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING id`,
      [eventId, userId, tiendaId, cfg.pixelId]
    );
    if (!reg[0]) return { skipped: true, reason: 'ya enviado' };
    const recordId = reg[0].id;

    let email = null;
    let userPhone = phone;
    if (userId) {
      const { rows: u } = await pool.query('SELECT email, phone FROM users WHERE id = $1 LIMIT 1', [userId]);
      email = u[0]?.email || null;
      userPhone = userPhone || u[0]?.phone || null;
    }

    const user = { external_id: sha256(userId || guestHash || orderHash || eventId) };
    if (email) user.email = sha256(email);
    if (userPhone) user.phone = sha256Phone(userPhone);

    const data = [
      {
        event: 'CompletePayment',
        event_time: eventTime || Math.floor(Date.now() / 1000),
        event_id: eventId,
        user,
        properties: {
          value: Number(value || 0),
          currency: String(currency || 'COP').toUpperCase(),
          content_type: 'product',
          order_id: String(orderNumber || orderId || ''),
          contents: (items || []).map((i) => ({
            content_id: String(i.external_id || i.id || ''),
            content_name: i.name || '',
            quantity: Number(i.quantity || 1),
            price: Number(i.price || 0),
          })),
        },
      },
    ];

    const { httpStatus, json, ok } = await postEvent({ pixelId: cfg.pixelId, token: cfg.token, data });

    await pool.query(
      `UPDATE tiktok_events SET status = $2, http_status = $3, response = $4::jsonb, sent_at = now() WHERE id = $1`,
      [recordId, ok ? 'sent' : 'error', httpStatus, JSON.stringify(json)]
    ).catch(() => {});

    if (!ok) console.error('[tiktok-events] respondió con error:', httpStatus, json?.message || json);
    return { ok, response: json };
  } catch (error) {
    console.error('[tiktok-events] error al enviar:', error.message);
    return { ok: false, error: error.message };
  }
};
