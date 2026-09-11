import { query } from '../db.js';
import { getProductsByFullment, assignProductsToFullment } from '../services/product.service.js';
import { invalidateRatesCacheForStore } from '../services/envia.service.js';
import { redisClient } from '../services/redis.service.js';
import { getZoomCities } from '../services/zoom.service.js';
import { toInt, cleanString } from '../utils/validation.js';

const getCached = async (key, ttl, fetcher) => {
  const cached = await redisClient.get(key).catch(() => null);
  if (cached) return JSON.parse(cached);
  const data = await fetcher();
  await redisClient.set(key, JSON.stringify(data), { EX: ttl }).catch(() => {});
  return data;
};

const invalidateFullmentsCache = async () => {
  await redisClient.del('geo:fullments').catch(() => {});
};

export const getFullments = async (req, res) => {
  try {
    const rows = await getCached('geo:fullments', 60, async () => {
      const { rows } = await query(`
        SELECT 
          f.id AS fullment_id,
          f.tienda_id,
          c.id AS ciudad_id,
          c.nombre AS ciudad_nombre,
          d.id AS departamento_id,
          d.nombre AS departamento_nombre,
          p.id AS pais_id,
          p.nombre AS pais_nombre
        FROM fullments f
        JOIN ciudades c ON f.ciudad_id = c.id
        JOIN departamentos d ON c.departamento_id = d.id
        JOIN paises p ON d.pais_id = p.id
        WHERE f.estado = 'activo'
        ORDER BY c.nombre
      `);
      return rows;
    });
    res.json({ ok: true, fullments: rows });
  } catch (error) {
    console.error('Error al obtener fullments:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener centros de distribución (fullments)' });
  }
};

export const getMyFullments = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { rows } = await query(`
      SELECT 
        f.id AS fullment_id,
        f.tienda_id,
        c.id AS ciudad_id,
        c.nombre AS ciudad_nombre,
        d.id AS departamento_id,
        d.nombre AS departamento_nombre,
        p.id AS pais_id,
        p.nombre AS pais_nombre
      FROM fullments f
      JOIN ciudades c ON f.ciudad_id = c.id
      JOIN departamentos d ON c.departamento_id = d.id
      JOIN paises p ON d.pais_id = p.id
      WHERE f.tienda_id = $1 AND f.estado = 'activo'
      ORDER BY c.nombre
    `, [userId]);
    res.json({ ok: true, fullments: rows });
  } catch (error) {
    console.error('Error al obtener fullments de la tienda:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener los centros de distribución de la tienda' });
  }
};

export const getPaises = async (req, res) => {
  try {
    const rows = await getCached('geo:paises', 3600, async () => {
      const { rows } = await query(`
        SELECT id, nombre, codigo_iso, moneda, locale, dominio_raiz
        FROM paises
        ORDER BY nombre
      `);
      return rows;
    });
    res.json({ ok: true, paises: rows });
  } catch (error) {
    console.error('Error al obtener países:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener países' });
  }
};

export const getZoomCiudades = async (req, res) => {
  try {
    const list = await getZoomCities('origen');
    const ciudades = list.map((c) => ({
      codigo: Number(c.codciudad),
      nombre: c.nombre_ciudad,
      estado: c.nombre_estado,
    }));
    res.json({ ok: true, ciudades });
  } catch (error) {
    console.error('Error al obtener ciudades ZOOM:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener ciudades ZOOM' });
  }
};

export const getDepartamentos = async (req, res) => {
  try {
    // Multicountry: filtrar por país (pais_id o codigo_iso). Sin filtro => todos.
    const paisId = toInt(req.query.pais_id, { min: 1, fallback: null });
    const codigoIso = cleanString(req.query.codigo_iso, { maxLength: 10 }) || null;
    const cacheKey = `geo:departamentos:${paisId || codigoIso || 'all'}`;
    const rows = await getCached(cacheKey, 3600, async () => {
      const params = [];
      const where = [];
      if (paisId) {
        params.push(paisId);
        where.push(`d.pais_id = $${params.length}`);
      }
      if (codigoIso) {
        params.push(codigoIso.toUpperCase());
        where.push(`p.codigo_iso = $${params.length}`);
      }
      const { rows } = await query(`
        SELECT d.id, d.nombre, d.pais_id
        FROM departamentos d
        ${codigoIso ? 'JOIN paises p ON p.id = d.pais_id' : ''}
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY d.nombre
      `, params);
      return rows;
    });
    res.json({ ok: true, departamentos: rows });
  } catch (error) {
    console.error('Error al obtener departamentos:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener departamentos' });
  }
};

