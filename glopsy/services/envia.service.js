import axios from 'axios';
import { pool } from '../db.js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { redisClient } from './redis.service.js';
import { decryptSecret } from '../utils/crypto.js';
dotenv.config();

const maskToken = (t) => {
  if (!t) return '';
  if (t.length <= 8) return '****';
  return `${t.substring(0, 4)}****${t.substring(t.length - 4)}`;
};

const getStateCode = (stateName) => {
  if (!stateName) return 'DC';
  const name = String(stateName).toLowerCase();
  if (name.includes('bogotá') || name.includes('dc') || name.includes('d.c.')) return 'DC';
  if (name.includes('cundinamarca')) return 'CUN';
  if (name.includes('antioquia')) return 'ANT';
  if (name.includes('valle')) return 'VAC';
  if (name.includes('atlántico') || name.includes('atlantico')) return 'ATL';
  if (name.includes('santander')) return 'SAN';
  if (name.includes('bolívar') || name.includes('bolivar')) return 'BOL';
  return String(stateName).substring(0, 3).toUpperCase();
};

const ensure8DigitDane = (daneCode) => {
  if (daneCode && String(daneCode).length >= 8) return String(daneCode);
  if (daneCode && String(daneCode).length === 5) {
    return String(daneCode) + '000';
  }
  return '11001000';
};

const getBaseEnviaUrl = (isProd) => {
  return isProd ? (process.env.ENVIA_SHIPPING_API_PROD || 'https://api.envia.com') : (process.env.ENVIA_SHIPPING_API_TEST || 'https://api-test.envia.com');
};

