import { pool } from '../db.js';
import { cleanString, cleanEmail, toInt, isAllowedEnum } from '../utils/validation.js';
import { approveUsdActivation } from '../services/tienda.service.js';
import {
  getCheckoutIntegrationsForUser,
  saveCheckoutIntegrationForUser,
  deleteCheckoutIntegrationForUser,
} from '../services/tienda.service.js';
import { redisClient } from '../services/redis.service.js';
import { getOAuthStatus, saveOAuthConfig } from '../services/oauthConfig.service.js';
import { getStoreEnviaCredentials, getEnviaTracking } from '../services/envia.service.js';
import { createNotification as createUserNotification } from '../services/notifications.service.js';
import { sendPushToUser } from '../services/push.service.js';

const AUTH_PROVIDERS = ['google', 'discord', 'tiktok'];

// Notifica al usuario que ya puede vender (centro de notificaciones + push).
const notifySellerEnabled = async (userId) => {
  if (!userId) return;
  const title = '¡Ya puedes vender en Glopsy!';
  const message = 'Tu cuenta fue habilitada como vendedor. Entra a crear tu tienda.';
  try {
    await createUserNotification({
      type: 'link',
      title,
      message,
      url: '/vender',
      target: 'user',
      userId,
      active: true,
    });
  } catch (e) {
    console.error('[admin] No se pudo crear la notificación de vendedor:', e.message);
  }
  try {
    await sendPushToUser(userId, { title, body: message, url: '/vender' });
  } catch {}
};

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// GET /api/admin/sellers?q=&limit= -> usuarios con su estado de vendedor y tienda.
export const listUsersForAdmin = async (req, res) => {
  try {
    const q = cleanString(req.query.q, { maxLength: 120 });
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const values = [limit];
    let where = '';
    if (q) {
      values.push(`%${q}%`);
      where = `WHERE (u.email ILIKE $${values.length} OR u.name ILIKE $${values.length})`;
    }
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.name, u.avatar_url, u.can_sell, u.created_at,
              t.nombres AS store_name, COALESCE(t.activa, false) AS store_active
       FROM users u
       LEFT JOIN tiendas t ON t.usrid = u.id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $1`,
      values
    );
    return res.json({ ok: true, users: rows });
  } catch (error) {
    console.error('Error listando usuarios para admin:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible listar los usuarios.' });
  }
};

// GET /api/admin/seller-requests?status=pending -> solicitudes de venta.
export const listSellerRequests = async (req, res) => {
  try {
    const status = isAllowedEnum(req.query.status, ['pending', 'approved', 'rejected', 'none'])
      ? req.query.status
      : 'pending';
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.name, u.avatar_url, COALESCE(u.sell_status, 'none') AS sell_status,
              u.sell_requested_at, u.sell_reviewed_at, u.sell_note, u.can_sell, u.created_at
       FROM users u
       WHERE COALESCE(u.sell_status, 'none') = $1
       ORDER BY u.sell_requested_at ASC NULLS LAST, u.created_at DESC
       LIMIT 200`,
      [status]
    );
    return res.json({ ok: true, requests: rows });
  } catch (error) {
    console.error('Error listando solicitudes de vendedor:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible listar las solicitudes.' });
  }
};

// POST /api/admin/seller-requests/review { userId, approve, note }
export const reviewSellerRequest = async (req, res) => {
  try {
    const userId = toInt(req.body?.userId, { min: 1 });
    if (!userId) return res.status(400).json({ ok: false, message: 'userId requerido.' });
    const approve = req.body?.approve === true;
    const note = cleanString(req.body?.note, { maxLength: 500 }) || null;
    const { rows } = await pool.query(
      `UPDATE users
       SET can_sell = $2, sell_status = $3, sell_reviewed_at = NOW(),
           sell_note = COALESCE($4, sell_note), updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, can_sell, sell_status`,
      [userId, approve, approve ? 'approved' : 'rejected', note]
    );
    if (!rows[0]) return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    if (!approve) {
      await pool.query(`UPDATE tiendas SET activa = false WHERE usrid = $1`, [userId]);
    } else {
      await notifySellerEnabled(rows[0].id);
    }
    return res.json({ ok: true, user: rows[0] });
  } catch (error) {
    console.error('Error revisando solicitud de vendedor:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible procesar la solicitud.' });
  }
};

// --- Integraciones de pago/checkout (gestión centralizada por admin) ---

