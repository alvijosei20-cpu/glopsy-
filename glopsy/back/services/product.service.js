import { pool } from '../db.js';
import crypto from 'crypto';
import axios from 'axios';
import { getShippingOptionsFromEnvia, invalidateRatesCacheForStore } from './envia.service.js';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { obtenerProductoPorId } from './mastershopService.js';
import { redisClient } from './redis.service.js';
import { decryptSecret } from '../utils/crypto.js';
import {
  cleanString,
  cleanText,
  cleanEmail,
  cleanPhone,
  cleanUrl,
  toNumber,
  sanitizeObject,
  sanitizeArray,
} from '../utils/validation.js';

export const getTiposEmpaque = async () => {
  const cached = await redisClient.get('tipo-empaque').catch(() => null);
  if (cached) return JSON.parse(cached);
  const { rows } = await pool.query('SELECT id, nombre, peso, largo, alto, ancho FROM tipo_empaque ORDER BY id');
  await redisClient.set('tipo-empaque', JSON.stringify(rows), { EX: 3600 }).catch(() => {});
  return rows;
};

export const invalidateProductCache = async (productId, publicId) => {
  const keys = [];
  if (productId !== undefined && productId !== null) keys.push(`product:detail:${productId}`, `product:reviews:${productId}`);
  if (publicId) keys.push(`product:detail:${publicId}`);
  if (keys.length > 0) await redisClient.del(keys).catch(() => {});
};