export const getShippingOptionsFromEnvia = async (items = [], destinationCiudadId, tiendaId, opts = {}) => {
  // Build a cache key based on items summary + destination + tiendaId + mode
  const itemsSummary = items.map(i => ({ id: i.id, qty: i.quantity || 1, w: i.weight || 0, l: i.length || 0, h: i.height || 0, wi: i.width || 0 }));
  const modeVal = opts.mode || 'prueba';
  // Include tiendaId in prefix so we can invalidate by tienda
  const tiendaPrefix = tiendaId ? String(tiendaId) : 'global';
  const cacheHash = crypto.createHash('md5').update(JSON.stringify({ items: itemsSummary, destinationCiudadId, tiendaId, mode: modeVal })).digest('hex');
  const cacheKey = `envia:rates:${tiendaPrefix}:${cacheHash}`;

  // Try read from cache
  try {
    const cached = await redisClient.get(cacheKey).catch(() => null);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return { shippingOptions: parsed.shippingOptions || [], shippingCost: parsed.shippingCost || 0 };
      } catch {}
    }
  } catch (e) {
    // ignore cache errors
  }
  // Quick-path: if single package and it's associated to a known tipo_empaque id, try tipo cache
  const singleTipoId = (items.length === 1 && items[0].tipoId) ? items[0].tipoId : null;
  if (singleTipoId) {
    try {
      const tipoCached = await getShippingOptionsForTipoEmpaque(singleTipoId, destinationCiudadId, tiendaId, { mode });
      if (tipoCached) return tipoCached;
    } catch (e) {
      // ignore and continue
    }
  }
  // Determine token: prefer DB (checkout_integrations) if tiendaId provided, otherwise fall back to env var
  let dbRow;
  if (tiendaId) {
    try {
      const { rows } = await pool.query(
        `SELECT access_token, mode FROM checkout_integrations WHERE tienda_id = $1 AND provider = 'envia' ORDER BY (mode = 'produccion') DESC LIMIT 1`,
        [tiendaId]
      );
      dbRow = rows[0];
    } catch (e) {
      // ignore DB lookup errors, fallback to env
      console.error('Error consultando checkout_integrations para Envia:', e.message);
    }
  }

    const accessToken = dbRow?.access_token ? decryptSecret(dbRow.access_token) : (process.env.ENVIA_API_TOKEN || process.env.ENVIA_TOKEN);
  const mode = dbRow?.mode || opts.mode || 'prueba';
  if (!accessToken) {
    // No token available -> cannot query Envia
    return { shippingOptions: [], shippingCost: 0 };
  }

  const isProd = String(mode).toLowerCase() === 'produccion';
  const baseEnviaUrl = getBaseEnviaUrl(isProd);
  const apiUrl = `${baseEnviaUrl.replace(/\/$/, '')}/ship/rate`;

  // Resolve destination info
  const { rows: destRows } = await pool.query(
    `SELECT c.nombre AS ciudad_nombre, c.codigo_postal, c.codigo_dane, d.nombre AS departamento_nombre
     FROM ciudades c
     LEFT JOIN departamentos d ON c.departamento_id = d.id
     WHERE c.id = $1
     LIMIT 1`,
    [destinationCiudadId]
  );

  const destCityCode = ensure8DigitDane(destRows[0]?.codigo_dane);
  const destState = destRows[0]?.departamento_nombre || 'Bogotá D.C.';
  const destPostalCode = destRows[0]?.codigo_postal || '110011';

  // Resolve origin from first item fullment or tienda fullment
  let originCityCode = ensure8DigitDane('11001');
  let originState = 'Bogotá D.C.';
  let originPostalCode = '110011';

  // Only attempt to resolve origin from DB if the first item's id looks like a numeric product id
  if (items[0]?.id && /^\d+$/.test(String(items[0].id))) {
    const { rows: originRows } = await pool.query(
      `SELECT c.nombre AS ciudad_nombre, c.codigo_postal, c.codigo_dane, d.nombre AS departamento_nombre
       FROM produc p
       LEFT JOIN fullments f ON p.fullm_id = f.id
       LEFT JOIN ciudades c ON f.ciudad_id = c.id
       LEFT JOIN departamentos d ON c.departamento_id = d.id
       WHERE p.id = $1
       LIMIT 1`,
      [items[0].id]
    );
    if (originRows[0]?.ciudad_nombre) {
      originCityCode = ensure8DigitDane(originRows[0].codigo_dane);
      originState = originRows[0].departamento_nombre || originState;
      originPostalCode = originRows[0].codigo_postal || originPostalCode;
    } else if (tiendaId) {
      const { rows: storeFullmentRows } = await pool.query(
        `SELECT c.nombre AS ciudad_nombre, c.codigo_postal, c.codigo_dane, d.nombre AS departamento_nombre
         FROM fullments f
         JOIN ciudades c ON f.ciudad_id = c.id
         LEFT JOIN departamentos d ON c.departamento_id = d.id
         WHERE f.tienda_id = $1 AND f.estado = 'activo'
         LIMIT 1`,
        [tiendaId]
      );
      if (storeFullmentRows[0]?.ciudad_nombre) {
        originCityCode = ensure8DigitDane(storeFullmentRows[0].codigo_dane);
        originState = storeFullmentRows[0].departamento_nombre || originState;
        originPostalCode = storeFullmentRows[0].codigo_postal || originPostalCode;
      }
    }
  }

  const payload = {
    origin: {
      postalCode: originPostalCode,
      city: originCityCode,
      state: getStateCode(originState),
      country: 'CO'
    },
    destination: {
      postalCode: destPostalCode,
      city: destCityCode,
      state: getStateCode(destState),
      country: 'CO'
    },
    packages: items.map(item => ({
      content: String(item.name || 'Mercancía General').replace(/[^\w\s\+\-\.]/gi, '').trim() || 'Mercancia General',
      amount: Number(item.quantity) || 1,
      type: 'box',
      weight: Number(item.weight || process.env.ENVIA_DEFAULT_WEIGHT || 1),
      dimensions: {
        length: Number(item.length || process.env.ENVIA_DEFAULT_LENGTH || 10),
        height: Number(item.height || process.env.ENVIA_DEFAULT_HEIGHT || 10),
        width: Number(item.width || process.env.ENVIA_DEFAULT_WIDTH || 10)
      }
    })),
    shipment: { type: 1 },
    settings: { currency: 'COP' }
  };

  const carriersToQuery = ['servientrega', 'interrapidisimo', 'coordinadora'];

  console.log('ENVIA: cotizando tarifas', { apiUrl, mode: isProd ? 'produccion' : 'prueba', token: maskToken(accessToken) });

  const requestTimeout = Number(process.env.ENVIA_REQUEST_TIMEOUT || 10000); // ms
  const maxRetries = Number(process.env.ENVIA_REQUEST_MAX_RETRIES || 1); // number of retries after initial attempt

  const doCarrierRequest = async (carrierName) => {
    const carrierPayload = { ...payload, shipment: { carrier: carrierName, type: 1 } };
    let attempt = 0;
    let lastErr = null;
    while (attempt <= maxRetries) {
      try {
        const res = await axios.post(apiUrl, carrierPayload, {
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          timeout: requestTimeout
        });
        return res.data?.data || res.data?.rates || res.data?.response || res.data || [];
      } catch (err) {
        lastErr = err;
        const isTimeout = err.code === 'ECONNABORTED' || (err.message && err.message.toLowerCase().includes('timeout'));
        console.log(`ENVIA: error carrier ${carrierName} attempt ${attempt + 1}/${maxRetries + 1}:`, isTimeout ? `timeout ${requestTimeout}ms` : (err.response?.data || err.message));
        attempt += 1;
        if (attempt > maxRetries) break;
        // exponential backoff before retry
        const backoffMs = Math.min(2000, 200 * Math.pow(2, attempt));
        await new Promise(r => setTimeout(r, backoffMs));
      }
    }
    // final log of failure
    console.log(`ENVIA: carrier ${carrierName} failed after ${maxRetries + 1} attempts:`, lastErr?.response?.data || lastErr?.message);
    return [];
  };

  const ratePromises = carriersToQuery.map(carrierName => doCarrierRequest(carrierName));

    try {
    const results = await Promise.all(ratePromises);
    const allRates = results.flat().filter(Boolean);

    let shippingOptions = [];
    if (allRates.length > 0) {
      shippingOptions = allRates.map(opt => {
        const priceVal = Number(opt.totalprice || opt.totalPrice || opt.price || opt.rate || opt.cost || opt.total || opt.servicePrice || opt.basePrice || 0);
        return {
          carrier: opt.carrierDescription || opt.carrier || opt.carrier_name || opt.name || opt.provider || 'Servientrega',
          service: opt.serviceDescription || opt.service || opt.service_name || opt.type || opt.serviceName || 'Standard',
          price: priceVal,
          delivery_estimate: opt.deliveryEstimate || opt.delivery_estimate || opt.days || opt.deliverytime || opt.transitTime || '3-5 días hábiles'
        };
      }).filter(o => {
        if (o.price <= 0) return false;
        const s = String(o.service).toLowerCase();
        const c = String(o.carrier).toLowerCase();
        if (s.includes('industrial') || c.includes('industrial')) return false;
        return c.includes('servi') || c.includes('inter') || c.includes('coord');
      });

      shippingOptions.sort((a, b) => a.price - b.price);
      const uniqueCarrierMap = new Map();
      for (const opt of shippingOptions) {
        const cLower = String(opt.carrier || '').toLowerCase();
        let carrierKey = cLower;
        if (cLower.includes('servi')) carrierKey = 'servientrega';
        else if (cLower.includes('inter')) carrierKey = 'interrapidisimo';
        else if (cLower.includes('coord')) carrierKey = 'coordinadora';

        if (!uniqueCarrierMap.has(carrierKey)) uniqueCarrierMap.set(carrierKey, opt);
      }
      shippingOptions = Array.from(uniqueCarrierMap.values());
    }

    const shippingCost = shippingOptions.length > 0 ? shippingOptions[0].price : Number(process.env.DEFAULT_SHIPPING_COST || 15000);

    // Store in cache (short TTL)
    try {
      await redisClient.set(cacheKey, JSON.stringify({ shippingOptions, shippingCost }), { EX: Number(process.env.ENVIA_RATES_CACHE_TTL || 300) }).catch(() => {});
    } catch (e) {}

    return { shippingOptions, shippingCost };
  } catch (err) {
    console.error('ENVIA: error general cotizando tarifas', err.message, err.response?.data);
    return { shippingOptions: [], shippingCost: Number(process.env.DEFAULT_SHIPPING_COST || 15000) };
  }
};