// GET /api/admin/stores -> tiendas para el selector.
export const listStoresForAdmin = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT usrid, nombres, slug, COALESCE(activa, false) AS activa FROM tiendas ORDER BY usrid ASC`
    );
    return res.json({ ok: true, stores: rows });
  } catch (error) {
    console.error('Error listando tiendas para admin:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible listar las tiendas.' });
  }
};

// GET /api/admin/stores/:tiendaId/checkout-integrations
export const getStoreCheckoutIntegrations = async (req, res) => {
  try {
    const tiendaId = toInt(req.params.tiendaId, { min: 1 });
    if (!tiendaId) return res.status(400).json({ ok: false, message: 'tiendaId inválido.' });
    const integrations = await getCheckoutIntegrationsForUser(tiendaId);
    return res.json({ ok: true, integrations });
  } catch (error) {
    console.error('Error consultando integraciones de la tienda:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible consultar las integraciones.' });
  }
};

// POST /api/admin/stores/:tiendaId/checkout-integrations { provider, mode, public_key, access_token, webhook_secret, is_default }
export const saveStoreCheckoutIntegration = async (req, res) => {
  try {
    const tiendaId = toInt(req.params.tiendaId, { min: 1 });
    if (!tiendaId) return res.status(400).json({ ok: false, message: 'tiendaId inválido.' });
    const provider = cleanString(req.body?.provider, { maxLength: 50 });
    if (!isAllowedEnum(provider, ['mercadopago', 'envia', 'bold'])) {
      return res.status(400).json({ ok: false, message: 'Proveedor no válido.' });
    }
    const mode = isAllowedEnum(req.body?.mode, ['prueba', 'produccion']) ? req.body.mode : 'prueba';
    const strip = (v) => (v ? String(v).trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') : '');
    const publicKey = strip(cleanString(req.body?.public_key, { maxLength: 2048 }));
    const accessToken = strip(cleanString(req.body?.access_token, { maxLength: 2048 }));
    const webhookSecret = strip(cleanString(req.body?.webhook_secret, { maxLength: 2048 }));

    if (provider === 'mercadopago' && !publicKey) {
      return res.status(400).json({ ok: false, message: 'La Public Key es obligatoria para Mercado Pago.' });
    }
    if (provider === 'bold' && !publicKey) {
      return res.status(400).json({ ok: false, message: 'La Public Key es obligatoria para Bold.' });
    }

    const saved = await saveCheckoutIntegrationForUser(tiendaId, provider, mode, {
      publicKey: publicKey || undefined,
      accessToken: accessToken || undefined,
      webhookSecret: webhookSecret || undefined,
      isDefault: req.body?.is_default === true,
    });
    const provName = provider === 'mercadopago' ? 'Mercado Pago' : provider === 'bold' ? 'Bold' : 'ENVIA';
    return res.json({ ok: true, integration: saved, message: `${provName} guardado.` });
  } catch (error) {
    console.error('Error guardando integración (admin):', error.message);
    return res.status(500).json({ ok: false, message: error.message || 'No fue posible guardar la integración.' });
  }
};

// DELETE /api/admin/stores/:tiendaId/checkout-integrations/:provider?mode=
export const deleteStoreCheckoutIntegration = async (req, res) => {
  try {
    const tiendaId = toInt(req.params.tiendaId, { min: 1 });
    const provider = cleanString(req.params.provider, { maxLength: 50 });
    const mode = isAllowedEnum(req.query.mode, ['prueba', 'produccion']) ? req.query.mode : 'prueba';
    if (!tiendaId || !isAllowedEnum(provider, ['mercadopago', 'envia', 'bold'])) {
      return res.status(400).json({ ok: false, message: 'Parámetros inválidos.' });
    }
    const deleted = await deleteCheckoutIntegrationForUser(tiendaId, provider, mode);
    if (!deleted) return res.status(404).json({ ok: false, message: 'Integración no encontrada.' });
    return res.json({ ok: true, message: 'Integración eliminada.' });
  } catch (error) {
    console.error('Error eliminando integración (admin):', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible eliminar la integración.' });
  }
};

// --- Kill switch (pánico) ---
export const getPanicStatus = async (req, res) => {
  try {
    const on = await redisClient.get('system:panic');
    return res.json({ ok: true, panic: on === '1' });
  } catch (error) {
    console.error('Error consultando pánico:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible consultar el estado.' });
  }
};

export const setPanicStatus = async (req, res) => {
  try {
    const on = req.body?.on === true || req.body?.on === 'true';
    await redisClient.set('system:panic', on ? '1' : '0');
    return res.json({ ok: true, panic: on, message: on ? 'API en mantenimiento (pánico ON).' : 'API activa (pánico OFF).' });
  } catch (error) {
    console.error('Error cambiando pánico:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible cambiar el estado.' });
  }
};

// --- Auth (Google / Discord / TikTok OAuth) ---
export const getAuthConfig = async (req, res) => {
  try {
    const provider = String(req.params.provider || '').toLowerCase();
    if (!AUTH_PROVIDERS.includes(provider)) return res.status(400).json({ ok: false, message: 'Proveedor no válido.' });
    return res.json({ ok: true, auth: await getOAuthStatus(provider) });
  } catch (error) {
    console.error('Error consultando auth:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible consultar la configuración.' });
  }
};

export const saveAuthConfig = async (req, res) => {
  try {
    const provider = String(req.params.provider || '').toLowerCase();
    if (!AUTH_PROVIDERS.includes(provider)) return res.status(400).json({ ok: false, message: 'Proveedor no válido.' });
    const { client_id, client_secret, redirect_uri, scopes, enabled } = req.body || {};
    const auth = await saveOAuthConfig(provider, {
      clientId: client_id,
      clientSecret: client_secret,
      redirectUri: redirect_uri,
      scopes,
      enabled,
    });
    return res.json({ ok: true, auth, message: 'Configuración de auth guardada.' });
  } catch (error) {
    console.error('Error guardando auth:', error.message);
    return res.status(500).json({ ok: false, message: error.message || 'No fue posible guardar.' });
  }
};

// --- Rastreo de guías (ENVIA) ---
const resolveStoreId = async (storeId) => {
  const sid = toInt(storeId, { min: 1 });
  if (sid) return sid;
  const { rows } = await pool.query(
    `SELECT usrid FROM tiendas WHERE is_main = true AND COALESCE(activa, true) = true LIMIT 1`
  );
  if (rows[0]) return rows[0].usrid;
  const { rows: fb } = await pool.query(
    `SELECT usrid FROM tiendas WHERE COALESCE(activa, true) = true ORDER BY usrid ASC LIMIT 1`
  );
  return fb[0]?.usrid || null;
};

// POST /api/admin/tracking { tracking|trackingNumbers, storeId? }
export const trackEnvia = async (req, res) => {
  try {
    const raw = req.body?.trackingNumbers ?? req.body?.tracking;
    const nums = (Array.isArray(raw) ? raw : String(raw || '').split(/[\s,]+/))
      .map((s) => String(s).trim())
      .filter(Boolean);
    if (nums.length === 0) {
      return res.status(400).json({ ok: false, message: 'Ingresa al menos una guía.' });
    }
    const storeId = await resolveStoreId(req.body?.storeId);
    const creds = await getStoreEnviaCredentials(storeId);
    if (!creds?.accessToken) {
      return res.status(400).json({ ok: false, message: 'La tienda no tiene ENVIA configurado.' });
    }
    const tracking = await getEnviaTracking({
      accessToken: creds.accessToken,
      mode: creds.mode,
      trackingNumbers: nums,
    });
    return res.json({ ok: true, tracking, storeId });
  } catch (error) {
    console.error('Error rastreando guías:', error.response?.data || error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible rastrear la(s) guía(s).' });
  }
};

// POST /api/admin/sellers/set { email, can_sell }
export const setUserCanSell = async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email, { required: true });
    const canSell = req.body?.can_sell === true;
    if (!email) {
      return res.status(400).json({ ok: false, message: 'Correo inválido.' });
    }
    const { rows } = await pool.query(
      `UPDATE users SET can_sell = $2, updated_at = NOW() WHERE email = $1 RETURNING id, email, can_sell`,
      [email, canSell]
    );
    if (!rows[0]) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }
    // Al deshabilitar al vendedor, su tienda deja de estar activa (no sigue vendiendo).
    let storeActive = null;
    if (!canSell) {
      const { rows: tRows } = await pool.query(
        `UPDATE tiendas SET activa = false WHERE usrid = $1 RETURNING activa`,
        [rows[0].id]
      );
      storeActive = tRows[0] ? Boolean(tRows[0].activa) : null;
    } else {
      await notifySellerEnabled(rows[0].id);
    }
    return res.json({ ok: true, user: rows[0], storeActive });
  } catch (error) {
    console.error('Error actualizando can_sell:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible actualizar el usuario.' });
  }
};

// GET /api/admin/commissions -> regla global + comisión por categoría.
export const listCommissions = async (req, res) => {
  try {
    const { rows: globalRows } = await pool.query(
      `SELECT id, porcentaje, activo
       FROM commission_rules
       WHERE scope = 'global' AND scope_id IS NULL AND tienda_id IS NULL
       ORDER BY id LIMIT 1`
    );
    const { rows } = await pool.query(
      `SELECT c.id, c.nombre,
              r.id AS rule_id, r.porcentaje, r.activo
       FROM categorias c
       LEFT JOIN commission_rules r
         ON r.scope = 'categoria' AND r.scope_id = c.id AND r.tienda_id IS NULL
       WHERE c.tienda_id IS NULL
       ORDER BY c.nombre`
    );
    const g = globalRows[0];
    return res.json({
      ok: true,
      global: g
        ? { id: g.id, porcentaje: Number(g.porcentaje), activo: g.activo === true }
        : { id: null, porcentaje: null, activo: true },
      categorias: rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        ruleId: r.rule_id || null,
        porcentaje: r.porcentaje != null ? Number(r.porcentaje) : null,
        activo: r.activo === true,
      })),
    });
  } catch (error) {
    console.error('Error listando comisiones:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible listar las comisiones.' });
  }
};

// POST /api/admin/commissions { scope, scope_id?, porcentaje, activo? }
export const saveCommission = async (req, res) => {
  try {
    const scope = cleanString(req.body?.scope, { maxLength: 20 });
    if (!isAllowedEnum(scope, ['global', 'categoria', 'producto'])) {
      return res.status(400).json({ ok: false, message: 'Alcance no válido.' });
    }
    const porcentaje = Number(req.body?.porcentaje);
    if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      return res.status(400).json({ ok: false, message: 'El porcentaje debe estar entre 0 y 100.' });
    }
    const activo = req.body?.activo !== false;
    const scopeId = scope === 'global' ? null : toInt(req.body?.scope_id, { min: 1 });
    if (scope !== 'global' && !scopeId) {
      return res.status(400).json({ ok: false, message: 'Falta el elemento al que aplica la comisión.' });
    }
    if (scope === 'categoria') {
      const { rows: cat } = await pool.query(
        `SELECT 1 FROM categorias WHERE id = $1 AND tienda_id IS NULL LIMIT 1`,
        [scopeId]
      );
      if (!cat[0]) return res.status(404).json({ ok: false, message: 'Categoría no encontrada.' });
    }
    const { rows } = await pool.query(
      `INSERT INTO commission_rules (scope, scope_id, tienda_id, porcentaje, activo)
       VALUES ($1, $2, NULL, $3, $4)
       ON CONFLICT (scope, COALESCE(scope_id, 0), COALESCE(tienda_id, 0))
       DO UPDATE SET porcentaje = EXCLUDED.porcentaje, activo = EXCLUDED.activo, updated_at = NOW()
       RETURNING id, scope, scope_id, porcentaje, activo`,
      [scope, scopeId, round2(porcentaje), activo]
    );
    await redisClient.del('categorias').catch(() => {});
    return res.json({ ok: true, rule: { ...rows[0], porcentaje: Number(rows[0].porcentaje) } });
  } catch (error) {
    console.error('Error guardando comisión:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible guardar la comisión.' });
  }
};

// DELETE /api/admin/commissions/:id
export const deleteCommission = async (req, res) => {
  try {
    const id = toInt(req.params.id, { min: 1 });
    if (!id) return res.status(400).json({ ok: false, message: 'Id inválido.' });
    const { rowCount } = await pool.query(`DELETE FROM commission_rules WHERE id = $1`, [id]);
    if (!rowCount) return res.status(404).json({ ok: false, message: 'Regla no encontrada.' });
    await redisClient.del('categorias').catch(() => {});
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error eliminando comisión:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible eliminar la comisión.' });
  }
};

// POST /api/admin/sellers/usd-activation { email, approve } -> activa (o rechaza) la tienda en USD.
export const setUsdActivation = async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email, { required: true });
    if (!email) return res.status(400).json({ ok: false, message: 'Correo inválido.' });
    const { rows } = await pool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
    if (!rows[0]) return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    const result = await approveUsdActivation(rows[0].id, req.body?.approve !== false);
    return res.json({ ok: true, result });
  } catch (error) {
    console.error('Error actualizando activación USD:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible actualizar la activación USD.' });
  }
};