export const saveProductForUser = async (userId, productData) => {
  const {
    idProduct,
    idVariant,
    baseCurrencyPrice,
    productOwner,
    urlImageProduct,
    variation,
    warrantyPeriod,
    warrantyConditions,
    supportEmail,
    warrantyPhone,
    selectedOptions,
    fullmId,
    integracionId,
    tiendaIntegracionId,
    provider,
    tipoEmpaqueId,
    tipo_empaque_id,
    perfilEnvioId,
    perfil_envio_id,
  } = productData;

  const resolvedTipoEmpaqueId = tipo_empaque_id !== undefined ? tipo_empaque_id : tipoEmpaqueId;
  const rawPerfilEnvioId = perfil_envio_id !== undefined ? perfil_envio_id : perfilEnvioId;

  const parseNumeric = (val) => {
    if (val === undefined || val === null || val === '') return null;
    const cleaned = String(val).replace(/[^0-9.,-]/g, '').replace(',', '.');
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  };

  const name = cleanString(productData.name, { maxLength: 255 });
  const description = cleanText(productData.description, { maxLength: 20000 });
  const basePrice = toNumber(parseNumeric(productData.basePrice), { min: 0, fallback: 0 });
  const suggestedPrice = toNumber(parseNumeric(productData.suggestedPrice), { min: 0 });
  const stockTotal = Math.round(toNumber(parseNumeric(productData.stockTotal), { min: 0, fallback: 0 }));
  const currency = cleanString(baseCurrencyPrice, { maxLength: 10 }) || 'USD';
  const cleanProvider = cleanString(provider, { maxLength: 30 });

  if (!name) {
    throw new Error('El nombre del producto es obligatorio.');
  }

  // 1. Asegurar que la tienda exista para el usuario (Upsert)
  await pool.query(
    `INSERT INTO tiendas (usrid, nombres, activa)
     VALUES ($1, $2, true)
     ON CONFLICT (usrid) DO NOTHING`,
    [userId, `Tienda de Usuario ${userId}`]
  );

  // 2. Resolver o validar el centro de distribución (fullm_id)
  let resolvedFullmId = fullmId ? Number(fullmId) : null;
  if (resolvedFullmId) {
    const fullmentCheck = await pool.query(
      `SELECT id FROM fullments WHERE id = $1 AND tienda_id = $2 LIMIT 1`,
      [resolvedFullmId, userId]
    );
    if (fullmentCheck.rows.length === 0) {
      resolvedFullmId = null;
    }
  }

  if (!resolvedFullmId) {
    const defaultFullment = await pool.query(
      `SELECT id FROM fullments WHERE tienda_id = $1 ORDER BY id LIMIT 1`,
      [userId]
    );
    if (defaultFullment.rows[0]) {
      resolvedFullmId = defaultFullment.rows[0].id;
    } else {
      const cityRow = await pool.query(`SELECT id FROM ciudades ORDER BY id LIMIT 1`);
      if (cityRow.rows[0]) {
        const newFullment = await pool.query(
          `INSERT INTO fullments (tienda_id, ciudad_id, estado) VALUES ($1, $2, 'activo') RETURNING id`,
          [userId, cityRow.rows[0].id]
        );
        resolvedFullmId = newFullment.rows[0].id;
      }
    }
  }

  // Validar el perfil de envío: debe pertenecer a la tienda y al centro de distribución seleccionado
  let resolvedPerfilEnvioId = rawPerfilEnvioId ? Number(rawPerfilEnvioId) : null;
  if (resolvedPerfilEnvioId) {
    const perfilCheck = await pool.query(
      `SELECT id FROM perfiles_envio WHERE id = $1 AND tienda_id = $2 AND fullment_id = $3 LIMIT 1`,
      [resolvedPerfilEnvioId, userId, resolvedFullmId]
    );
    if (perfilCheck.rows.length === 0) {
      resolvedPerfilEnvioId = null;
    }
  }

  const imageUrl = cleanUrl(urlImageProduct, { maxLength: 2048 });
  const images = imageUrl ? [{ src: imageUrl }] : [];
  const variants = sanitizeArray(variation, (v) => sanitizeObject(v, { maxSize: 50 }), { maxLength: 200 });
  const warranties = {
    period: cleanString(warrantyPeriod, { maxLength: 500 }) || '',
    conditions: cleanText(warrantyConditions, { maxLength: 2000 }) || '',
  };
  const support = {
    email: cleanEmail(supportEmail) || '',
    phone: cleanPhone(warrantyPhone, { maxLength: 20 }) || '',
  };
  const cleanProductOwner = productOwner ? sanitizeObject(productOwner, { maxSize: 50 }) : null;
  const cleanSelectedOptions = selectedOptions ? sanitizeObject(selectedOptions, { maxSize: 100 }) : null;

  let resolvedIntegracionId = integracionId !== undefined ? integracionId : tiendaIntegracionId;
  if (!resolvedIntegracionId && cleanProvider) {
    const intRow = await pool.query(
      `SELECT id FROM tienda_integraciones WHERE user_id = $1 AND provider = $2 LIMIT 1`,
      [userId, cleanProvider]
    );
    if (intRow.rows[0]) {
      resolvedIntegracionId = intRow.rows[0].id;
    }
  } else if (!resolvedIntegracionId) {
    const intRow = await pool.query(
      `SELECT id FROM tienda_integraciones WHERE user_id = $1 ORDER BY id LIMIT 1`,
      [userId]
    );
    if (intRow.rows[0]) {
      resolvedIntegracionId = intRow.rows[0].id;
    }
  }

  // Comprobar si ya existe el producto para actualizarlo (Upsert / Actualización automática)
  let existingId = null;
  if (idProduct) {
    const existing = await pool.query(
      `SELECT id FROM produc WHERE tienda_id = $1 AND external_product_id = $2 LIMIT 1`,
      [userId, String(idProduct)]
    );
    if (existing.rows[0]) {
      existingId = existing.rows[0].id;
    }
  }
  if (!existingId && name) {
    const existing = await pool.query(
      `SELECT id FROM produc WHERE tienda_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
      [userId, name.trim()]
    );
    if (existing.rows[0]) {
      existingId = existing.rows[0].id;
    }
  }

  let resultRow;
  if (existingId) {
    const updateQuery = `
      UPDATE produc SET
        external_product_id = $2,
        selected_variant_id = $3,
        integracion_id = $4,
        name = $5,
        base_price = $6,
        base_currency_price = $7,
        suggested_price = $8,
        description = $9,
        stock_total = $10,
        product_owner = $11,
        images = $12,
        variants = $13,
        warranties = $14,
        support = $15,
        selected_options = $16,
        fullm_id = $17,
        tipo_empaque_id = $18,
        perfil_envio_id = $19,
        updated_at = NOW()
      WHERE id = $20 AND tienda_id = $1
      RETURNING id, name, external_product_id, selected_variant_id, suggested_price, fullm_id, tipo_empaque_id, perfil_envio_id, integracion_id, created_at
    `;
    const updateValues = [
      userId,
      idProduct ? String(idProduct) : null,
      idVariant ? String(idVariant) : null,
      resolvedIntegracionId !== undefined && resolvedIntegracionId !== '' ? Number(resolvedIntegracionId) : null,
      name,
      basePrice,
      currency,
      suggestedPrice,
      description || '',
      stockTotal,
      cleanProductOwner ? JSON.stringify(cleanProductOwner) : null,
      JSON.stringify(images),
      JSON.stringify(variants),
      JSON.stringify(warranties),
      JSON.stringify(support),
      cleanSelectedOptions ? JSON.stringify(cleanSelectedOptions) : '{}',
      resolvedFullmId ? Number(resolvedFullmId) : null,
      resolvedTipoEmpaqueId ? Number(resolvedTipoEmpaqueId) : null,
      resolvedPerfilEnvioId ? Number(resolvedPerfilEnvioId) : null,
      existingId,
    ];
    const { rows } = await pool.query(updateQuery, updateValues);
    resultRow = rows[0];
  } else {
    const publicId = crypto.randomBytes(16).toString('hex');
    const insertQuery = `
      INSERT INTO produc (
        tienda_id,
        public_id,
        external_product_id,
        selected_variant_id,
        integracion_id,
        name,
        base_price,
        base_currency_price,
        suggested_price,
        description,
        stock_total,
        product_owner,
        images,
        variants,
        warranties,
        support,
        selected_options,
        fullm_id,
        tipo_empaque_id,
        perfil_envio_id,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
      RETURNING id, public_id, name, external_product_id, selected_variant_id, suggested_price, fullm_id, tipo_empaque_id, perfil_envio_id, integracion_id, created_at
    `;
    const insertValues = [
      userId,
      publicId,
      idProduct ? String(idProduct) : null,
      idVariant ? String(idVariant) : null,
      resolvedIntegracionId !== undefined && resolvedIntegracionId !== '' ? Number(resolvedIntegracionId) : null,
      name,
      basePrice,
      currency,
      suggestedPrice,
      description || '',
      stockTotal,
      cleanProductOwner ? JSON.stringify(cleanProductOwner) : null,
      JSON.stringify(images),
      JSON.stringify(variants),
      JSON.stringify(warranties),
      JSON.stringify(support),
      cleanSelectedOptions ? JSON.stringify(cleanSelectedOptions) : '{}',
      resolvedFullmId ? Number(resolvedFullmId) : null,
      resolvedTipoEmpaqueId ? Number(resolvedTipoEmpaqueId) : null,
      resolvedPerfilEnvioId ? Number(resolvedPerfilEnvioId) : null,
    ];
    const { rows } = await pool.query(insertQuery, insertValues);
    resultRow = rows[0];
  }

  // Invalidate cache for this tienda since product data / fullment assignment may affect shipping origin
  try {
    await invalidateRatesCacheForStore(userId).catch(() => {});
  } catch {}

  // Invalidate product detail cache so the published changes are visible immediately
  await invalidateProductCache(resultRow?.id, resultRow?.public_id).catch(() => {});

  return resultRow;
};

export const getProductsForUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT id, name, base_price, suggested_price, stock_total, fullm_id, perfil_envio_id, selected_variant_id, selected_options, created_at
     FROM produc
     WHERE tienda_id = $1
     ORDER BY name`,
    [userId]
  );
  return rows;
};

export const getProductsByFullment = async (userId, fullmentId) => {
  const { rows } = await pool.query(
    `SELECT id, name, base_price, suggested_price, stock_total, fullm_id, perfil_envio_id, selected_variant_id, selected_options, created_at
     FROM produc
     WHERE tienda_id = $1 AND fullm_id = $2
     ORDER BY name`,
    [userId, fullmentId]
  );
  return rows;
};

export const assignProductsToFullment = async (userId, fullmentId, productIds, productProfiles = {}) => {
  const fullmentCheck = await pool.query(
    `SELECT id FROM fullments WHERE id = $1 AND tienda_id = $2 LIMIT 1`,
    [fullmentId, userId]
  );
  if (fullmentCheck.rows.length === 0) {
    throw new Error('Centro de distribución no encontrado o no pertenece a tu tienda.');
  }

  const ids = Array.isArray(productIds) ? productIds.map(Number).filter(Boolean) : [];

  if (ids.length > 0) {
    await pool.query(
      `UPDATE produc SET fullm_id = NULL, perfil_envio_id = NULL WHERE tienda_id = $1 AND fullm_id = $2 AND id NOT IN (SELECT unnest($3::int[]))`,
      [userId, fullmentId, ids]
    );
    for (const pid of ids) {
      const perfilId = productProfiles[pid] ? Number(productProfiles[pid]) : null;
      await pool.query(
        `UPDATE produc SET fullm_id = $2, perfil_envio_id = $3 WHERE tienda_id = $1 AND id = $4`,
        [userId, fullmentId, perfilId, pid]
      );
    }
  } else {
    await pool.query(
      `UPDATE produc SET fullm_id = NULL, perfil_envio_id = NULL WHERE tienda_id = $1 AND fullm_id = $2`,
      [userId, fullmentId]
    );
  }

  // Invalidate cache for this tienda because shipments/origin may have changed
  try {
    await invalidateRatesCacheForStore(userId).catch(() => {});
  } catch {}

  return getProductsByFullment(userId, fullmentId);
};

export const getCategories = async () => {
  const cached = await redisClient.get('categorias').catch(() => null);
  if (cached) return JSON.parse(cached);
  const { rows } = await pool.query(
    `SELECT id, nombre, descripcion FROM categorias ORDER BY nombre`
  );
  await redisClient.set('categorias', JSON.stringify(rows), { EX: 300 }).catch(() => {});
  return rows;
};

export const autoCategorizeUncategorizedProducts = async () => {
  const cats = await getCategories();
  if (cats.length === 0) return;

  const catMap = {};
  cats.forEach(c => {
    catMap[c.nombre.toLowerCase()] = c.id;
  });

  const defaultCatId = catMap['otros'] || cats[0]?.id;

  const { rows: products } = await pool.query(
    `SELECT id, name, description FROM produc WHERE categoria_id IS NULL`
  );

  for (const p of products) {
    const text = `${p.name || ''} ${p.description || ''}`.toLowerCase();
    let assignedId = defaultCatId;

    if (/celular|smartphone|laptop|computadora|audifono|tecnologia|pantalla|tv|reloj|mouse|teclado|usb|carga|camara|audio/i.test(text)) {
      assignedId = catMap['tecnología'] || defaultCatId;
    } else if (/camisa|pantalon|zapato|tenis|moda|ropa|vestido|chaqueta|gorra|bolso/i.test(text)) {
      assignedId = catMap['moda y calzado'] || defaultCatId;
    } else if (/cocina|sarten|hogar|casa|mueble|almohada|toalla|lampa|escoba|vaso/i.test(text)) {
      assignedId = catMap['hogar y cocina'] || defaultCatId;
    } else if (/crema|shampoo|belleza|maquillaje|perfume|labial|cabello|piel|jabón/i.test(text)) {
      assignedId = catMap['belleza y cuidado personal'] || defaultCatId;
    } else if (/deporte|balon|futbol|gym|pesa|bicicleta|entrenamiento|yoga/i.test(text)) {
      assignedId = catMap['deportes'] || defaultCatId;
    }

    if (assignedId) {
      await pool.query(`UPDATE produc SET categoria_id = $1 WHERE id = $2`, [assignedId, p.id]);
    }
  }
};

const SORT_CLAUSES = {
  relevance: 'p.id DESC',
  low_price: 'COALESCE(p.suggested_price, p.base_price) ASC NULLS LAST',
  high_price: 'COALESCE(p.suggested_price, p.base_price) DESC NULLS LAST',
  newest: 'p.created_at DESC',
  rating: '(SELECT COALESCE(AVG(rv.rating), 0) FROM reviews rv WHERE rv.product_id = p.id) DESC, review_count DESC',
};

// Costo del perfil de envío gratis aplicable a un producto según la ciudad del usuario
const freeShippingCostoExpr = (cityPh) => `COALESCE((
  SELECT pe.costo FROM perfiles_envio pe
  LEFT JOIN ciudades ci ON pe.ciudad_id = ci.id
  WHERE pe.tipo_envio = 'gratis' AND pe.estado = 'activo'
    AND (
      (pe.alcance = 'global' AND pe.tienda_id = p.tienda_id)
      OR (pe.alcance = 'ciudad' AND pe.id = p.perfil_envio_id AND ${cityPh}::text IS NOT NULL
          AND (LOWER(ci.nombre) = LOWER(${cityPh}::text) OR ci.id::text = ${cityPh}::text))
    )
  LIMIT 1
), 0)`;

const buildSearchWhere = (idx) => {
  const { search, city, cat, pMin, pMax, minRate, freeShip } = idx;
  const freeShippingExpr = `EXISTS (
    SELECT 1 
    FROM perfiles_envio pe
    LEFT JOIN ciudades ci ON pe.ciudad_id = ci.id
    WHERE pe.tipo_envio = 'gratis'
      AND (
        (pe.alcance = 'global' AND pe.tienda_id = p.tienda_id)
        OR (
          pe.alcance = 'ciudad' 
          AND pe.id = p.perfil_envio_id
          AND $${city}::text IS NOT NULL 
          AND (
            LOWER(ci.nombre) = LOWER($${city}::text)
            OR ci.id::text = $${city}::text
          )
        )
      )
  )`;
  const where = `
    ($${search}::text IS NULL OR $${search} = '' OR p.name ILIKE '%' || $${search} || '%' OR p.description ILIKE '%' || $${search} || '%')
    AND ($${cat}::int IS NULL OR p.categoria_id = $${cat})
    AND ($${pMin}::numeric IS NULL OR COALESCE(p.suggested_price, p.base_price) >= $${pMin})
    AND ($${pMax}::numeric IS NULL OR COALESCE(p.suggested_price, p.base_price) <= $${pMax})
    AND ($${minRate}::int IS NULL OR (
      SELECT COALESCE(AVG(rv.rating), 0) FROM reviews rv WHERE rv.product_id = p.id
    ) >= $${minRate})
    AND ($${freeShip}::boolean IS NOT TRUE OR ${freeShippingExpr})`;
  return where;
};

export const searchQueryProducts = async ({ q, limit = 12, offset = 0, ciudadName, categoriaId, sortBy, priceMin, priceMax, envioGratis, minRating }) => {
  const lim = Math.max(1, parseInt(limit, 10) || 12);
  const off = Math.max(0, parseInt(offset, 10) || 0);
  const search = q ? String(q).trim() : null;
  const city = ciudadName ? String(ciudadName).trim() : null;
  const catId = categoriaId ? parseInt(categoriaId, 10) : null;
  const pMin = priceMin !== undefined && priceMin !== null && priceMin !== '' ? Number(priceMin) : null;
  const pMax = priceMax !== undefined && priceMax !== null && priceMax !== '' ? Number(priceMax) : null;
  const freeShip = envioGratis === 'true' || envioGratis === true;
  const minRate = minRating !== undefined && minRating !== null && minRating !== '' ? Number(minRating) : null;
  const orderBy = SORT_CLAUSES[sortBy] || SORT_CLAUSES.relevance;

  const ratingSelect = `(
    SELECT COUNT(*) FROM reviews rv WHERE rv.product_id = p.id
  ) AS review_count,
  (
    SELECT COALESCE(AVG(rv.rating), 0)::numeric(3,2) FROM reviews rv WHERE rv.product_id = p.id
  ) AS avg_rating`;

  const freeShippingExpr = `EXISTS (
    SELECT 1 
    FROM perfiles_envio pe
    LEFT JOIN ciudades ci ON pe.ciudad_id = ci.id
    WHERE pe.tipo_envio = 'gratis'
      AND (
        (pe.alcance = 'global' AND pe.tienda_id = p.tienda_id)
        OR (
          pe.alcance = 'ciudad' 
          AND pe.id = p.perfil_envio_id
          AND $2::text IS NOT NULL 
          AND (
            LOWER(ci.nombre) = LOWER($2::text)
            OR ci.id::text = $2::text
          )
        )
      )
  )`;

  const mainIdx = { search: 1, city: 2, cat: 5, pMin: 6, pMax: 7, minRate: 8, freeShip: 9 };
  const countIdx = { search: 1, city: 2, cat: 3, pMin: 4, pMax: 5, minRate: 6, freeShip: 7 };

  const queryText = `
    SELECT 
      p.id,
      p.public_id,
      p.tienda_id,
      p.name,
      p.base_price,
      (COALESCE(p.suggested_price, p.base_price) + ${freeShippingCostoExpr('$2')}) AS suggested_price,
      p.stock_total,
      p.images,
      p.description,
      p.created_at,
      c.nombre AS ciudad_nombre,
      cat.id AS categoria_id,
      cat.nombre AS categoria_nombre,
      ${ratingSelect},
      (
        SELECT json_build_object(
          'tipo', o.tipo_descuento,
          'valor', o.valor_descuento,
          'alcance', o.alcance
        )
        FROM ofertas o
        WHERE o.tienda_id = p.tienda_id 
          AND o.estado = 'activo'
          AND (o.fecha_inicio IS NULL OR o.fecha_inicio <= NOW())
          AND (o.fecha_fin IS NULL OR o.fecha_fin >= NOW())
          AND (
            o.alcance = 'global'
            OR (o.alcance = 'ciudad' AND (o.ciudad_id = c.id OR ($2::text IS NOT NULL AND LOWER(c.nombre) = LOWER($2::text))))
            OR (o.alcance = 'productos' AND EXISTS (
              SELECT 1 FROM oferta_productos op WHERE op.oferta_id = o.id AND op.producto_id = p.id
            ))
          )
        ORDER BY (o.alcance = 'ciudad') DESC, o.valor_descuento DESC
        LIMIT 1
      ) AS oferta_activa,
      ${freeShippingExpr} AS envio_gratis
    FROM produc p
    LEFT JOIN fullments f ON p.fullm_id = f.id
    LEFT JOIN ciudades c ON f.ciudad_id = c.id
    LEFT JOIN categorias cat ON p.categoria_id = cat.id
    WHERE ${buildSearchWhere(mainIdx)}
    ORDER BY ${orderBy}
    LIMIT $3 OFFSET $4
  `;

  const countQueryText = `
    SELECT COUNT(*) AS total
    FROM produc p
    WHERE ${buildSearchWhere(countIdx)}
  `;

  const values = [search, city, lim, off, catId, pMin, pMax, minRate, freeShip];
  const countValues = [search, city, catId, pMin, pMax, minRate, freeShip];

  const [result, countResult] = await Promise.all([
    pool.query(queryText, values),
    pool.query(countQueryText, countValues)
  ]);

  return {
    products: result.rows,
    total: parseInt(countResult.rows[0]?.total || 0, 10),
    limit: lim,
    offset: off
  };
};

export const getUserFavorites = async (userId) => {
  const { rows } = await pool.query(
    `SELECT product_id FROM favoritos WHERE user_id = $1`,
    [userId]
  );
  return rows.map(r => r.product_id);
};

export const toggleProductFavorite = async (userId, productId) => {
  const pId = parseInt(productId, 10);
  if (!pId) {
    throw new Error('ID de producto inválido.');
  }

  const existing = await pool.query(
    `SELECT id FROM favoritos WHERE user_id = $1 AND product_id = $2`,
    [userId, pId]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `DELETE FROM favoritos WHERE user_id = $1 AND product_id = $2`,
      [userId, pId]
    );
    return { favorited: false };
  } else {
    await pool.query(
      `INSERT INTO favoritos (user_id, product_id) VALUES ($1, $2) ON CONFLICT (user_id, product_id) DO NOTHING`,
      [userId, pId]
    );
    return { favorited: true };
  }
};

export const getProductByPublicId = async (identifier, ciudad = null) => {
  const cacheKey = `product:detail:${identifier}:${String(ciudad || '').toLowerCase()}`;
  const cached = await redisClient.get(cacheKey).catch(() => null);
  if (cached) return JSON.parse(cached);

  let queryText = `
    SELECT p.*, c.nombre AS ciudad_nombre, cat.nombre AS categoria_nombre,
      (COALESCE(p.suggested_price, p.base_price) + ${freeShippingCostoExpr('$2')}) AS suggested_price_efectivo,
      (
        SELECT COUNT(*) FROM reviews rv WHERE rv.product_id = p.id
      ) AS review_count,
      (
        SELECT COALESCE(AVG(rv.rating), 0)::numeric(3,2) FROM reviews rv WHERE rv.product_id = p.id
      ) AS avg_rating,
      (
        SELECT json_build_object(
          'tipo', o.tipo_descuento,
          'valor', o.valor_descuento,
          'alcance', o.alcance
        )
        FROM ofertas o
        WHERE o.tienda_id = p.tienda_id
          AND o.estado = 'activo'
          AND (o.fecha_inicio IS NULL OR o.fecha_inicio <= NOW())
          AND (o.fecha_fin IS NULL OR o.fecha_fin >= NOW())
          AND (
            o.alcance = 'global'
            OR (o.alcance = 'ciudad' AND o.ciudad_id = c.id)
            OR (o.alcance = 'productos' AND EXISTS (
              SELECT 1 FROM oferta_productos op WHERE op.oferta_id = o.id AND op.producto_id = p.id
            ))
          )
        ORDER BY (o.alcance = 'ciudad') DESC, o.valor_descuento DESC
        LIMIT 1
      ) AS oferta_activa
    FROM produc p
    LEFT JOIN fullments f ON p.fullm_id = f.id
    LEFT JOIN ciudades c ON f.ciudad_id = c.id
    LEFT JOIN categorias cat ON p.categoria_id = cat.id
  `;
  let values = [];
  if (/^\d+$/.test(identifier)) {
    queryText += ` WHERE p.id = $1 LIMIT 1`;
    values = [parseInt(identifier, 10), ciudad];
  } else {
    queryText += ` WHERE p.public_id = $1 LIMIT 1`;
    values = [String(identifier), ciudad];
  }

  const { rows } = await pool.query(queryText, values);
  if (rows[0]) {
    const row = rows[0];
    const producto = {
      ...row,
      suggested_price: row.suggested_price_efectivo ?? row.suggested_price,
      images: typeof row.images === 'string' ? JSON.parse(row.images) : row.images,
      variants: typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants,
      warranties: typeof row.warranties === 'string' ? JSON.parse(row.warranties) : row.warranties,
      support: typeof row.support === 'string' ? JSON.parse(row.support) : row.support,
    };
    await redisClient.set(cacheKey, JSON.stringify(producto), { EX: 60 }).catch(() => {});
    return producto;
  }

  return await obtenerProductoPorId(identifier);
};

export const reserveStockForSession = async (items, identifier) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No hay productos en el carrito para apartar stock.');
  }

  const reservationKey = `cart:reserve:${identifier}`;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingRes = await redisClient.get(reservationKey);
    if (existingRes) {
      try {
        const oldItems = JSON.parse(existingRes);
        for (const oldItem of oldItems) {
          await client.query(
            `UPDATE produc SET stock_total = stock_total + $1 WHERE id = $2`,
            [oldItem.quantity, oldItem.id]
          );
        }
      } catch {}
    }

    for (const item of items) {
      const pId = Number(item.id);
      const qty = Number(item.quantity) || 1;

      const result = await client.query(
        `UPDATE produc SET stock_total = stock_total - $1 WHERE id = $2 AND stock_total >= $1`,
        [qty, pId]
      );

      if (result.rowCount === 0) {
        const { rows } = await client.query(`SELECT stock_total FROM produc WHERE id = $1 LIMIT 1`, [pId]);
        if (!rows[0]) {
          throw new Error(`Producto con ID ${pId} no encontrado.`);
        }
        throw new Error(`Stock insuficiente para el producto (Disponible: ${rows[0].stock_total}, Solicitado: ${qty}).`);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await redisClient.set(reservationKey, JSON.stringify(items), { EX: 900 });

  return { reserved: true, expiresInSeconds: 900 };
};

export const releaseStockForSession = async (identifier) => {
  const reservationKey = `cart:reserve:${identifier}`;
  const existingRes = await redisClient.get(reservationKey);
  if (existingRes) {
    try {
      const oldItems = JSON.parse(existingRes);
      for (const oldItem of oldItems) {
        await pool.query(
          `UPDATE produc SET stock_total = stock_total + $1 WHERE id = $2`,
          [oldItem.quantity, oldItem.id]
        );
      }
      await redisClient.del(reservationKey);
    } catch {}
  }
  return { released: true };
};

export const migrateCartSession = async (guestHash, userId) => {
  if (!guestHash || !userId) return { migrated: false };
  const guestKey = `cart:reserve:${guestHash}`;
  const userKey = `cart:reserve:user_${userId}`;

  const guestData = await redisClient.get(guestKey);
  if (guestData) {
    const ttl = await redisClient.ttl(guestKey);
    await redisClient.set(userKey, guestData, { EX: ttl > 0 ? ttl : 900 });
    await redisClient.del(guestKey);
  }

  // Vincular órdenes del guest al usuario autenticado
  await pool.query(
    `UPDATE orders SET user_id = $1 WHERE guest_hash = $2 AND (user_id IS NULL OR user_id = 0)`,
    [userId, guestHash]
  );

  return { migrated: true };
};

export const calculateShippingCost = async (items, destinationCiudadId) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { shipping_cost: 0, free_shipping: false };
  }

  let tiendaId = items[0]?.tienda_id;
  if (!tiendaId && items[0]?.id) {
    const { rows: prodRows } = await pool.query(`SELECT tienda_id FROM produc WHERE id = $1 LIMIT 1`, [items[0].id]);
    tiendaId = prodRows[0]?.tienda_id;
  }

  let storeFree = false;
  if (tiendaId) {
    const { rows: storeGlobal } = await pool.query(`
      SELECT 1 FROM perfiles_envio WHERE tienda_id = $1 AND tipo_envio = 'gratis' AND alcance = 'global' LIMIT 1
    `, [tiendaId]);
    if (storeGlobal.length > 0) {
      storeFree = true;
    }
  }

  if (storeFree) {
    const perItem = items.map(it => ({ itemId: it.id, price: Number(it.price || 0), shippingCost: 0, isFree: true }));
    let productsTotal = 0;
    for (const it of items) {
      const price = Number(it.price || 0) || 0;
      const qty = Number(it.quantity || 1) || 1;
      productsTotal += price * qty;
    }
    return {
      shipping_cost: 0,
      shipments_count: 1,
      shipments_message: 'Envío gratis global aplicado para toda la tienda.',
      grouped: [],
      per_item: perItem,
      products_total: productsTotal,
      grand_total: productsTotal,
      free_shipping: true
    };
  }

  // We'll produce grouped quotes and per-item quotes.
  const grouped = {};

  // Helper to get product details (product_owner.idbusiness and fullm_id -> ciudad)
  // For efficiency, we'll fetch produc rows for item ids
  const productIds = items.filter(i => i.id).map(i => Number(i.id)).filter(Boolean);
  let productRows = [];
  if (productIds.length > 0) {
    const { rows } = await pool.query(`SELECT id, product_owner, fullm_id, tienda_id, peso, largo, alto, ancho, tipo_empaque_id, perfil_envio_id, suggested_price, base_price FROM produc WHERE id = ANY($1::int[])`, [productIds]);
    productRows = rows;
    // If any product references tipo_empaque_id, fetch those packagings
    const tipoIds = Array.from(new Set(productRows.map(p => p.tipo_empaque_id).filter(Boolean)));
    let tipoMap = new Map();
    if (tipoIds.length > 0) {
      const { rows: tipos } = await pool.query(`SELECT id, nombre, peso, largo, alto, ancho FROM tipo_empaque WHERE id = ANY($1::int[])`, [tipoIds]);
      tipos.forEach(t => tipoMap.set(t.id, t));
    }
    // Attach tipo_empaque data to productRows
    for (const p of productRows) {
      if (p.tipo_empaque_id) p._tipoEmpaque = tipoMap.get(p.tipo_empaque_id) || null;
      // Ensure product_owner JSON is parsed to object and normalize key names
      try {
        if (typeof p.product_owner === 'string') {
          p.product_owner = JSON.parse(p.product_owner);
        }
      } catch (e) {
        // leave as-is if parsing fails
      }
      p._productOwner = p.product_owner || {};
    }
  }

  const prodMap = new Map();
  for (const p of productRows) prodMap.set(p.id, p);

  // Build groups by idbusiness + originCiudadId
  // Precompute fullment-based free-shipping info and product-level free-shipping info
  const perfilEnvioIds = Array.from(new Set(productRows.map(p => p.perfil_envio_id).filter(Boolean)));
  const freePerfilCosto = new Map();
  if (perfilEnvioIds.length > 0) {
    const { rows: peRows } = await pool.query(`
      SELECT pe.id, pe.alcance, pe.ciudad_id, pe.costo
      FROM perfiles_envio pe
      WHERE pe.id = ANY($1::int[]) AND pe.tipo_envio = 'gratis'
    `, [perfilEnvioIds]);
    for (const r of peRows) {
      const applies = r.alcance === 'global' || (r.alcance === 'ciudad' && r.ciudad_id !== null && Number(r.ciudad_id) === Number(destinationCiudadId));
      if (applies) freePerfilCosto.set(r.id, Number(r.costo) || 0);
    }
  }

  for (const item of items) {
    const p = prodMap.get(Number(item.id));
    let idbusiness = 'unknown';
    if (p?._productOwner) {
      idbusiness = p._productOwner.idbusiness || p._productOwner.idBusiness || p._productOwner.id || idbusiness;
    } else if (item.product_owner) {
      try {
        const io = typeof item.product_owner === 'string' ? JSON.parse(item.product_owner) : item.product_owner;
        idbusiness = io?.idbusiness || io?.idBusiness || io?.id || idbusiness;
      } catch (e) {}
    }
    let originCiudadId = null;
    if (p?.fullm_id) {
      const { rows } = await pool.query(`SELECT ciudad_id FROM fullments WHERE id = $1 LIMIT 1`, [p.fullm_id]);
      originCiudadId = rows[0]?.ciudad_id || null;
    }
    if (!originCiudadId) originCiudadId = item.fullm_id || null;

    const itemPerfilId = p?.perfil_envio_id || null;
    let freeCosto = null;
    if (itemPerfilId && freePerfilCosto.has(Number(itemPerfilId))) {
      freeCosto = Number(freePerfilCosto.get(Number(itemPerfilId))) || 0;
    }
    const isFree = freeCosto !== null;
    const precioBase = Number(p?.suggested_price ?? p?.base_price ?? item.price ?? 0);
    const precioEfectivo = isFree ? precioBase + freeCosto : precioBase;

    const key = `${String(idbusiness)}::${String(originCiudadId)}::${String(destinationCiudadId)}`;
    if (!grouped[key]) grouped[key] = { idbusiness, originCiudadId, destinationCiudadId, items: [] };
    grouped[key].items.push({ ...item, _productRow: p, _isFree: Boolean(isFree), _precioUnitario: precioEfectivo });
  }

  const groupedResults = [];
  const perItemResults = [];

  // Parallelize group cotizations to reduce latency and do per-group 3D packing
  const groupedResultsLocal = [];
  const perItemResultsLocal = [];
  const groupKeys = Object.keys(grouped);

  // packing helper: simple stacking + first-fit by volume with rotation allowed
  const packItemsIntoBoxes = (items) => {
    const maxBox = {
      length: Number(process.env.ENVIA_MAX_BOX_LENGTH || 120),
      width: Number(process.env.ENVIA_MAX_BOX_WIDTH || 80),
      height: Number(process.env.ENVIA_MAX_BOX_HEIGHT || 80)
    };
    const units = [];
    for (const it of items) {
      const tipo = it._productRow?._tipoEmpaque;
      const qty = Number(it.quantity || 1);
      const l = Number(it.length || (tipo?.largo) || it._productRow?.largo || process.env.ENVIA_DEFAULT_LENGTH || 10);
      const h = Number(it.height || (tipo?.alto) || it._productRow?.alto || process.env.ENVIA_DEFAULT_HEIGHT || 10);
      const w = Number(it.width || (tipo?.ancho) || it._productRow?.ancho || process.env.ENVIA_DEFAULT_WIDTH || 10);
      const weight = Number(it.weight || (tipo?.peso) || it._productRow?.peso || process.env.ENVIA_DEFAULT_WEIGHT || 1);
      for (let i = 0; i < qty; i++) {
        const dims = [l, w, h].sort((a, b) => b - a); // allow rotation
        units.push({ id: it.id, name: it.name, l: dims[0], w: dims[1], h: dims[2], weight, volume: dims[0] * dims[1] * dims[2], tipoId: it._productRow?.tipo_empaque_id || null, _isFree: Boolean(it._isFree), _price: Number(it._precioUnitario) || 0 });
      }
    }
    units.sort((a, b) => b.volume - a.volume);
    const boxes = [];
    for (const u of units) {
      let placed = false;
      for (const b of boxes) {
        const newLength = Math.max(b.length, u.l);
        const newWidth = Math.max(b.width, u.w);
        const newHeight = b.height + u.h; // stack
        if (newLength <= maxBox.length && newWidth <= maxBox.width && newHeight <= maxBox.height) {
          b.items.push(u);
          b.length = newLength;
          b.width = newWidth;
          b.height = newHeight;
          b.weight += u.weight;
          b.volume += u.volume;
          placed = true;
          break;
        }
      }
      if (!placed) {
        // create new box
        boxes.push({ items: [u], length: u.l, width: u.w, height: u.h, weight: u.weight, volume: u.volume });
      }
    }
    return boxes.map((b, i) => ({ id: `pkg_${i+1}`, items: b.items, length: Math.max(1, Math.round(b.length)), width: Math.max(1, Math.round(b.width)), height: Math.max(1, Math.round(b.height)), weight: Math.max(0.001, b.weight), volume: b.volume }));
  };

  const groupPromises = groupKeys.map(async (key) => {
    const grp = grouped[key];
    const freeItems = grp.items.filter(it => it._isFree);
    const nonFreeItems = grp.items.filter(it => !it._isFree);

    let groupOptions = [];
    let selectedCarrier = null;

    if (storeFree || nonFreeItems.length === 0) {
      // All items in group are free -> envío gratis (el costo ya está incluido en el precio unitario)
      for (const it of grp.items) {
        perItemResultsLocal.push({ itemId: it.id, price: Number(it._precioUnitario) || 0, shippingCost: 0, shippingOptions: [], isFree: true });
      }
      groupedResultsLocal.push({ key, idbusiness: grp.idbusiness, originCiudadId: grp.originCiudadId, destinationCiudadId: grp.destinationCiudadId, items: grp.items, shippingCost: 0, shippingOptions: [], selected_carrier: null });
    } else {
      // Some or all items are not free -> quote ONLY nonFreeItems
      for (const it of freeItems) {
        perItemResultsLocal.push({ itemId: it.id, price: Number(it._precioUnitario) || 0, shippingCost: 0, shippingOptions: [], isFree: true });
      }

      const packages = packItemsIntoBoxes(nonFreeItems);
      const pkgPromises = packages.map(async (pkg) => {
        const pkgItem = [{ id: pkg.id, name: 'Paquete', quantity: 1, weight: pkg.weight, length: pkg.length, height: pkg.height, width: pkg.width, tienda_id: grp.items[0]?.tienda_id }];
        try {
          const { shippingOptions, shippingCost } = await getShippingOptionsFromEnvia(pkgItem, grp.destinationCiudadId, grp.items[0]?.tienda_id || tiendaId);
          return { pkg, shippingOptions, shippingCost };
        } catch (err) {
          console.error('Error cotizando paquete Envia:', err.message);
          return { pkg, shippingOptions: [], shippingCost: Number(process.env.DEFAULT_SHIPPING_COST || 15000) };
        }
      });
      const pkgResults = await Promise.all(pkgPromises);

      for (const r of pkgResults) {
        const pkg = r.pkg;
        const pkgItems = pkg.items;
        const pkgWeightSum = pkgItems.reduce((s, ii) => s + (ii.weight || 0), 0) || 1;
        for (const ii of pkgItems) {
          const share = (ii.weight || 0) / pkgWeightSum;
          const itemCost = Math.round((r.shippingCost || 0) * share);
          perItemResultsLocal.push({ itemId: ii.id, price: Number(ii._price) || 0, shippingCost: itemCost, shippingOptions: r.shippingOptions, isFree: false });
        }
      }

      groupOptions = pkgResults.flatMap(r => r.shippingOptions || []);
      if (groupOptions.length > 0) {
        const sorted = groupOptions.slice().sort((a, b) => (Number(a.price || a.prize || a.total || a.servicePrice || a.basePrice || 0) - Number(b.price || b.prize || b.total || b.servicePrice || b.basePrice || 0)));
        const best = sorted[0];
        selectedCarrier = {
          carrier: best.carrier || best.carrierDescription || best.provider || best.name || null,
          service: best.service || best.serviceName || best.serviceDescription || null,
          price: Number(best.price || best.totalprice || best.totalPrice || best.rate || best.cost || best.total || best.servicePrice || best.basePrice || 0)
        };
      }

      const groupItemCosts = perItemResultsLocal.filter(pi => nonFreeItems.some(gi => String(gi.id) === String(pi.itemId))).reduce((s, pi) => s + pi.shippingCost, 0);
      const shippingCost = groupItemCosts;

      groupedResultsLocal.push({ key, idbusiness: grp.idbusiness, originCiudadId: grp.originCiudadId, destinationCiudadId: grp.destinationCiudadId, items: grp.items, shippingCost, shippingOptions: groupOptions, selected_carrier: selectedCarrier });
    }
  });

  await Promise.all(groupPromises);

  // move local results into final arrays
  groupedResults.push(...groupedResultsLocal);
  perItemResults.push(...perItemResultsLocal);

  // remove freeGroups usage (we instead include free items in grouped and flagged _isFree)

  // Determine overall shipping cost as sum of cheapest option per group
  let overallCost = 0;
  for (const g of groupedResults) {
    overallCost += Number(g.shippingCost || 0);
  }

  // Also compute products total (sum effective price * quantity)
  let productsTotal = 0;
  for (const grp of Object.values(grouped)) {
    for (const it of grp.items) {
      const price = Number(it._precioUnitario ?? it.price ?? 0) || 0;
      const qty = Number(it.quantity || 1) || 1;
      productsTotal += price * qty;
    }
  }

  const grandTotal = productsTotal + overallCost;

  const shipmentsCount = groupedResults.length || 0;
  const shipmentsMessage = `Recibirás un total de ${shipmentsCount} envío${shipmentsCount === 1 ? '' : 's'}.`;

  const allFree = perItemResults.length > 0 && perItemResults.every(pi => Number(pi.shippingCost || 0) === 0);

  return {
    shipping_cost: overallCost,
    shipments_count: shipmentsCount,
    shipments_message: shipmentsMessage,
    grouped: groupedResults,
    per_item: perItemResults,
    products_total: productsTotal,
    grand_total: grandTotal,
    free_shipping: allFree
  };
};