export const getShippingOptionsForTipoEmpaque = async (tipoId, destinationCiudadId, tiendaId, opts = {}) => {
  if (!tipoId) return null;
  const mode = opts.mode || 'prueba';
  const isProd = String(mode).toLowerCase() === 'produccion';
  const cacheKey = `envia:tipo:${tipoId}:${tiendaId || 'global'}:${destinationCiudadId}:${mode}`;
  try {
    const cached = await redisClient.get(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached);
  } catch {}

  // fetch packaging data
  try {
    const { rows } = await pool.query(`SELECT id, peso, largo, alto, ancho FROM tipo_empaque WHERE id = $1 LIMIT 1`, [tipoId]);
    if (!rows[0]) return null;
    const tipo = rows[0];
    const payload = {
      packages: [{
        weight: Number(tipo.peso || process.env.ENVIA_DEFAULT_WEIGHT || 1),
        dimensions: {
          length: Number(tipo.largo || process.env.ENVIA_DEFAULT_LENGTH || 10),
          width: Number(tipo.ancho || process.env.ENVIA_DEFAULT_WIDTH || 10),
          height: Number(tipo.alto || process.env.ENVIA_DEFAULT_HEIGHT || 10)
        }
      }]
    };

    // We'll call the generic endpoint through same flow: build apiUrl and token
    let dbRow;
    if (tiendaId) {
      try {
        const r = await pool.query(`SELECT access_token, mode FROM checkout_integrations WHERE tienda_id = $1 AND provider = 'envia' ORDER BY (mode = 'produccion') DESC LIMIT 1`, [tiendaId]);
        dbRow = r.rows[0];
      } catch {}
    }
  const accessToken = dbRow?.access_token ? decryptSecret(dbRow.access_token) : (process.env.ENVIA_API_TOKEN || process.env.ENVIA_TOKEN);
    if (!accessToken) return null;
    const isProdFinal = dbRow?.mode ? String(dbRow.mode).toLowerCase() === 'produccion' : isProd;
    const baseEnviaUrl = getBaseEnviaUrl(isProdFinal);
    const apiUrl = `${baseEnviaUrl.replace(/\/$/, '')}/ship/rate`;

    try {
      const res = await axios.post(apiUrl, payload, { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: Number(process.env.ENVIA_REQUEST_TIMEOUT || 10000) });
      const data = res.data?.data || res.data?.rates || res.data || [];
      // normalize to shippingOptions
      const options = Array.isArray(data) ? data.map(opt => ({ carrier: opt.carrierDescription || opt.carrier || opt.carrier_name || opt.name || opt.provider || 'envia', service: opt.serviceDescription || opt.service || opt.service_name || opt.type || opt.serviceName || 'Standard', price: Number(opt.totalprice || opt.totalPrice || opt.price || opt.rate || opt.cost || opt.total || opt.servicePrice || opt.basePrice || 0), delivery_estimate: opt.deliveryEstimate || opt.delivery_estimate || opt.days || opt.deliverytime || opt.transitTime || '---' })) : [];
      const shippingCost = options.length > 0 ? options.sort((a,b)=>a.price-b.price)[0].price : Number(process.env.DEFAULT_SHIPPING_COST || 15000);
      const out = { shippingOptions: options, shippingCost };
      try { await redisClient.set(cacheKey, JSON.stringify(out), { EX: Number(process.env.ENVIA_RATES_CACHE_TTL || 300) }).catch(()=>{}); } catch {}
      return out;
    } catch (err) {
      return null;
    }
  } catch (err) {
    return null;
  }
};