export const getCiudades = async (req, res) => {
  try {
    // Multicountry: filtrar por país y/u departamento. Sin filtro => todas.
    const paisId = toInt(req.query.pais_id, { min: 1, fallback: null });
    const codigoIso = cleanString(req.query.codigo_iso, { maxLength: 10 }) || null;
    const departamentoId = toInt(req.query.departamento_id, { min: 1, fallback: null });
    const cacheKey = `geo:ciudades:${paisId || codigoIso || 'all'}:${departamentoId || 'all'}`;
    const rows = await getCached(cacheKey, 3600, async () => {
      const params = [];
      const where = [];
      if (departamentoId) {
        params.push(departamentoId);
        where.push(`c.departamento_id = $${params.length}`);
      }
      if (paisId) {
        params.push(paisId);
        where.push(`d.pais_id = $${params.length}`);
      }
      if (codigoIso) {
        params.push(codigoIso.toUpperCase());
        where.push(`p.codigo_iso = $${params.length}`);
      }
      const { rows } = await query(`
        SELECT c.id, c.nombre, c.departamento_id, c.codigo_postal
        FROM ciudades c
        JOIN departamentos d ON d.id = c.departamento_id
        ${codigoIso ? 'JOIN paises p ON p.id = d.pais_id' : ''}
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY c.nombre
      `, params);
      return rows;
    });
    res.json({ ok: true, ciudades: rows });
  } catch (error) {
    console.error('Error al obtener ciudades:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener ciudades' });
  }
};

// Normaliza nombres (minúsculas, sin acentos ni puntuación) para comparar.
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/^d\s?c$/, '')
    .trim();

// Convierte coordenadas (lat/lon) a la ciudad con cobertura de envío más cercana.
// Usa el reverse geocoding público de Nominatim (OpenStreetMap); sin API key.
export const reverseGeocode = async (req, res) => {
  const lat = Number(cleanString(req.query.lat, { maxLength: 20 }));
  const lon = Number(cleanString(req.query.lon, { maxLength: 20 }));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ ok: false, message: 'lat y lon son obligatorias y deben ser válidas.' });
  }

  const cacheKey = `geo:reverse:${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = await redisClient.get(cacheKey).catch(() => null);
  if (cached) return res.json(JSON.parse(cached));

  try {
    const [supportedRows, geoRes] = await Promise.all([
      query(`
        SELECT DISTINCT c.id AS ciudad_id, c.nombre AS ciudad_nombre,
                        d.id AS departamento_id, d.nombre AS departamento_nombre
        FROM fullments f
        JOIN ciudades c ON f.ciudad_id = c.id
        JOIN departamentos d ON c.departamento_id = d.id
        WHERE f.estado = 'activo'
      `),
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=es`,
        { headers: { 'User-Agent': 'glopsy-app/1.0 (contacto: app@glopsy.shop)' }, signal: AbortSignal.timeout(8000) }
      ),
    ]);

    let body;
    try {
      body = await geoRes.json();
    } catch {
      body = {};
    }

    const supported = supportedRows.rows;
    const address = geoRes.status === 200 ? body?.address || {} : {};
    const raw = cleanString(
      address.county || address.municipality || address.town || address.city || address.state_district,
      { maxLength: 140 }
    );
    // Nominatim (Colombia) suele devolver "Perímetro Urbano X" o "X ciudad".
    const reversedCity = raw
      .replace(/\bper[íi]metro\s*urbano\b/gi, ' ')
      .replace(/\bciudad\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const departamento = cleanString(address.state || address.state_district, { maxLength: 140 });

    const target = norm(reversedCity);
    const match =
      (target && supported.find((r) => norm(r.ciudad_nombre) === target)) ||
      (target && supported.find((r) => norm(r.ciudad_nombre) && norm(r.ciudad_nombre).includes(target))) ||
      (target && supported.find((r) => target.includes(norm(r.ciudad_nombre)))) ||
      (departamento ? supported.find((r) => norm(r.departamento_nombre) === norm(departamento)) : null);

    const result = {
      ok: true,
      ubicacion: {
        reversedCity,
        departamento,
        match: match || null,
      },
    };
    await redisClient.set(cacheKey, JSON.stringify(result), { EX: 86400 }).catch(() => {});
    return res.json(result);
  } catch (error) {
    console.error('Error en reverse geocoding:', error.message);
    return res.status(502).json({ ok: false, message: 'No fue posible determinar tu ciudad por ubicación.' });
  }
};