export const createMercadoPagoPreferenceForCart = async (userId, items, shippingCost, customerInfo, guestHash) => {
  await reserveStockForSession(items, guestHash || `user_${userId}`);

  let tiendaId = items[0]?.tienda_id;
  if (!tiendaId && items[0]?.id) {
    const { rows: prodRows } = await pool.query(`SELECT tienda_id FROM produc WHERE id = $1 LIMIT 1`, [items[0].id]);
    tiendaId = prodRows[0]?.tienda_id;
  }

  if (!tiendaId) {
    const { rows: tiendaRows } = await pool.query(`SELECT usrid FROM tiendas LIMIT 1`);
    tiendaId = tiendaRows[0]?.usrid || 1;
  }

  const { rows: mpRows } = await pool.query(
    `SELECT access_token, public_key, mode FROM checkout_integrations WHERE tienda_id = $1 AND provider = 'mercadopago' ORDER BY (mode = 'produccion') DESC LIMIT 1`,
    [tiendaId]
  );
  const mpInt = mpRows[0];

  if (!mpInt?.access_token) {
    throw new Error('La tienda no tiene configurada la integración de Mercado Pago.');
  }
  mpInt.access_token = decryptSecret(mpInt.access_token);

  const client = new MercadoPagoConfig({ accessToken: mpInt.access_token });
  const preference = new Preference(client);

  const prefResponse = await preference.create({
    body: {
      items: [
        ...items.map(i => ({
          title: String(i.name || 'Producto'),
          quantity: Number(i.quantity) || 1,
          unit_price: Number(i.price) || 0,
          currency_id: 'COP'
        })),
        ...(shippingCost > 0 ? [{
          title: 'Envío (ENVIA)',
          quantity: 1,
          unit_price: Number(shippingCost),
          currency_id: 'COP'
        }] : [])
      ],
      payer: {
        phone: { number: String(customerInfo.telefono || '') },
        address: { street_name: String(customerInfo.direccion || '') }
      },
      back_urls: {
        success: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/cart?status=success`,
        failure: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/cart?status=failure`,
        pending: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/cart?status=pending`
      }
    }
  });

  return {
    init_point: prefResponse.init_point,
    sandbox_init_point: prefResponse.sandbox_init_point,
    preferenceId: prefResponse.id,
    public_key: mpInt.public_key,
    mode: mpInt.mode
  };
};

export const processMpPaymentForCart = async (userId, formData, preferenceId, customerInfo, guestHash, shippingCost, shippingPayload, inputItems) => {
  const { rows: mpRows } = await pool.query(
    `SELECT access_token, public_key, mode FROM checkout_integrations WHERE provider = 'mercadopago' ORDER BY (mode = 'produccion') DESC LIMIT 1`
  );
  const mpInt = mpRows[0];

  if (!mpInt?.access_token) {
    throw new Error('La tienda no tiene configurada la integración de Mercado Pago.');
  }
  mpInt.access_token = decryptSecret(mpInt.access_token);

  const client = new MercadoPagoConfig({ accessToken: mpInt.access_token });
  const payment = new Payment(client);

  const paymentResponse = await payment.create({ body: formData });

  const status = paymentResponse?.status;
  const isSuccessful = status === 'approved' || status === 'pending' || status === 'in_process' || status === 'authorized' || (paymentResponse && !['rejected', 'cancelled', 'refunded', 'charged_back'].includes(status));

  if (paymentResponse && isSuccessful) {
    let items = Array.isArray(inputItems) && inputItems.length > 0 ? inputItems : null;
    let foundKey = null;

    if (!items) {
      const identifiers = [
        guestHash ? `cart:reserve:${guestHash}` : null,
        userId ? `cart:reserve:user_${userId}` : null,
        `cart:reserve:guest_anonymous`
      ].filter(Boolean);

      for (const key of identifiers) {
        const data = await redisClient.get(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed.length > 0) {
              items = parsed;
              foundKey = key;
              break;
            }
          } catch {}
        }
      }
    }

    if (items && items.length > 0) {
      await recordPurchaseForUser(userId, items, {
        preferenceId,
        paymentResponse,
        customerInfo,
        guestHash,
        shippingCost,
        shippingPayload
      });
      if (foundKey) {
        await redisClient.del(foundKey);
      }
    }
  }

  return paymentResponse;
};

export const getFavoriteProductsDetails = async (userId, ciudad = null) => {
  const { rows } = await pool.query(
    `SELECT p.*, f.created_at as favorited_at,
       (COALESCE(p.suggested_price, p.base_price) + ${freeShippingCostoExpr('$2')}) AS suggested_price_efectivo
     FROM favoritos f
     JOIN produc p ON f.product_id = p.id
     WHERE f.user_id = $1
     ORDER BY f.created_at DESC`,
    [userId, ciudad]
  );
  return rows.map(r => ({ ...r, suggested_price: r.suggested_price_efectivo ?? r.suggested_price }));
};

export const getProductReviews = async (productId) => {
  const pId = parseInt(productId, 10);
  if (!pId) return { reviews: [], summary: null };

  const cacheKey = `product:reviews:${pId}`;
  const cached = await redisClient.get(cacheKey).catch(() => null);
  if (cached) return JSON.parse(cached);

  const { rows } = await pool.query(
    `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS user_name, u.avatar_url AS user_avatar
     FROM reviews r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.product_id = $1
     ORDER BY r.created_at DESC`,
    [pId]
  );

  const { rows: summaryRows } = await pool.query(
    `SELECT
       COALESCE(AVG(rating), 0)::numeric(3,2) AS avg_rating,
       COUNT(*) AS review_count,
       COUNT(*) FILTER (WHERE rating = 5) AS r5,
       COUNT(*) FILTER (WHERE rating = 4) AS r4,
       COUNT(*) FILTER (WHERE rating = 3) AS r3,
       COUNT(*) FILTER (WHERE rating = 2) AS r2,
       COUNT(*) FILTER (WHERE rating = 1) AS r1
     FROM reviews
     WHERE product_id = $1`,
    [pId]
  );

  const s = summaryRows[0] || {};
  const result = {
    reviews: rows,
    summary: {
      avg_rating: Number(s.avg_rating || 0),
      review_count: Number(s.review_count || 0),
      distribution: {
        5: Number(s.r5 || 0),
        4: Number(s.r4 || 0),
        3: Number(s.r3 || 0),
        2: Number(s.r2 || 0),
        1: Number(s.r1 || 0),
      },
    },
  };
  await redisClient.set(cacheKey, JSON.stringify(result), { EX: 60 }).catch(() => {});
  return result;
};

export const getUserReviewForProduct = async (userId, productId) => {
  const pId = parseInt(productId, 10);
  if (!pId) return null;
  const { rows } = await pool.query(
    `SELECT id, product_id, order_id, rating, comment, created_at, updated_at
     FROM reviews
     WHERE product_id = $1 AND user_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [pId, userId]
  );
  return rows[0] || null;
};

export const getUserReviewStatus = async (userId, productId) => {
  const pId = parseInt(productId, 10);
  const review = await getUserReviewForProduct(userId, pId);
  if (review) return { review, canReview: false };
  const shipment = await findDeliveredShipmentForReview(userId, pId);
  return { review: null, canReview: Boolean(shipment) };
};

const isShipmentDelivered = (status) => {
  const s = String(status || '').toLowerCase();
  return ['entregado', 'delivered', 'recibido', 'completado', 'complete', 'confirmed'].some(k => s.includes(k));
};

const findDeliveredShipmentForReview = async (userId, productId) => {
  const { rows } = await pool.query(
    `SELECT o.id, o.order_number, oi.shipment_id, os.fulfillment_status
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN order_shipments os ON os.id = oi.shipment_id
     WHERE o.user_id = $1
       AND oi.product_id = $2
       AND LOWER(COALESCE(os.fulfillment_status, '')) IN ('entregado', 'delivered', 'recibido', 'completado', 'complete')
       AND NOT EXISTS (
         SELECT 1 FROM reviews r WHERE r.order_id = o.id AND r.product_id = $2
       )
     ORDER BY os.updated_at DESC
     LIMIT 1`,
    [userId, productId]
  );
  return rows[0] || null;
};

export const getOrderReviewsStatus = async (orderId, userId) => {
  if (!userId || !orderId) return {};

  const { rows: items } = await pool.query(
    `SELECT oi.product_id, oi.shipment_id, os.fulfillment_status
     FROM order_items oi
     JOIN order_shipments os ON os.id = oi.shipment_id
     WHERE oi.order_id = $1`,
    [orderId]
  );

  const { rows: reviews } = await pool.query(
    `SELECT product_id, shipment_id, rating, comment, created_at
     FROM reviews WHERE order_id = $1 AND user_id = $2`,
    [orderId, userId]
  );

  const byProduct = {};
  for (const r of reviews) byProduct[String(r.product_id)] = r;

  const result = {};
  for (const item of items) {
    const delivered = isShipmentDelivered(item.fulfillment_status);
    const existing = byProduct[String(item.product_id)];
    result[String(item.product_id)] = {
      shipment_id: item.shipment_id,
      delivered,
      canReview: delivered && !existing,
      review: existing || null,
    };
  }
  return result;
};

export const addProductReview = async (userId, productId, { rating, comment }) => {
  const pId = parseInt(productId, 10);
  const rate = parseInt(rating, 10);
  if (!pId) throw new Error('ID de producto inválido.');
  if (!rate || rate < 1 || rate > 5) throw new Error('La calificación debe estar entre 1 y 5 estrellas.');

  const shipment = await findDeliveredShipmentForReview(userId, pId);
  if (!shipment) {
    throw new Error('Solo puedes calificar productos cuyo envío haya sido entregado.');
  }

  const text = comment && String(comment).trim() ? String(comment).trim().slice(0, 2000) : null;

  const { rows } = await pool.query(
    `INSERT INTO reviews (product_id, user_id, order_id, shipment_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (product_id, user_id, order_id) DO NOTHING
     RETURNING id, product_id, order_id, shipment_id, rating, comment, created_at`,
    [pId, userId, shipment.id, shipment.shipment_id || null, rate, text]
  );
  if (rows.length === 0) {
    throw new Error('Ya calificaste este producto en esta compra.');
  }
  await invalidateProductCache(pId).catch(() => {});
  return rows[0];
};

export const updateProductReview = async (userId, productId, { rating, comment }) => {
  const pId = parseInt(productId, 10);
  const rate = parseInt(rating, 10);
  if (!pId) throw new Error('ID de producto inválido.');
  if (!rate || rate < 1 || rate > 5) throw new Error('La calificación debe estar entre 1 y 5 estrellas.');
  const text = comment && String(comment).trim() ? String(comment).trim().slice(0, 2000) : null;

  const { rows } = await pool.query(
    `UPDATE reviews SET rating = $3, comment = $4, updated_at = NOW()
     WHERE product_id = $1 AND user_id = $2
     RETURNING id, product_id, order_id, rating, comment, updated_at`,
    [pId, userId, rate, text]
  );
  if (rows.length === 0) {
    throw new Error('No tienes una reseña para este producto.');
  }
  await invalidateProductCache(pId).catch(() => {});
  return rows[0];
};

export const deleteProductReview = async (userId, productId) => {
  const pId = parseInt(productId, 10);
  if (!pId) throw new Error('ID de producto inválido.');
  const { rowCount } = await pool.query(
    `DELETE FROM reviews WHERE product_id = $1 AND user_id = $2`,
    [pId, userId]
  );
  if (rowCount === 0) {
    throw new Error('No tienes una reseña para este producto.');
  }
  await invalidateProductCache(pId).catch(() => {});
  return { deleted: true };
};

export const recordPurchaseForUser = async (userId, items, options = {}) => {
  const {
    preferenceId = null,
    paymentResponse = null,
    customerInfo = {},
    guestHash = null,
    shippingCost = 0,
    shippingPayload = null
  } = options;

  let tiendaId = items[0]?.tienda_id;
  if (!tiendaId && items[0]?.id) {
    const { rows: prodRows } = await pool.query(`SELECT tienda_id FROM produc WHERE id = $1 LIMIT 1`, [items[0].id]);
    tiendaId = prodRows[0]?.tienda_id;
  }
  if (!tiendaId) {
    const { rows: tiendaRows } = await pool.query(`SELECT usrid FROM tiendas LIMIT 1`);
    tiendaId = tiendaRows[0]?.usrid || 1;
  }

  const mercadopagoPaymentId = paymentResponse?.id ? String(paymentResponse.id) : null;
  const status = paymentResponse?.status === 'approved' ? 'Completado' : (paymentResponse?.status || 'Completado');
  const payloadJson = paymentResponse ? JSON.stringify(paymentResponse) : null;

  const departamentoId = customerInfo.departamento_id ? Number(customerInfo.departamento_id) : null;
  const ciudadId = customerInfo.ciudad_id ? Number(customerInfo.ciudad_id) : null;
  const direccion = customerInfo.direccion || null;
  const telefono = customerInfo.telefono || null;
  const customerName = customerInfo.customer_name || paymentResponse?.payer?.first_name || null;
  const identificationType = customerInfo.identification_type || paymentResponse?.payer?.identification?.type || null;
  const identificationNumber = customerInfo.identification_number || paymentResponse?.payer?.identification?.number || null;

  const totalAmount = items.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.quantity || 1)), 0) + Number(shippingCost || 0);
  const orderHash = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const { rows: orderRows } = await pool.query(
    `INSERT INTO orders (
       tienda_id, user_id, guest_hash, preference_id, mercadopago_payment_id,
       status, amount, payload, departamento_id, ciudad_id, direccion, telefono,
       shipping_cost, shipping_payload, customer_name, identification_type, identification_number,
       order_hash, created_at
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8::jsonb, $9, $10, $11, $12,
       $13, $14::jsonb, $15, $16, $17,
       $18, NOW()
     ) RETURNING id`,
    [
      tiendaId, userId, guestHash, preferenceId, mercadopagoPaymentId,
      status, totalAmount, payloadJson, departamentoId, ciudadId, direccion, telefono,
      shippingCost, shippingPayload ? JSON.stringify(shippingPayload) : null, customerName, identificationType, identificationNumber,
      orderHash
    ]
  );

  const orderId = orderRows[0].id;
  const orderNumber = String(100000 + orderId);
  await pool.query(`UPDATE orders SET order_number = $1 WHERE id = $2`, [orderNumber, orderId]);
  const shipmentsList = shippingPayload?.grouped || shippingPayload?.shipments || (Array.isArray(shippingPayload) ? shippingPayload : null);

  if (Array.isArray(shipmentsList) && shipmentsList.length > 0) {
    let shipmentNumber = 1;
    for (const sh of shipmentsList) {
      const carrier = sh.selected_carrier?.carrier || sh.carrier || 'Envío Estándar';
      const service = sh.selected_carrier?.service || sh.service || 'Estándar';
      const shCost = Number(sh.shippingCost || sh.price || 0);
      const groupKey = sh.key || null;
      const idbusiness = sh.idbusiness ? String(sh.idbusiness) : null;
      const originCiudadId = sh.originCiudadId ? Number(sh.originCiudadId) : null;
      const destinationCiudadId = sh.destinationCiudadId ? Number(sh.destinationCiudadId) : ciudadId;

      const { rows: shipRows } = await pool.query(
        `INSERT INTO order_shipments (
           order_id, shipment_number, carrier, service, shipping_cost, payload,
           group_key, idbusiness, origin_ciudad_id, destination_ciudad_id, created_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6::jsonb,
           $7, $8, $9, $10, NOW()
         ) RETURNING id`,
        [
          orderId, shipmentNumber, carrier, service, shCost, JSON.stringify(sh),
          groupKey, idbusiness, originCiudadId, destinationCiudadId
        ]
      );
      const shipmentId = shipRows[0].id;
      shipmentNumber++;

      const groupItems = sh.items || items;
      for (const item of groupItems) {
        await pool.query(
          `INSERT INTO order_items (order_id, shipment_id, product_id, product_name, quantity, unit_price, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [orderId, shipmentId, item.id, item.name || 'Producto', item.quantity || 1, item.price || 0, (Number(item.price || 0) * Number(item.quantity || 1))]
        );
      }
    }
  } else {
    const { rows: shipRows } = await pool.query(
      `INSERT INTO order_shipments (
         order_id, shipment_number, carrier, service, shipping_cost, destination_ciudad_id, created_at
       ) VALUES (
         $1, 1, 'Envío Estándar', 'Estándar', $2, $3, NOW()
       ) RETURNING id`,
      [orderId, shippingCost, ciudadId]
    );
    const shipmentId = shipRows[0].id;

    for (const item of items) {
      await pool.query(
        `INSERT INTO order_items (order_id, shipment_id, product_id, product_name, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, shipmentId, item.id, item.name || 'Producto', item.quantity || 1, item.price || 0, (Number(item.price || 0) * Number(item.quantity || 1))]
      );
    }
  }
};

export const getUserPurchasesDetails = async (userId, guestHash) => {
  if (!userId && !guestHash) return [];

  const { rows: orderRows } = await pool.query(
    `SELECT o.* 
     FROM orders o
     WHERE ($1::bigint IS NOT NULL AND o.user_id = $1)
        OR ($2::text IS NOT NULL AND o.guest_hash = $2)
     ORDER BY o.created_at DESC`,
    [userId || null, guestHash || null]
  );

  const ordersWithDetails = [];
  for (const order of orderRows) {
    const { rows: itemRows } = await pool.query(
      `SELECT oi.*, p.images, p.public_id, p.description, p.base_price, p.suggested_price
       FROM order_items oi
       LEFT JOIN produc p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [order.id]
    );

    const { rows: shipmentRows } = await pool.query(
      `SELECT * FROM order_shipments WHERE order_id = $1`,
      [order.id]
    );

    ordersWithDetails.push({
      ...order,
      items: itemRows,
      shipments: shipmentRows
    });
  }

  return ordersWithDetails;
};

export const searchOrdersByNumberOrDoc = async (queryParam, userId = null, guestHash = null) => {
  if (!queryParam) return [];
  const cleanQuery = String(queryParam).trim();
  const { rows: orderRows } = await pool.query(
    `SELECT o.id, o.order_number, o.order_hash, o.user_id, o.guest_hash, o.status, o.amount, o.created_at
     FROM orders o
     WHERE o.order_number = $1 
        OR o.identification_number = $1
     ORDER BY o.created_at DESC`,
    [cleanQuery]
  );

  const ordersWithDetails = [];
  for (const order of orderRows) {
    const isOwner = (userId && Number(order.user_id) === Number(userId)) || (guestHash && order.guest_hash === guestHash);
    const safeOrder = {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      amount: Number(order.amount || 0),
      created_at: order.created_at,
    };
    if (isOwner) safeOrder.order_hash = order.order_hash;

    const { rows: itemRows } = await pool.query(
      `SELECT oi.product_id, oi.product_name, oi.quantity, oi.unit_price, oi.line_total, p.images, p.public_id
       FROM order_items oi
       LEFT JOIN produc p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [order.id]
    );

    ordersWithDetails.push({
      ...safeOrder,
      items: itemRows,
    });
  }

  return ordersWithDetails;
};

export const getOrderByHash = async (orderHash, userId = null, guestHash = null) => {
  if (!orderHash) return null;
  if (!userId && !guestHash) return null;

  const { rows: orderRows } = await pool.query(
    `SELECT o.* FROM orders o
     WHERE o.order_hash = $1
       AND (($2::bigint IS NOT NULL AND o.user_id = $2) OR ($3::text IS NOT NULL AND o.guest_hash = $3))
     LIMIT 1`,
    [orderHash, userId || null, guestHash || null]
  );
  if (orderRows.length === 0) return null;
  const order = orderRows[0];

  const { rows: itemRows } = await pool.query(
    `SELECT oi.*, p.images, p.public_id, p.description, p.base_price, p.suggested_price
     FROM order_items oi
     LEFT JOIN produc p ON oi.product_id = p.id
     WHERE oi.order_id = $1`,
    [order.id]
  );

  const { rows: shipmentRows } = await pool.query(
    `SELECT * FROM order_shipments WHERE order_id = $1`,
    [order.id]
  );

  const { payload, shipping_payload, guest_hash, ...safeOrder } = order;
  return {
    ...safeOrder,
    items: itemRows,
    shipments: shipmentRows
  };
};

export const cancelMastershopOrderOrShipments = async (order, shipmentIds, totalCancel) => {
  try {
    const { rows: integrationRows } = await pool.query(
      `SELECT api_key FROM tienda_integraciones WHERE user_id = $1 AND provider = 'mastershop' LIMIT 1`,
      [order.tienda_id || 1]
    );
    if (!integrationRows[0] || !integrationRows[0].api_key) return;

    const apiKey = integrationRows[0].api_key;
    const baseUrl = process.env.MASTERSHOP_API_URL || 'https://prod.api.mastershop.com/api';

    const endpoint = totalCancel ? `${baseUrl}/orders/${order.id}/cancel` : `${baseUrl}/orders/${order.id}/shipments/cancel`;
    await axios.post(endpoint, {
      shipment_ids: shipmentIds,
      total_cancel: totalCancel
    }, {
      headers: { 'ms-api-key': apiKey, 'Content-Type': 'application/json' },
      timeout: 5000
    }).catch(async () => {
      await axios.put(`${baseUrl}/orders/${order.id}`, { status: 'cancelled' }, {
        headers: { 'ms-api-key': apiKey, 'Content-Type': 'application/json' },
        timeout: 5000
      }).catch(() => {});
    });
  } catch (err) {
    console.warn('[Mastershop] Error notificando cancelación:', err.message);
  }
};

export const createNotification = async (userId, guestHash, orderId, title, message, type = 'order', data = {}) => {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, guest_hash, order_id, type, title, message, data, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())`,
      [userId || null, guestHash || null, orderId || null, type, title, message, JSON.stringify(data)]
    );
  } catch (err) {
    console.error('Error creando notificación en DB:', err.message);
  }
};

export const cancelOrderForUser = async (orderHash, userId, guestHash) => {
  const { rows: orderRows } = await pool.query(
    `SELECT * FROM orders WHERE order_hash = $1 AND (($2::bigint IS NOT NULL AND user_id = $2) OR ($3::text IS NOT NULL AND guest_hash = $3))`,
    [orderHash, userId || null, guestHash || null]
  );
  if (orderRows.length === 0) {
    throw new Error('Orden no encontrada o no autorizada para cancelar');
  }
  const order = orderRows[0];
  const orderId = order.id;

  const { rows: shipmentRows } = await pool.query(
    `SELECT * FROM order_shipments WHERE order_id = $1`,
    [orderId]
  );

  let cancelledCount = 0;
  let activeCount = 0;
  const cancelledShipmentIds = [];

  for (const sh of shipmentRows) {
    const st = String(sh.fulfillment_status || '').toLowerCase();
    const isEligible = !st || st.includes('pend') || st.includes('confirm') || st.includes('cread') || st.includes('nuevo');
    
    if (isEligible) {
      await pool.query(`UPDATE order_shipments SET fulfillment_status = 'cancelled', updated_at = NOW() WHERE id = $1`, [sh.id]);
      cancelledShipmentIds.push(sh.id);
      cancelledCount++;
    } else {
      activeCount++;
    }
  }

  if (cancelledCount === 0 && shipmentRows.length > 0) {
    throw new Error('No es posible cancelar ningún envío de este pedido porque ya se encuentran procesados o con guía generada.');
  }

  // Liberar stock y actualizar items de los envíos cancelados
  for (const shipId of cancelledShipmentIds) {
    const { rows: itemRows } = await pool.query(
      `SELECT * FROM order_items WHERE shipment_id = $1`,
      [shipId]
    );
    for (const item of itemRows) {
      if (item.product_id && item.quantity) {
        await pool.query(
          `UPDATE produc SET stock_total = stock_total + $1 WHERE id = $2`,
          [Number(item.quantity), Number(item.product_id)]
        );
      }
      await pool.query(
        `UPDATE order_items SET line_total = 0, quantity = 0 WHERE id = $1`,
        [item.id]
      );
    }
  }

  // Recalcular el monto total del pedido basado en los envíos e ítems activos restantes
  const { rows: activeShipments } = await pool.query(
    `SELECT * FROM order_shipments WHERE order_id = $1 AND fulfillment_status != 'cancelled'`,
    [orderId]
  );
  
  let newAmount = 0;
  for (const activeSh of activeShipments) {
    newAmount += Number(activeSh.shipping_cost || 0);
    const { rows: actItems } = await pool.query(
      `SELECT line_total FROM order_items WHERE shipment_id = $1`,
      [activeSh.id]
    );
    for (const ai of actItems) {
      newAmount += Number(ai.line_total || 0);
    }
  }

  const totalCancel = activeCount === 0;
  const newOrderStatus = totalCancel ? 'cancelled' : 'partially_cancelled';

  await pool.query(
    `UPDATE orders SET status = $1, amount = $2, updated_at = NOW() WHERE id = $3`,
    [newOrderStatus, newAmount, orderId]
  );

  await cancelMastershopOrderOrShipments(order, cancelledShipmentIds, totalCancel);

  // Registrar notificación en la tabla `notifications`
  const notifTitle = totalCancel ? `Pedido #${orderId} cancelado` : `Pedido #${orderId} cancelado parcialmente`;
  const notifMsg = totalCancel ? `Tu pedido ha sido cancelado en su totalidad y el stock ha sido liberado.` : `Se han cancelado ${cancelledCount} envíos de tu pedido.`;
  await createNotification(order.user_id, order.guest_hash, order.id, notifTitle, notifMsg, 'order_cancelled', { total_cancel: totalCancel, cancelled_shipments: cancelledCount, active_shipments: activeCount });

  return {
    order_id: orderId,
    status: newOrderStatus,
    amount: newAmount,
    cancelled_shipments: cancelledCount,
    active_shipments: activeCount
  };
};

