import { pool } from '../db.js';
import { redisClient } from './redis.service.js';
import { encryptSecret, decryptSecret, maskSecret, isEncryptedSecret } from '../utils/crypto.js';
import { registerStoreCustomDomain, removeStoreCustomDomain } from './cloudflare.service.js';

const CACHE_TTL_SECONDS = 60;
const cacheKey = (userId) => `tienda:${userId}`;

const mapTienda = (row) => ({
  id: row.hashid,
  name: row.nombres,
  slug: row.slug || null,
  imageUrl: row.avatar,
  isActive: row.activa,
  gaId: row.ga_id || null,
  registeredAt: row.fechareg,
  // Tienda principal de la plataforma: aquí se configuran las pasarelas globales.
  isMain: row.is_main === true,
  paisCodigo: row.t_pais_codigo || null,
  // Multicountry: país y su config (moneda/locale/dominio raíz). Si la tienda
  // no tiene país, cae a la config por defecto (Colombia).
  paisId: row.t_pais_id ?? null,
  moneda: row.t_moneda || 'COP',
  locale: row.t_locale || 'es-CO',
  dominio_raiz: row.t_dominio || null,
  zoomOrigenCodciudad: row.t_zoom_origen ?? null,
  internationalDispatchProvider: row.t_international_dispatch_provider || null,
  // Apariencia de la vitrina (sub-tiendas).
  storefrontTemplate: row.storefront_template || 'dashboard',
  storefrontTheme: row.storefront_theme || 'auto',
  storefrontPalette: row.storefront_palette || 'fucsia',
  storefrontColor: row.storefront_color || null,
  storefrontBanner: row.storefront_banner || null,
  contactoEmail: row.contacto_email || null,
  contactoTelefono: row.contacto_telefono || null,
});

// ------------------------------------------------------------------ Subdominio (slug)
const RESERVED_SLUGS = new Set([
  'app', 'www', 'api', 'tienda', 'admin', 'panel', 'market',
  'marketing', 'listpr', 'catalogo', 'glopsy', 'glopsybot', 'auth', 'cart',
  'checkout', 'profile', 'favorites', 'terminos', 'privacidad', 'compras',
  'consultar-pedido', 'deep-link', 'product', 'products', 'home', 'search',
  'banners', 'notifications', 'webhooks', 'webhook', 'geo', 'stats', 'returns',
  'login', 'register', 'vender', 'publish', 'pago', 'pagos', 'mi-tienda',
  'micuenta', 'ayuda', 'faq', 'blog', 'legal', 'mail', 'smtp', 'support',
]);

export const normalizeStoreSlug = (input) =>
  String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);

export const isValidStoreSlug = (slug) => {
  const s = String(slug || '');
  return (
    s.length >= 2 &&
    s.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s) &&
    !RESERVED_SLUGS.has(s)
  );
};

const slugFromInput = (slug) => {
  if (slug === null || slug === undefined || String(slug).trim() === '') return null;
  const normalized = normalizeStoreSlug(slug);
  return isValidStoreSlug(normalized) ? normalized : null;
};

// Mensaje específico: distingue "reservado" de "formato inválido".
const slugErrorMessage = (slug) => {
  const normalized = normalizeStoreSlug(slug);
  const formatoOk = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized) && normalized.length >= 2;
  if (formatoOk && RESERVED_SLUGS.has(normalized)) {
    return `El subdominio "${normalized}" está reservado. Elige otro (ej: mi-tienda).`;
  }
  return 'Subdominio no válido. Usa solo minúsculas, números y guiones, entre 2 y 63 caracteres (ej: mi-tienda).';
};

// Incluye la config del país (moneda/locale/dominio) vía JOIN con aliases t_*.
// Requiere que la consulta use alias `t` para tiendas y `pa` para paises.
const STORE_COLUMNS = `
  t.hashid, t.nombres, t.slug, t.avatar, t.activa, t.fechareg, t.ga_id,
  t.is_main,
  t.pais_id AS t_pais_id,
  pa.codigo_iso AS t_pais_codigo,
  COALESCE(t.moneda, pa.moneda, 'COP') AS t_moneda,
  COALESCE(t.locale, pa.locale, 'es-CO') AS t_locale,
  COALESCE(t.dominio_raiz, pa.dominio_raiz) AS t_dominio,
  t.zoom_origen_codciudad AS t_zoom_origen,
  t.international_dispatch_provider AS t_international_dispatch_provider,
  t.storefront_template, t.storefront_theme, t.storefront_palette,
  t.storefront_color, t.storefront_banner,
  t.contacto_email, t.contacto_telefono
`;
const STORE_JOIN = `
  LEFT JOIN paises pa ON pa.id = t.pais_id
`;