export const createFullment = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const ciudad_id = toInt(req.body.ciudad_id, { min: 1 });

    if (!ciudad_id) {
      return res.status(400).json({ ok: false, message: 'El campo ciudad_id es obligatorio' });
    }

    const { rows } = await query(
      `INSERT INTO fullments (tienda_id, ciudad_id, estado)
       VALUES ($1, $2, 'activo')
       RETURNING id AS fullment_id, tienda_id, ciudad_id, estado`,
      [userId, ciudad_id]
    );

    res.status(201).json({ ok: true, fullment: rows[0] });
    try { await invalidateFullmentsCache().catch(() => {}); } catch {}
    try { await invalidateRatesCacheForStore(userId).catch(() => {}); } catch {}
  } catch (error) {
    console.error('Error al crear fullment:', error.message);
    if (error.code === '23505') {
      return res.status(400).json({ ok: false, message: 'Este centro de distribución ya se encuentra registrado para esta ciudad.' });
    }
    res.status(500).json({ ok: false, message: 'Error al guardar el centro de distribución' });
  }
};

export const deleteFullment = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const id = toInt(req.params.id, { min: 1 });
    if (!id) {
      return res.status(400).json({ ok: false, message: 'ID inválido.' });
    }

    const { rowCount } = await query(
      `DELETE FROM fullments WHERE id = $1 AND tienda_id = $2`,
      [id, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ ok: false, message: 'Centro de distribución no encontrado' });
    }

    res.json({ ok: true, message: 'Centro de distribución eliminado' });
    try { await invalidateFullmentsCache().catch(() => {}); } catch {}
    try { await invalidateRatesCacheForStore(userId).catch(() => {}); } catch {}
  } catch (error) {
    console.error('Error al eliminar fullment:', error.message);
    res.status(500).json({ ok: false, message: 'Error al eliminar el centro de distribución' });
  }
};

export const updateFullmentPerfil = async (req, res) => {
  return res.json({ ok: true, message: 'Actualizado.' });
};

export const getFullmentProducts = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const id = toInt(req.params.id, { min: 1 });
    if (!id) {
      return res.status(400).json({ ok: false, message: 'ID inválido.' });
    }
    const products = await getProductsByFullment(userId, id);
    res.json({ ok: true, products });
  } catch (error) {
    console.error('Error al obtener productos del centro:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener los productos del centro de distribución' });
  }
};

export const updateFullmentProducts = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const id = toInt(req.params.id, { min: 1 });
    if (!id) {
      return res.status(400).json({ ok: false, message: 'ID inválido.' });
    }
    const product_ids = Array.isArray(req.body.product_ids)
      ? req.body.product_ids.map((pid) => toInt(pid, { min: 1 })).filter(Boolean)
      : [];
    const product_profiles = {};
    if (req.body.product_profiles && typeof req.body.product_profiles === 'object' && !Array.isArray(req.body.product_profiles)) {
      for (const [pid, perfilId] of Object.entries(req.body.product_profiles)) {
        const pId = toInt(pid, { min: 1 });
        const profile = toInt(perfilId, { min: 1 });
        if (pId) product_profiles[pId] = profile;
      }
    }

    const products = await assignProductsToFullment(userId, id, product_ids, product_profiles);
    res.json({ ok: true, message: 'Productos actualizados en el centro de distribución', products });
  } catch (error) {
    console.error('Error al actualizar productos del centro:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al actualizar los productos del centro de distribución' });
  }
};