export const checkIfMastershopGuideGenerated = async (order) => {
  try {
    // PASO 1: Consultar primero en la base de datos local (actualizada previamente por el webhook)
    const { rows: shipRows } = await pool.query(
      `SELECT payload FROM order_shipments WHERE order_id = $1`,
      [order.id]
    );
    for (const sh of shipRows) {
      if (sh.payload) {
        const p = typeof sh.payload === 'string' ? JSON.parse(sh.payload) : sh.payload;
        if (p.guide || p.tracking || p.waybill || p.guide_number || p.guideNumber || p.tracking_id || p.trackingId) {
          return true; // Encontrado localmente (vía webhook)
        }
      }
    }

    // PASO 2: Si aún no está generada localmente, verificamos en Mastershop como respaldo
    const { rows: integrationRows } = await pool.query(
      `SELECT api_key FROM tienda_integraciones WHERE user_id = $1 AND provider = 'mastershop' LIMIT 1`,
      [order.tienda_id || 1]
    );
    if (!integrationRows[0] || !integrationRows[0].api_key) {
      return false;
    }

    const apiKey = integrationRows[0].api_key;
    const baseUrl = process.env.MASTERSHOP_API_URL || 'https://prod.api.mastershop.com/api';
    
    const response = await axios.get(`${baseUrl}/orders/${order.id}`, {
      headers: { 'ms-api-key': apiKey },
      timeout: 5000
    }).catch(() => null);

    if (response && response.data) {
      const orderData = response.data;
      const shipments = orderData.shipments || orderData.envios || [];
      for (const sh of shipments) {
        if (sh.guide || sh.tracking || sh.waybill || sh.guide_number || sh.guideNumber || sh.tracking_id || sh.trackingId || sh.status === 'shipped' || sh.status === 'guia_generada') {
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('[Mastershop] Error consultando guías:', err.message);
  }
  return false;
};

export const updateMastershopOrderAddress = async (order, direccion, telefono) => {
  try {
    const { rows: integrationRows } = await pool.query(
      `SELECT api_key FROM tienda_integraciones WHERE user_id = $1 AND provider = 'mastershop' LIMIT 1`,
      [order.tienda_id || 1]
    );
    if (!integrationRows[0] || !integrationRows[0].api_key) {
      return false;
    }

    const apiKey = integrationRows[0].api_key;
    const baseUrl = process.env.MASTERSHOP_API_URL || 'https://prod.api.mastershop.com/api';
    
    await axios.put(`${baseUrl}/orders/${order.id}`, {
      address: direccion,
      phone: telefono,
      shipping_address: direccion,
      telefono: telefono
    }, {
      headers: { 
        'ms-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    }).catch(async () => {
      await axios.patch(`${baseUrl}/orders/${order.id}`, {
        address: direccion,
        phone: telefono,
        shipping_address: direccion,
        telefono: telefono
      }, {
        headers: { 
          'ms-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }).catch(err => {
        console.warn('[Mastershop] No se pudo sincronizar la actualización de dirección con Mastershop:', err.message);
      });
    });

    return true;
  } catch (err) {
    console.warn('[Mastershop] Error al actualizar dirección en Mastershop:', err.message);
    return false;
  }
};

export const updateOrderAddressForUser = async (orderHash, userId, guestHash, direccion, telefono) => {
  const { rows: orderRows } = await pool.query(
    `SELECT * FROM orders WHERE order_hash = $1 AND (($2::bigint IS NOT NULL AND user_id = $2) OR ($3::text IS NOT NULL AND guest_hash = $3))`,
    [orderHash, userId || null, guestHash || null]
  );
  if (orderRows.length === 0) {
    throw new Error('Orden no encontrada o no autorizada para actualizar');
  }
  const order = orderRows[0];
  const orderId = order.id;

  const guideGenerated = await checkIfMastershopGuideGenerated(order);
  if (guideGenerated) {
    throw new Error('No es posible actualizar la dirección: ya se ha generado una guía de envío para este pedido.');
  }

  const { rows } = await pool.query(
    `UPDATE orders SET direccion = $1, telefono = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [direccion, telefono, orderId]
  );

  // Sincronizar la nueva dirección con Mastershop para que la guía salga con la nueva dirección
  await updateMastershopOrderAddress(order, direccion, telefono);

  return rows[0];
};

export const processSavedCardPaymentForCart = async (userId, payload) => {
  const { card_id, items: inputItems, shipping_cost, shipping_payload, customer_info, guestHash } = payload;
  
  if (!userId) {
    throw new Error('Debes iniciar sesión para pagar con tarjetas guardadas (1-Click).');
  }

  const { rows: cardRows } = await pool.query(
    `SELECT * FROM user_cards WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [card_id, userId]
  );
  const card = cardRows[0];
  if (!card || !card.token_mp) {
    throw new Error('Tarjeta no encontrada o no válida para pagos de 1 clic.');
  }

  const { rows: mpRows } = await pool.query(
    `SELECT access_token, public_key, mode FROM checkout_integrations WHERE provider = 'mercadopago' ORDER BY (mode = 'produccion') DESC LIMIT 1`
  );
  const mpInt = mpRows[0];
  if (!mpInt?.access_token) {
    throw new Error('La tienda no tiene configurada la integración de Mercado Pago.');
  }
  mpInt.access_token = decryptSecret(mpInt.access_token);

  const { rows: userRows } = await pool.query(`SELECT email, name FROM users WHERE id = $1 LIMIT 1`, [userId]);
  const userEmail = userRows[0]?.email || 'cliente@glopsy.com';

  let items = Array.isArray(inputItems) && inputItems.length > 0 ? inputItems : [];
  const subtotal = items.reduce((acc, i) => acc + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
  const total = subtotal + Number(shipping_cost || 0);

  const client = new MercadoPagoConfig({ accessToken: mpInt.access_token });
  const payment = new Payment(client);

  const paymentData = {
    transaction_amount: Number(total),
    token: card.token_mp,
    description: `Compra Glopsy 1-Click - ${items.length} productos`,
    installments: 1,
    payer: {
      email: userEmail,
      first_name: card.card_holder || userRows[0]?.name || 'Cliente'
    }
  };

  const paymentResponse = await payment.create({ body: paymentData });

  const status = paymentResponse?.status;
  const isSuccessful = status === 'approved' || status === 'pending' || status === 'in_process' || status === 'authorized' || (paymentResponse && !['rejected', 'cancelled', 'refunded', 'charged_back'].includes(status));

  if (paymentResponse && isSuccessful) {
    let resolvedItems = items;
    let foundKey = null;

    if (!resolvedItems || resolvedItems.length === 0) {
      const identifiers = [
        guestHash ? `cart:reserve:${guestHash}` : null,
        userId ? `cart:reserve:user_${userId}` : null,
        `cart:reserve:guest_anonymous`
      ].filter(Boolean);

      for (const key of identifiers) {
        const data = await redisClient.get(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed.length > 0) {
              resolvedItems = parsed;
              foundKey = key;
              break;
            }
          } catch {}
        }
      }
    }

    if (resolvedItems && resolvedItems.length > 0) {
      await recordPurchaseForUser(userId, resolvedItems, {
        preferenceId: `1click_${card.id}_${Date.now()}`,
        paymentResponse,
        customerInfo: customer_info,
        guestHash,
        shippingCost: shipping_cost,
        shippingPayload: shipping_payload
      });
      if (foundKey) {
        await redisClient.del(foundKey);
      }
    }
  }

  return paymentResponse;
};