// Invalidate cached rates for a given tienda (and optional global)
export const invalidateRatesCacheForStore = async (tiendaId) => {
  if (!tiendaId) return;
  const pattern = `envia:rates:${tiendaId}:*`;
  try {
    const foundKeys = [];
    // Prefer non-blocking SCAN iterator when available
    if (typeof redisClient.scanIterator === 'function') {
      try {
        for await (const key of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
          foundKeys.push(key);
        }
      } catch (e) {
        // fallback to KEYS if scanIterator fails for some reason
        const fallback = await redisClient.keys(pattern).catch(() => []);
        if (Array.isArray(fallback)) foundKeys.push(...fallback);
      }
    } else {
      // Older clients may not expose scanIterator; fallback to keys
      const fallback = await redisClient.keys(pattern).catch(() => []);
      if (Array.isArray(fallback)) foundKeys.push(...fallback);
    }

    if (foundKeys.length > 0) {
      // delete in chunks to avoid argument length limits
      const chunkSize = 500;
      for (let i = 0; i < foundKeys.length; i += chunkSize) {
        const chunk = foundKeys.slice(i, i + chunkSize);
        await redisClient.del(...chunk).catch(() => {});
      }
    }
  } catch (e) {
    console.error('Error invalidando cache de ENVIA para tienda', tiendaId, e.message);
  }
};

export default { getShippingOptionsFromEnvia };