export const getTiendaForUser = async (userId) => {
  const key = cacheKey(userId);
  const cached = await redisClient.get(key);

  if (cached) return JSON.parse(cached);

  const { rows } = await pool.query(
    `SELECT ${STORE_COLUMNS}
     FROM tiendas t
     ${STORE_JOIN}
     WHERE t.usrid = $1
     LIMIT 1`,
    [userId]
  );

  const tienda = rows[0] ? mapTienda(rows[0]) : null;
  await redisClient.set(key, JSON.stringify(tienda), { EX: CACHE_TTL_SECONDS });
  return tienda;
};

// Crea la tienda de un usuario si aún no existe (idempotente). Un mismo usuario
// siempre tiene UNA tienda; otro usuario crea la suya sin afectar las demás.
// name/slug/ga_id opcionales (slug = subdominio). Lanza error 409 si el slug está ocupado.
export const ensureTiendaForUser = async (userId, { name = '', slug = null, ga_id = null, pais_id = null, contacto_email = null, contacto_telefono = null } = {}) => {
  const uid = Number(userId);
  const storeName =
    String(name || '').trim().slice(0, 100) || `Tienda de Usuario ${uid}`;
  const storeSlug = slugFromInput(slug);
  const storeGa = ga_id === null || ga_id === undefined || String(ga_id).trim() === ''
    ? null
    : String(ga_id).trim().slice(0, 40);
  const storeContactoEmail = contacto_email ? String(contacto_email).trim().slice(0, 160) : null;
  const storeContactoTelefono = contacto_telefono ? String(contacto_telefono).trim().slice(0, 30) : null;

  // País de operación de la tienda (multicountry). Si no se indica, Colombia.
  let storePais = null;
  if (pais_id !== null && pais_id !== undefined && String(pais_id).trim() !== '') {
    const paisId = Number(pais_id);
    if (!Number.isInteger(paisId) || paisId <= 0) {
      const err = new Error('País no válido.');
      err.code = 400;
      throw err;
    }
    const { rows: pr } = await pool.query(`SELECT id FROM paises WHERE id = $1 LIMIT 1`, [paisId]);
    if (!pr[0]) {
      const err = new Error('País no válido.');
      err.code = 400;
      throw err;
    }
    storePais = paisId;
  } else {
    const { rows: co } = await pool.query(`SELECT id FROM paises WHERE codigo_iso = 'CO' LIMIT 1`);
    storePais = co[0]?.id ?? null;
  }

  if (slug !== null && slug !== undefined && String(slug).trim() !== '' && !storeSlug) {
    const err = new Error(slugErrorMessage(slug));
    err.code = 400;
    throw err;
  }

  if (storeSlug) {
    const { rows: taken } = await pool.query(`SELECT 1 FROM tiendas WHERE slug = $1 LIMIT 1`, [storeSlug]);
    if (taken.length) {
      const err = new Error('Ese subdominio ya está en uso. Elige otro.');
      err.code = 'DUPLICATE_SLUG';
      throw err;
    }
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO tiendas (usrid, nombres, slug, ga_id, pais_id, activa, contacto_email, contacto_telefono)
       VALUES ($1, $2, $3, $4, $5, false, $6, $7)
       ON CONFLICT (usrid) DO NOTHING
       RETURNING hashid`,
      [uid, storeName, storeSlug, storeGa, storePais, storeContactoEmail, storeContactoTelefono]
    );

    await redisClient.del(cacheKey(uid)).catch(() => {});

    if (rows[0]) {
      // Re-consulta para incluir la config del país (JOIN con paises).
      const tienda = await getTiendaForUser(uid);
      // Aprovisiona <slug>.<dominio_raiz del país> como dominio del worker (DNS+cert auto).
      if (tienda?.slug) {
        registerStoreCustomDomain(tienda.slug, tienda.dominio_raiz).catch(() => {});
      }
      return tienda;
    }
    return getTiendaForUser(uid);
  } catch (error) {
    if (error.code === '23505') {
      const err = new Error('Ese subdominio ya está en uso. Elige otro.');
      err.code = 'DUPLICATE_SLUG';
      throw err;
    }
    throw error;
  }
};

// Parsea un User-Agent a { browser, browserVersion, os, device } (heurística simple).
export const parseUserAgent = (ua = '') => {
  const s = String(ua || '');
  const browsers = [
    [/Edg\/?([\d.]+)/, 'Edge'],
    [/OPR\/?([\d.]+)|Opera[\/ ]([\d.]+)/, 'Opera'],
    [/SamsungBrowser\/?([\d.]+)/, 'Samsung Internet'],
    [/YaBrowser\/?([\d.]+)/, 'Yandex'],
    [/CriOS\/?([\d.]+)/, 'Chrome'],
    [/Chrome\/?([\d.]+)/, 'Chrome'],
    [/FxiOS\/?([\d.]+)/, 'Firefox'],
    [/Firefox\/?([\d.]+)/, 'Firefox'],
    [/MSIE ([\d.]+)|Trident\/.*rv:([\d.]+)/, 'Internet Explorer'],
    [/Version\/?([\d.]+).*Safari/, 'Safari'],
  ];
  let browser = null;
  let browserVersion = null;
  for (const [re, label] of browsers) {
    const m = s.match(re);
    if (m) {
      browser = label;
      browserVersion = m[1] || m[2] || null;
      break;
    }
  }
  let os = null;
  if (/Windows NT 10/.test(s)) os = 'Windows 10/11';
  else if (/Windows/.test(s)) os = 'Windows';
  else if (/Android/.test(s)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(s)) os = 'iOS';
  else if (/Mac OS X/.test(s)) os = 'macOS';
  else if (/Linux/.test(s)) os = 'Linux';
  let device = 'desktop';
  if (/iPad|Tablet/.test(s)) device = 'tablet';
  else if (/Mobi|Android|iPhone/.test(s)) device = 'mobile';
  return { browser, browserVersion, os, device };
};

// Registra la aceptación de Términos y Condiciones (y Contrato de Mandato) al
// crear una tienda. Deja trazabilidad: usuario, IP, timestamp, navegador,
// dispositivo, país, idioma, coordenadas y metadata adicional.
export const recordTiendaTermsAcceptance = async ({
  userId,
  tiendaUsrid,
  termsVersion,
  ip,
  forwardedFor,
  userAgent,
  language,
  timezone,
  country,
  latitude,
  longitude,
  referrer,
  metadata,
} = {}) => {
  const uid = Number(userId);
  if (!uid) {
    const err = new Error('userId requerido para registrar la aceptación.');
    err.code = 400;
    throw err;
  }
  const version = String(termsVersion || '').trim().slice(0, 30) || 'v1';
  const ua = userAgent ? String(userAgent).slice(0, 2000) : null;
  const parsed = parseUserAgent(ua || '');
  const latNum = Number(latitude);
  const lonNum = Number(longitude);
  const lat = Number.isFinite(latNum) ? latNum : null;
  const lon = Number.isFinite(lonNum) ? lonNum : null;
  const usrid = Number(tiendaUsrid) || uid;

  const { rows } = await pool.query(
    `INSERT INTO tienda_aceptaciones (
       tienda_usrid, user_id, terms_version, accepted, ip, forwarded_for,
       user_agent, browser, browser_version, os, device, language, timezone,
       country, latitude, longitude, referrer, metadata
     ) VALUES ($1,$2,$3,true,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING id, accepted_at`,
    [
      usrid,
      uid,
      version,
      ip ? String(ip).slice(0, 64) : null,
      forwardedFor ? String(forwardedFor).slice(0, 500) : null,
      ua,
      parsed.browser,
      parsed.browserVersion,
      parsed.os,
      parsed.device,
      language ? String(language).slice(0, 60) : null,
      timezone ? String(timezone).slice(0, 60) : null,
      country ? String(country).slice(0, 2).toUpperCase() : null,
      lat,
      lon,
      referrer ? String(referrer).slice(0, 500) : null,
      metadata && typeof metadata === 'object' ? JSON.stringify(metadata) : '{}',
    ]
  );

  await pool
    .query(
      `UPDATE tiendas SET terms_version = $2, terms_accepted_at = now() WHERE usrid = $1`,
      [usrid, version]
    )
    .catch(() => {});

  return { id: rows[0]?.id, acceptedAt: rows[0]?.accepted_at, version };
};

// Actualiza nombre/subdominio/GA de la tienda del usuario (valores null/undefined = no tocar;
// ga_id '' o null explícito limpia el GA de la tienda).
export const updateTiendaForUser = async (userId, { name = null, slug = null, ga_id = undefined, pais_id = undefined, zoom_origen_codciudad = undefined, international_dispatch_provider = undefined } = {}) => {
  const uid = Number(userId);
  const current = await getTiendaForUser(uid);
  if (!current) return null;
  const newName = name !== null && name !== undefined
    ? String(name).trim().slice(0, 100)
    : null;
  const wantsSlug = slug !== null && slug !== undefined && String(slug).trim() !== '';
  const storeSlug = wantsSlug ? slugFromInput(slug) : null;
  if (wantsSlug && !storeSlug) {
    const err = new Error(slugErrorMessage(slug));
    err.code = 400;
    throw err;
  }

  // El país de operación queda fijo desde el registro: no se puede cambiar.
  let newPaisId;
  if (pais_id !== undefined) {
    const target = pais_id === null ? null : Number(pais_id);
    if (pais_id !== null && (!Number.isInteger(target) || target <= 0)) {
      const err = new Error('País no válido.');
      err.code = 400;
      throw err;
    }
    if (target !== (current.paisId ?? null)) {
      const err = new Error('El país de operación no se puede cambiar después del registro de la tienda.');
      err.code = 400;
      throw err;
    }
    newPaisId = undefined; // mismo país: no se toca
  }

  // Origen de envíos ZOOM (Venezuela): null limpia, undefined no toca.
  let newZoomOrigen;
  if (zoom_origen_codciudad === null) {
    newZoomOrigen = null;
  } else if (zoom_origen_codciudad !== undefined) {
    const code = Number(zoom_origen_codciudad);
    if (!Number.isInteger(code) || code <= 0) {
      const err = new Error('Ciudad de origen ZOOM no válida.');
      err.code = 400;
      throw err;
    }
    newZoomOrigen = code;
  }

  if (storeSlug && storeSlug !== current.slug) {
    const { rows: taken } = await pool.query(`SELECT 1 FROM tiendas WHERE slug = $1 AND usrid <> $2 LIMIT 1`, [storeSlug, uid]);
    if (taken.length) {
      const err = new Error('Ese subdominio ya está en uso. Elige otro.');
      err.code = 'DUPLICATE_SLUG';
      throw err;
    }
  }

  try {
    const { rows } = await pool.query(
      `UPDATE tiendas SET
         nombres = COALESCE($1, nombres),
         slug = $2,
         pais_id = COALESCE($4, pais_id),
         zoom_origen_codciudad = COALESCE($5, zoom_origen_codciudad)
       WHERE usrid = $3
       RETURNING hashid`,
      [newName, wantsSlug ? storeSlug : current.slug, uid, newPaisId === undefined ? null : newPaisId, newZoomOrigen === undefined ? null : newZoomOrigen]
    );
    await redisClient.del(cacheKey(uid)).catch(() => {});
    if (rows[0]) {
      // Re-consulta para incluir config de país (JOIN con paises).
      const tienda = await getTiendaForUser(uid);
      // Re-registra el subdominio si cambió el slug o el dominio raíz (país).
      const slugChanged = tienda && tienda.slug !== current.slug;
      const rootChanged = tienda && tienda.dominio_raiz !== current.dominio_raiz;
      if (tienda && (slugChanged || rootChanged)) {
        if (current.slug) removeStoreCustomDomain(current.slug, current.dominio_raiz).catch(() => {});
        if (tienda.slug) registerStoreCustomDomain(tienda.slug, tienda.dominio_raiz).catch(() => {});
      }
    }

    // Google Analytics de la tienda (id definido => set/limpiar; undefined => no tocar).
    if (ga_id !== undefined) {
      const cleanGa = String(ga_id || '').trim().slice(0, 40) || null;
      await pool.query(`UPDATE tiendas SET ga_id = $1 WHERE usrid = $2`, [cleanGa, uid]);
      await redisClient.del(cacheKey(uid)).catch(() => {});
    }

    // Proveedor de despacho internacional (Venezuela). null lo limpia; undefined no toca.
    if (international_dispatch_provider !== undefined) {
      const cleanDispatch = international_dispatch_provider === null
        ? null
        : (['mastershop'].includes(international_dispatch_provider) ? international_dispatch_provider : null);
      await pool.query(`UPDATE tiendas SET international_dispatch_provider = $1 WHERE usrid = $2`, [cleanDispatch, uid]);
      await redisClient.del(cacheKey(uid)).catch(() => {});
    }

    return getTiendaForUser(uid);
  } catch (error) {
    if (error.code === '23505') {
      const err = new Error('Ese subdominio ya está en uso. Elige otro.');
      err.code = 'DUPLICATE_SLUG';
      throw err;
    }
    throw error;
  }
};

// Una tienda nueva nace inactiva. Solo puede "darse de alta" si ya configuró su
// cuenta bancaria de pagos (las pasarelas MP/Bold/ENVIA son globales de la plataforma).
export const getProductionIntegrationsForUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT banco_codigo, tipo_cuenta, numero_cuenta, titular_cuenta
     FROM tiendas WHERE usrid = $1 LIMIT 1`,
    [userId]
  );
  const a = rows[0] || {};
  const missing = [];
  if (!a.banco_codigo || !a.tipo_cuenta || !a.numero_cuenta || !a.titular_cuenta) {
    missing.push('Cuenta de pagos (banco, tipo, número y titular)');
  }
  return { ok: missing.length === 0, missing };
};

// Info pública de una tienda para servir su subdominio/vitrina (solo tiendas activas).
export const getPublicStoreBySlug = async (slug) => {
  const cleanSlug = normalizeStoreSlug(slug);
  if (!cleanSlug) return null;
  const { rows } = await pool.query(
    `SELECT ${STORE_COLUMNS}
     FROM tiendas t
     ${STORE_JOIN}
     WHERE t.slug = $1 AND COALESCE(t.activa, true) = true
     LIMIT 1`,
    [cleanSlug]
  );
  return rows[0] ? mapTienda(rows[0]) : null;
};

// Tienda principal (la que se sirve en app.glopsy.shop). Sin slug obligatorio.
export const getMainStore = async () => {
  const { rows } = await pool.query(
    `SELECT ${STORE_COLUMNS}
     FROM tiendas t
     ${STORE_JOIN}
     WHERE t.is_main = true AND COALESCE(t.activa, true) = true
     LIMIT 1`
  );
  if (rows[0]) return mapTienda(rows[0]);
  // Compatibilidad: si aún no hay marcada, se usa la tienda más antigua.
  const { rows: fallback } = await pool.query(
    `SELECT ${STORE_COLUMNS}
     FROM tiendas t
     ${STORE_JOIN}
     WHERE COALESCE(t.activa, true) = true
     ORDER BY t.usrid ASC LIMIT 1`
  );
  return fallback[0] ? mapTienda(fallback[0]) : null;
};

export const updateTiendaStatus = async (userId, isActive) => {
  const { rows } = await pool.query(
    `UPDATE tiendas
     SET activa = $1
     WHERE usrid = $2
     RETURNING hashid, nombres, avatar, activa, fechareg`,
    [isActive, userId]
  );

  if (!rows[0]) return null;

  const tienda = mapTienda(rows[0]);
  await redisClient.set(cacheKey(userId), JSON.stringify(tienda), { EX: CACHE_TTL_SECONDS });
  return tienda;
};

export const getDianConfigForUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT sw_id, sw_pin, technical_key, prefix, test_set_id,
            numero_resolucion, resolucion_fecha_desde, resolucion_fecha_hasta,
            direccion_fiscal, regimen, responsabilidad
     FROM tienda_dian
     WHERE tienda_id = $1
     LIMIT 1`,
    [userId]
  );
  return rows[0] || {
    sw_id: '', sw_pin: '', technical_key: '', prefix: '', test_set_id: '',
    numero_resolucion: '', resolucion_fecha_desde: null, resolucion_fecha_hasta: null,
    direccion_fiscal: '', regimen: '', responsabilidad: '',
  };
};

// Datos fiscales de la plantilla DIAN (resolución, vigencia, dirección, régimen).
export const saveDianFiscalForUser = async (userId, data) => {
  const {
    numero_resolucion, resolucion_fecha_desde, resolucion_fecha_hasta,
    direccion_fiscal, regimen, responsabilidad,
  } = data;
  const { rows } = await pool.query(
    `INSERT INTO tienda_dian (
       tienda_id, sw_id, sw_pin, technical_key, prefix, test_set_id,
       numero_resolucion, resolucion_fecha_desde, resolucion_fecha_hasta,
       direccion_fiscal, regimen, responsabilidad, updated_at
     ) VALUES ($1, '', '', '', 'FE', '', $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (tienda_id) DO UPDATE SET
       numero_resolucion = EXCLUDED.numero_resolucion,
       resolucion_fecha_desde = EXCLUDED.resolucion_fecha_desde,
       resolucion_fecha_hasta = EXCLUDED.resolucion_fecha_hasta,
       direccion_fiscal = EXCLUDED.direccion_fiscal,
       regimen = EXCLUDED.regimen,
       responsabilidad = EXCLUDED.responsabilidad,
       updated_at = NOW()
     RETURNING numero_resolucion, resolucion_fecha_desde, resolucion_fecha_hasta,
               direccion_fiscal, regimen, responsabilidad`,
    [userId, numero_resolucion || null, resolucion_fecha_desde || null, resolucion_fecha_hasta || null,
      direccion_fiscal || null, regimen || null, responsabilidad || null]
  );
  await redisClient.del(cacheKey(userId)).catch(() => {});
  return rows[0];
};

export const saveDianConfigForUser = async (userId, data) => {
  const { sw_id, sw_pin, technical_key, prefix, test_set_id } = data;
  const { rows } = await pool.query(
    `INSERT INTO tienda_dian (tienda_id, sw_id, sw_pin, technical_key, prefix, test_set_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (tienda_id)
     DO UPDATE SET 
       sw_id = EXCLUDED.sw_id,
       sw_pin = EXCLUDED.sw_pin,
       technical_key = EXCLUDED.technical_key,
       prefix = EXCLUDED.prefix,
       test_set_id = EXCLUDED.test_set_id,
       updated_at = NOW()
     RETURNING sw_id, sw_pin, technical_key, prefix, test_set_id`,
    [userId, sw_id, sw_pin, technical_key, prefix, test_set_id]
  );
  return rows[0];
};

// Cuenta bancaria donde el proveedor recibe su liquidación.
export const getPayoutAccountForUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT banco_codigo, banco_nombre, tipo_cuenta, numero_cuenta, titular_cuenta, titular_documento, tipo_documento
     FROM tiendas WHERE usrid = $1 LIMIT 1`,
    [userId]
  );
  return rows[0] || { banco_codigo: '', banco_nombre: '', tipo_cuenta: '', numero_cuenta: '', titular_cuenta: '', titular_documento: '', tipo_documento: '' };
};

export const savePayoutAccountForUser = async (userId, data) => {
  const { banco_codigo, tipo_cuenta, numero_cuenta, titular_cuenta, titular_documento, tipo_documento } = data;

  // Validar que el banco exista en el catálogo del país de la tienda.
  const { rows: tiendaRows } = await pool.query(
    `SELECT pais_id FROM tiendas WHERE usrid = $1 LIMIT 1`,
    [userId]
  );
  const paisId = tiendaRows[0]?.pais_id || null;
  const { rows: bancoRows } = await pool.query(
    `SELECT nombre FROM bancos
     WHERE codigo = $1 AND activo = true AND ($2::int IS NULL OR pais_id = $2)
     LIMIT 1`,
    [banco_codigo, paisId]
  );
  if (!bancoRows[0]) {
    const err = new Error('El banco seleccionado no corresponde al país de tu tienda.');
    err.code = 'BANCO_INVALIDO';
    throw err;
  }
  const banco_nombre = bancoRows[0].nombre;

  const { rows } = await pool.query(
    `UPDATE tiendas
     SET banco_codigo = $2, banco_nombre = $3, tipo_cuenta = $4,
         numero_cuenta = $5, titular_cuenta = $6, titular_documento = $7, tipo_documento = $8
     WHERE usrid = $1
     RETURNING banco_codigo, banco_nombre, tipo_cuenta, numero_cuenta, titular_cuenta, titular_documento, tipo_documento`,
    [userId, banco_codigo, banco_nombre, tipo_cuenta, numero_cuenta, titular_cuenta, titular_documento, tipo_documento || null]
  );
  await redisClient.del(cacheKey(userId)).catch(() => {});
  return rows[0];
};

// Apariencia de la vitrina (plantilla, tema, paleta, color y banner).
export const saveStorefrontAppearanceForUser = async (userId, data) => {
  const { template, theme, palette, color, banner } = data;
  const { rows } = await pool.query(
    `UPDATE tiendas
     SET storefront_template = $2, storefront_theme = $3, storefront_palette = $4,
         storefront_color = $5, storefront_banner = $6
     WHERE usrid = $1
     RETURNING storefront_template, storefront_theme, storefront_palette, storefront_color, storefront_banner`,
    [userId, template, theme, palette, color, banner]
  );
  await redisClient.del(cacheKey(userId)).catch(() => {});
  return rows[0] || null;
};

export const getCheckoutIntegrationsForUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT provider, mode, public_key, access_token, webhook_secret, is_default, updated_at
     FROM checkout_integrations
     WHERE tienda_id = $1`,
    [userId]
  );
  return rows.map((row) => {
    const access = row.access_token ? decryptSecret(row.access_token) : null;
    const web = row.webhook_secret ? decryptSecret(row.webhook_secret) : null;
    const broken =
      (isEncryptedSecret(row.access_token) && !access) ||
      (row.webhook_secret && isEncryptedSecret(row.webhook_secret) && !web);
    if (broken) {
      console.error(`[checkout-integrations] credenciales sin descifrar (provider=${row.provider}, mode=${row.mode}); se debe reingresar. Puede deberse a un cambio de APP_ENC_KEY.`);
    }
    return {
      provider: row.provider,
      mode: row.mode,
      public_key: row.public_key,
      access_token: access ? maskSecret(access) : '',
      webhook_secret: web ? maskSecret(web) : '',
      is_default: row.is_default === true,
      broken,
      updated_at: row.updated_at,
    };
  });
};

export const saveCheckoutIntegrationForUser = async (userId, provider, mode, { publicKey, accessToken, webhookSecret, isDefault = false } = {}) => {
  const encPublicKey = publicKey || null;
  const encAccessToken = accessToken ? encryptSecret(accessToken) : null;
  const encWebhookSecret = webhookSecret ? encryptSecret(webhookSecret) : null;

  // Solo una pasarela predeterminada por tienda: se desmarcan las demás.
  if (isDefault) {
    await pool.query(
      `UPDATE checkout_integrations
       SET is_default = false
       WHERE tienda_id = $1 AND NOT (provider = $2 AND mode = $3)`,
      [userId, provider, mode || 'prueba']
    );
  }

  const { rows: existing } = await pool.query(
    `SELECT id, access_token FROM checkout_integrations WHERE tienda_id = $1 AND provider = $2 AND mode = $3 LIMIT 1`,
    [userId, provider, mode || 'prueba']
  );

  if (existing[0]) {
    const { rows } = await pool.query(
      `UPDATE checkout_integrations
       SET public_key = COALESCE($4, public_key),
           access_token = COALESCE($5, access_token),
           webhook_secret = COALESCE($6, webhook_secret),
           is_default = CASE WHEN $7 THEN true ELSE is_default END,
           updated_at = NOW()
       WHERE tienda_id = $1 AND provider = $2 AND mode = $3
       RETURNING provider, mode, public_key, access_token, webhook_secret, is_default, updated_at`,
      [userId, provider, mode || 'prueba', encPublicKey, encAccessToken, encWebhookSecret, isDefault]
    );
    return {
      provider: rows[0].provider,
      mode: rows[0].mode,
      public_key: rows[0].public_key,
      access_token: maskSecret(decryptSecret(rows[0].access_token)),
      webhook_secret: rows[0].webhook_secret ? maskSecret(decryptSecret(rows[0].webhook_secret)) : '',
      is_default: rows[0].is_default === true,
      updated_at: rows[0].updated_at,
    };
  }

  if (!encAccessToken) {
    throw new Error('El token de acceso es obligatorio y no puede quedar vacío.');
  }

  const { rows } = await pool.query(
    `INSERT INTO checkout_integrations (tienda_id, provider, mode, public_key, access_token, webhook_secret, is_default, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING provider, mode, public_key, access_token, webhook_secret, is_default, updated_at`,
    [userId, provider, mode || 'prueba', encPublicKey, encAccessToken, encWebhookSecret, isDefault]
  );
  return {
    provider: rows[0].provider,
    mode: rows[0].mode,
    public_key: rows[0].public_key,
    access_token: maskSecret(decryptSecret(rows[0].access_token)),
    webhook_secret: rows[0].webhook_secret ? maskSecret(decryptSecret(rows[0].webhook_secret)) : '',
    is_default: rows[0].is_default === true,
    updated_at: rows[0].updated_at,
  };
};

// Pasarelas disponibles en el checkout y cuál es la predeterminada.
// MP y Bold son para tiendas colombianas (COP).
export const getPublicPaymentMethods = async ({ moneda = 'COP' } = {}) => {
  const providers = [];
  if (String(moneda).toUpperCase() === 'COP') {
    const { rows } = await pool.query(
      `SELECT provider, is_default
       FROM checkout_integrations
       WHERE provider IN ('mercadopago', 'bold')
         AND access_token IS NOT NULL AND length(access_token) > 0
         AND mode = 'produccion'
       ORDER BY is_default DESC`
    );
    for (const r of rows) providers.push({ provider: r.provider, is_default: r.is_default === true });
  }
  const def = providers.find((p) => p.is_default)?.provider || providers[0]?.provider || null;
  return { moneda: String(moneda).toUpperCase(), providers, default: def };
};

// Solicitud de activación de la tienda en USD para vender al exterior.
export const requestUsdActivation = async (userId, note = null) => {
  const { rows } = await pool.query(
    `UPDATE tiendas
     SET usd_activation_status = 'pending', usd_activation_requested_at = NOW(), usd_activation_note = $2
     WHERE usrid = $1
     RETURNING usd_activation_status, usd_activation_requested_at, usd_activation_note`,
    [userId, note]
  );
  await redisClient.del(cacheKey(userId)).catch(() => {});
  return rows[0] || null;
};

export const getUsdActivationStatus = async (userId) => {
  const { rows } = await pool.query(
    `SELECT usd_activation_status, usd_activation_requested_at, usd_activation_note
     FROM tiendas WHERE usrid = $1 LIMIT 1`,
    [userId]
  );
  return rows[0] || { usd_activation_status: 'none' };
};

export const approveUsdActivation = async (userId, approve = true) => {
  const { rows } = await pool.query(
    `UPDATE tiendas
     SET usd_activation_status = $2, moneda = CASE WHEN $2 = 'approved' THEN 'USD' ELSE moneda END
     WHERE usrid = $1
     RETURNING usrid, usd_activation_status, moneda`,
    [userId, approve ? 'approved' : 'rejected']
  );
  await redisClient.del(cacheKey(userId)).catch(() => {});
  return rows[0] || null;
};

export const deleteCheckoutIntegrationForUser = async (userId, provider, mode) => {
  const { rows } = await pool.query(
    `DELETE FROM checkout_integrations
     WHERE tienda_id = $1 AND provider = $2 AND mode = $3
     RETURNING provider, mode`,
    [userId, provider, mode || 'prueba']
  );
  return rows[0];
};

export const getStoreAnalytics = async (userId) => {
  const tiendaId = Number(userId);
  const analyticsKey = `tienda:analytics:${tiendaId}`;

  const cached = await redisClient.get(analyticsKey).catch(() => null);
  if (cached) return JSON.parse(cached);

  const [summaryRes, productsRes, reviewsRes, dayRes, topRes, catRes, statusRes] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'Completado')::int AS total_orders,
         COALESCE(SUM(amount) FILTER (WHERE status = 'Completado'), 0) AS total_revenue,
         COUNT(*) FILTER (WHERE status <> 'Completado')::int AS pending_orders,
         COALESCE(AVG(amount) FILTER (WHERE status = 'Completado'), 0) AS avg_order_value
       FROM orders
       WHERE tienda_id = $1`,
      [tiendaId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total_products,
              COALESCE(SUM(stock_total), 0)::int AS total_stock
       FROM produc
       WHERE tienda_id = $1`,
      [tiendaId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total_reviews,
              COALESCE(AVG(r.rating), 0)::numeric(3,2) AS avg_rating
       FROM reviews r
       JOIN produc p ON p.id = r.product_id
       WHERE p.tienda_id = $1`,
      [tiendaId]
    ),
    pool.query(
      `SELECT TO_CHAR(d.dia, 'YYYY-MM-DD') AS date,
              COALESCE(SUM(o.amount), 0)::numeric(12,2) AS ventas,
              COUNT(o.id)::int AS ordenes
       FROM generate_series(CURRENT_DATE - 29, CURRENT_DATE, '1 day') d(dia)
       LEFT JOIN orders o
         ON o.created_at::date = d.dia
        AND o.tienda_id = $1
        AND o.status = 'Completado'
       GROUP BY d.dia
       ORDER BY d.dia`,
      [tiendaId]
    ),
    pool.query(
      `SELECT oi.product_name AS name,
              SUM(oi.line_total)::numeric(12,2) AS ventas,
              SUM(oi.quantity)::int AS unidades,
              COUNT(DISTINCT o.id)::int AS ordenes
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.tienda_id = $1 AND o.status = 'Completado'
       GROUP BY oi.product_id, oi.product_name
       ORDER BY ventas DESC
       LIMIT 10`,
      [tiendaId]
    ),
    pool.query(
      `SELECT COALESCE(cat.nombre, 'Sin categoría') AS categoria,
              SUM(oi.line_total)::numeric(12,2) AS ventas,
              SUM(oi.quantity)::int AS cantidad
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN produc p ON p.id = oi.product_id
       LEFT JOIN categorias cat ON cat.id = p.categoria_id
       WHERE o.tienda_id = $1 AND o.status = 'Completado'
       GROUP BY cat.nombre
       ORDER BY ventas DESC`,
      [tiendaId]
    ),
    pool.query(
      `SELECT status, COUNT(*)::int AS cantidad
       FROM orders
       WHERE tienda_id = $1
       GROUP BY status
       ORDER BY cantidad DESC`,
      [tiendaId]
    ),
  ]);

  const summaryRow = summaryRes.rows[0] || {};
  const productsRow = productsRes.rows[0] || {};
  const reviewsRow = reviewsRes.rows[0] || {};

  const result = {
    summary: {
      total_revenue: Number(summaryRow.total_revenue || 0),
      total_orders: Number(summaryRow.total_orders || 0),
      pending_orders: Number(summaryRow.pending_orders || 0),
      avg_order_value: Number(summaryRow.avg_order_value || 0),
      total_products: Number(productsRow.total_products || 0),
      total_stock: Number(productsRow.total_stock || 0),
      total_reviews: Number(reviewsRow.total_reviews || 0),
      avg_rating: Number(reviewsRow.avg_rating || 0),
    },
    salesByDay: dayRes.rows,
    topProducts: topRes.rows,
    salesByCategory: catRes.rows,
    ordersByStatus: statusRes.rows,
  };

  await redisClient.set(analyticsKey, JSON.stringify(result), { EX: 60 }).catch(() => {});
  return result;
};
