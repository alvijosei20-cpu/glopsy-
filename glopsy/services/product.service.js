import { pool } from '../db.js';
import crypto from 'crypto';
import axios from 'axios';
import { getShippingOptionsFromEnvia, invalidateRatesCacheForStore } from './envia.service.js';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { obtenerProductoPorId } from './mastershopService.js';
import { redisClient } from './redis.service.js';

export const getTiposEmpaque = async () => {
  const { rows } = await pool.query('SELECT id, nombre, peso, largo, alto, ancho FROM tipo_empaque ORDER BY id');
  return rows;
};

export const saveProductForUser = async (userId, productData) => {
  const {
    idProduct,
    idVariant,
    name,
    basePrice,
    baseCurrencyPrice,
    suggestedPrice,
    description,
    stockTotal,
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
  } = productData;

  const resolvedTipoEmpaqueId = tipo_empaque_id !== undefined ? tipo_empaque_id : tipoEmpaqueId;

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

  const parseNumeric = (val) => {
    if (val === undefined || val === null || val === '') return null;
    const cleaned = String(val).replace(/[^0-9.,-]/g, '').replace(',', '.');
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  };

  const images = urlImageProduct ? [{ src: urlImageProduct }] : [];
  const variants = Array.isArray(variation) ? variation : [];
  const warranties = { period: warrantyPeriod || '', conditions: warrantyConditions || '' };
  const support = { email: supportEmail || '', phone: warrantyPhone || '' };

  let resolvedIntegracionId = integracionId !== undefined ? integracionId : tiendaIntegracionId;
  if (!resolvedIntegracionId && provider) {
    const intRow = await pool.query(
      `SELECT id FROM tienda_integraciones WHERE user_id = $1 AND provider = $2 LIMIT 1`,
      [userId, provider]
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
        updated_at = NOW()
      WHERE id = $19 AND tienda_id = $1
      RETURNING id, name, external_product_id, selected_variant_id, suggested_price, fullm_id, tipo_empaque_id, integracion_id, created_at
    `;
    const updateValues = [
      userId,
      idProduct ? String(idProduct) : null,
      idVariant ? String(idVariant) : null,
      resolvedIntegracionId !== undefined && resolvedIntegracionId !== '' ? Number(resolvedIntegracionId) : null,
      name,
      parseNumeric(basePrice) || 0,
      baseCurrencyPrice || 'USD',
      parseNumeric(suggestedPrice),
      description || '',
      Math.round(parseNumeric(stockTotal) || 0),
      productOwner ? JSON.stringify(productOwner) : null,
      JSON.stringify(images),
      JSON.stringify(variants),
      JSON.stringify(warranties),
      JSON.stringify(support),
      selectedOptions ? JSON.stringify(selectedOptions) : '{}',
      resolvedFullmId ? Number(resolvedFullmId) : null,
      resolvedTipoEmpaqueId ? Number(resolvedTipoEmpaqueId) : null,
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
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
      RETURNING id, public_id, name, external_product_id, selected_variant_id, suggested_price, fullm_id, tipo_empaque_id, integracion_id, created_at
    `;
    const insertValues = [
      userId,
      publicId,
      idProduct ? String(idProduct) : null,
      idVariant ? String(idVariant) : null,
      resolvedIntegracionId !== undefined && resolvedIntegracionId !== '' ? Number(resolvedIntegracionId) : null,
      name,
      parseNumeric(basePrice) || 0,
      baseCurrencyPrice || 'USD',
      parseNumeric(suggestedPrice),
      description || '',
      Math.round(parseNumeric(stockTotal) || 0),
      productOwner ? JSON.stringify(productOwner) : null,
      JSON.stringify(images),
      JSON.stringify(variants),
      JSON.stringify(warranties),
      JSON.stringify(support),
      selectedOptions ? JSON.stringify(selectedOptions) : '{}',
      resolvedFullmId ? Number(resolvedFullmId) : null,
      resolvedTipoEmpaqueId ? Number(resolvedTipoEmpaqueId) : null,
    ];
    const { rows } = await pool.query(insertQuery, insertValues);
    resultRow = rows[0];
  }

  // Invalidate cache for this tienda since product data / fullment assignment may affect shipping origin
  try {
    await invalidateRatesCacheForStore(userId).catch(() => {});
  } catch {}

  return resultRow;
};

export const getProductsForUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT id, name, base_price, suggested_price, stock_total, fullm_id, selected_variant_id, selected_options, created_at
     FROM produc
     WHERE tienda_id = $1
     ORDER BY name`,
    [userId]
  );
  return rows;
};

export const getProductsByFullment = async (userId, fullmentId) => {
  const { rows } = await pool.query(
    `SELECT id, name, base_price, suggested_price, stock_total, fullm_id, selected_variant_id, selected_options, created_at
     FROM produc
     WHERE tienda_id = $1 AND fullm_id = $2
     ORDER BY name`,
    [userId, fullmentId]
  );
  return rows;
};

export const assignProductsToFullment = async (userId, fullmentId, productIds) => {
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
      `UPDATE produc SET fullm_id = NULL WHERE tienda_id = $1 AND fullm_id = $2 AND id NOT IN (SELECT unnest($3::int[]))`,
      [userId, fullmentId, ids]
    );
    await pool.query(
      `UPDATE produc SET fullm_id = $2 WHERE tienda_id = $1 AND id = ANY($3::int[])`,
      [userId, fullmentId, ids]
    );
  } else {
    await pool.query(
      `UPDATE produc SET fullm_id = NULL WHERE tienda_id = $1 AND fullm_id = $2`,
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
  const { rows } = await pool.query(
    `SELECT id, nombre, descripcion FROM categorias ORDER BY nombre`
  );
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

export const searchQueryProducts = async ({ q, limit = 12, offset = 0, ciudadName, categoriaId }) => {
  const lim = Math.max(1, parseInt(limit, 10) || 12);
  const off = Math.max(0, parseInt(offset, 10) || 0);
  const search = q ? String(q).trim() : null;
  const city = ciudadName ? String(ciudadName).trim() : null;
  const catId = categoriaId ? parseInt(categoriaId, 10) : null;

  const queryText = `
    SELECT 
      p.id,
      p.public_id,
      p.tienda_id,
      p.name,
      p.base_price,
      p.suggested_price,
      p.stock_total,
      p.images,
      p.description,
      p.created_at,
      c.nombre AS ciudad_nombre,
      cat.id AS categoria_id,
      cat.nombre AS categoria_nombre,
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
          AND (o.alcance = 'global' OR (o.alcance = 'ciudad' AND (o.ciudad_id = c.id OR ($2::text IS NOT NULL AND LOWER(c.nombre) = LOWER($2::text)))))
        ORDER BY (o.alcance = 'ciudad') DESC, o.valor_descuento DESC
        LIMIT 1
      ) AS oferta_activa,
      EXISTS (
        SELECT 1 
        FROM perfiles_envio pe
        LEFT JOIN fullments pf ON pe.fullment_id = pf.id
        LEFT JOIN ciudades ci ON pf.ciudad_id = ci.id
        WHERE pe.tienda_id = p.tienda_id 
          AND pe.tipo_envio = 'gratis'
          AND (
            pe.alcance = 'global' 
            OR (pe.alcance = 'ciudad' AND (pf.ciudad_id = c.id OR ($2::text IS NOT NULL AND LOWER(ci.nombre) = LOWER($2::text)) OR ($2::text IS NOT NULL AND f.id IS NOT NULL)))
          )
      ) AS envio_gratis
    FROM produc p
    LEFT JOIN fullments f ON p.fullm_id = f.id
    LEFT JOIN ciudades c ON f.ciudad_id = c.id
    LEFT JOIN categorias cat ON p.categoria_id = cat.id
    WHERE ($1::text IS NULL OR $1 = '' OR p.name ILIKE '%' || $1 || '%' OR p.description ILIKE '%' || $1 || '%')
      AND ($5::int IS NULL OR p.categoria_id = $5)
    ORDER BY p.id DESC
    LIMIT $3 OFFSET $4
  `;

  const countQueryText = `
    SELECT COUNT(*) AS total
    FROM produc p
    LEFT JOIN fullments f ON p.fullm_id = f.id
    LEFT JOIN ciudades c ON f.ciudad_id = c.id
    WHERE ($1::text IS NULL OR $1 = '' OR p.name ILIKE '%' || $1 || '%' OR p.description ILIKE '%' || $1 || '%')
      AND ($2::int IS NULL OR p.categoria_id = $2)
  `;

  const values = [search, city, lim, off, catId];
  const countValues = [search, catId];

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

export const getProductByPublicId = async (identifier) => {
  let queryText = `
    SELECT p.*, c.nombre AS ciudad_nombre, cat.nombre AS categoria_nombre
    FROM produc p
    LEFT JOIN fullments f ON p.fullm_id = f.id
    LEFT JOIN ciudades c ON f.ciudad_id = c.id
    LEFT JOIN categorias cat ON p.categoria_id = cat.id
  `;
  let values = [];
  if (/^\d+$/.test(identifier)) {
    queryText += ` WHERE p.id = $1 LIMIT 1`;
    values = [parseInt(identifier, 10)];
  } else {
    queryText += ` WHERE p.public_id = $1 LIMIT 1`;
    values = [String(identifier)];
  }

  const { rows } = await pool.query(queryText, values);
  if (rows[0]) {
    const row = rows[0];
    return {
      ...row,
      images: typeof row.images === 'string' ? JSON.parse(row.images) : row.images,
      variants: typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants,
      warranties: typeof row.warranties === 'string' ? JSON.parse(row.warranties) : row.warranties,
      support: typeof row.support === 'string' ? JSON.parse(row.support) : row.support,
    };
  }

  return await obtenerProductoPorId(identifier);
};

export const reserveStockForSession = async (items, identifier) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No hay productos en el carrito para apartar stock.');
  }

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
    } catch {}
  }

  for (const item of items) {
    const pId = Number(item.id);
    const qty = Number(item.quantity) || 1;

    const { rows } = await pool.query(`SELECT stock_total FROM produc WHERE id = $1 LIMIT 1`, [pId]);
    if (!rows[0]) {
      throw new Error(`Producto con ID ${pId} no encontrado.`);
    }
    const currentStock = rows[0].stock_total;
    if (currentStock < qty) {
      throw new Error(`Stock insuficiente para el producto (Disponible: ${currentStock}, Solicitado: ${qty}).`);
    }

    await pool.query(`UPDATE produc SET stock_total = stock_total - $1 WHERE id = $2`, [qty, pId]);
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
  if (!guestHash) return { migrated: false };
  const guestKey = `cart:reserve:${guestHash}`;
  const userKey = `cart:reserve:user_${userId}`;

  const guestData = await redisClient.get(guestKey);
  if (guestData) {
    const ttl = await redisClient.ttl(guestKey);
    await redisClient.set(userKey, guestData, { EX: ttl > 0 ? ttl : 900 });
    await redisClient.del(guestKey);
    return { migrated: true };
  }
  return { migrated: false };
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

  if (tiendaId && destinationCiudadId) {
    // 1) Check store-level free shipping (global)
    const { rows: storeGlobal } = await pool.query(`
      SELECT 1 FROM perfiles_envio WHERE tienda_id = $1 AND tipo_envio = 'gratis' AND alcance = 'global' LIMIT 1
    `, [tiendaId]);
    if (storeGlobal.length > 0) {
      // all items free
      const perItem = items.map(it => ({ itemId: it.id, shippingCost: 0 }));
      return { shipping_cost: 0, free_shipping: true, message: 'Envío gratis aplicado para toda la tienda.', grouped: [], per_item: perItem };
    }

    // 2) Check store-level free shipping by city
    const { rows: storeCity } = await pool.query(`
      SELECT 1 FROM perfiles_envio pe
      LEFT JOIN fullments pf ON pe.fullment_id = pf.id
      WHERE pe.tienda_id = $1 AND pe.tipo_envio = 'gratis' AND pe.alcance = 'ciudad' AND pf.ciudad_id = $2 LIMIT 1
    `, [tiendaId, destinationCiudadId]);
    if (storeCity.length > 0) {
      const perItem = items.map(it => ({ itemId: it.id, shippingCost: 0 }));
      return { shipping_cost: 0, free_shipping: true, message: 'Envío gratis aplicado para esta ciudad.', grouped: [], per_item: perItem };
    }
  }

  // We'll produce grouped quotes and per-item quotes.
  const grouped = {};

  // Helper to get product details (product_owner.idbusiness and fullm_id -> ciudad)
  // For efficiency, we'll fetch produc rows for item ids
  const productIds = items.filter(i => i.id).map(i => Number(i.id)).filter(Boolean);
  let productRows = [];
  if (productIds.length > 0) {
    const { rows } = await pool.query(`SELECT id, product_owner, fullm_id, tienda_id, peso, largo, alto, ancho, tipo_empaque_id FROM produc WHERE id = ANY($1::int[])`, [productIds]);
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
  // Precompute fullment-based free-shipping info
  const fullmentIds = Array.from(new Set(items.map(it => {
    const p = prodMap.get(Number(it.id));
    return p?.fullm_id || it.fullm_id || null;
  }).filter(Boolean)));
  const freeFullmentSet = new Set();
  if (fullmentIds.length > 0) {
    // 1) perfiles_envio linked directly by fullment_id
    const { rows: pfRows } = await pool.query(`
      SELECT pe.fullment_id, pe.alcance, f.ciudad_id
      FROM perfiles_envio pe
      LEFT JOIN fullments f ON pe.fullment_id = f.id
      WHERE pe.fullment_id = ANY($1::int[]) AND pe.tipo_envio = 'gratis'
    `, [fullmentIds]);
    for (const r of pfRows) {
      if (r.alcance === 'global') freeFullmentSet.add(r.fullment_id);
      if (r.alcance === 'ciudad' && Number(r.ciudad_id) === Number(destinationCiudadId)) freeFullmentSet.add(r.fullment_id);
    }

    // 2) perfiles assigned via fullments.perfil_envio_id -> perfiles_envio.id
    const { rows: viaRows } = await pool.query(`
      SELECT f.id AS fullment_id, pe.alcance, f.ciudad_id
      FROM fullments f
      JOIN perfiles_envio pe ON f.perfil_envio_id = pe.id
      WHERE f.id = ANY($1::int[]) AND pe.tipo_envio = 'gratis'
    `, [fullmentIds]);
    for (const r of viaRows) {
      if (r.alcance === 'global') freeFullmentSet.add(r.fullment_id);
      if (r.alcance === 'ciudad' && Number(r.ciudad_id) === Number(destinationCiudadId)) freeFullmentSet.add(r.fullment_id);
    }
  }

  // collect items that are free by fullment into freeGroups (keyed same as grouped key)
  const freeGroups = {};

  for (const item of items) {
    const p = prodMap.get(Number(item.id));
    // product_owner may be JSON stored as string; prefer parsed _productOwner
    let idbusiness = 'unknown';
    if (p?._productOwner) {
      idbusiness = p._productOwner.idbusiness || p._productOwner.idBusiness || p._productOwner.id || idbusiness;
    } else if (item.product_owner) {
      try {
        const io = typeof item.product_owner === 'string' ? JSON.parse(item.product_owner) : item.product_owner;
        idbusiness = io?.idbusiness || io?.idBusiness || io?.id || idbusiness;
      } catch (e) {}
    }
    // Resolve origin ciudad from fullments
    let originCiudadId = null;
    if (p?.fullm_id) {
      const { rows } = await pool.query(`SELECT ciudad_id FROM fullments WHERE id = $1 LIMIT 1`, [p.fullm_id]);
      originCiudadId = rows[0]?.ciudad_id || null;
    }
    // fallback to item.fullm_id or null
    if (!originCiudadId) originCiudadId = item.fullm_id || null;

    // if this item's fullment is marked free for this city, mark item as free and add to freeGroups (but don't include in chargeable grouped)
    const itemFullmId = p?.fullm_id || item.fullm_id || null;
    if (itemFullmId && freeFullmentSet.has(Number(itemFullmId))) {
      // mark item as free, still include in grouping
      const freeItem = { ...item, _productRow: p, _isFree: true };
      perItemResults.push({ itemId: item.id, shippingCost: 0, shippingOptions: [] });
      if (!grouped[key]) grouped[key] = { idbusiness, originCiudadId, destinationCiudadId, items: [] };
      grouped[key].items.push(freeItem);
      continue;
    }

    const key = `${String(idbusiness)}::${String(originCiudadId)}::${String(destinationCiudadId)}`;
    if (!grouped[key]) grouped[key] = { idbusiness, originCiudadId, destinationCiudadId, items: [] };
    grouped[key].items.push({ ...item, _productRow: p });
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
        units.push({ id: it.id, name: it.name, l: dims[0], w: dims[1], h: dims[2], weight, volume: dims[0] * dims[1] * dims[2], tipoId: it._productRow?.tipo_empaque_id || null });
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
    // build packages
    const packages = packItemsIntoBoxes(grp.items);
    // quote each package in parallel
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

    const shippingCost = pkgResults.reduce((s, r) => s + Number(r.shippingCost || 0), 0);
    // distribute per-item cost by package weight share
    for (const r of pkgResults) {
      const pkg = r.pkg;
      const pkgItems = pkg.items;
      const pkgWeightSum = pkgItems.reduce((s, ii) => s + (ii.weight || 0), 0) || 1;
      for (const ii of pkgItems) {
        const share = (ii.weight || 0) / pkgWeightSum;
        const itemCost = Math.round((r.shippingCost || 0) * share);
        perItemResultsLocal.push({ itemId: ii.id, shippingCost: itemCost, shippingOptions: r.shippingOptions });
      }
    }
    const groupOptions = pkgResults.flatMap(r => r.shippingOptions || []);
    // choose cheapest option across package results
    let selectedCarrier = null;
    if (groupOptions.length > 0) {
      const sorted = groupOptions.slice().sort((a, b) => (Number(a.price || a.prize || a.total || a.servicePrice || a.basePrice || 0) - Number(b.price || b.prize || b.total || b.servicePrice || b.basePrice || 0)));
      const best = sorted[0];
      selectedCarrier = {
        carrier: best.carrier || best.carrierDescription || best.provider || best.name || null,
        service: best.service || best.serviceName || best.serviceDescription || null,
        price: Number(best.price || best.totalprice || best.totalPrice || best.rate || best.cost || best.total || best.servicePrice || best.basePrice || 0)
      };
    }

    groupedResultsLocal.push({ key, idbusiness: grp.idbusiness, originCiudadId: grp.originCiudadId, destinationCiudadId: grp.destinationCiudadId, items: grp.items, shippingCost, shippingOptions: groupOptions, selected_carrier: selectedCarrier });
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

  // Also compute products total (sum base_price * quantity) when available
  let productsTotal = 0;
  for (const it of items) {
    const p = prodMap.get(Number(it.id));
    const price = Number(p?.base_price ?? it.price ?? 0) || 0;
    const qty = Number(it.quantity || 1) || 1;
    productsTotal += price * qty;
  }

  const grandTotal = productsTotal + overallCost;

  const shipmentsCount = groupedResults.length || 0;
  const shipmentsMessage = `Recibirás un total de ${shipmentsCount} envío${shipmentsCount === 1 ? '' : 's'}.`;

  return {
    shipping_cost: overallCost,
    shipments_count: shipmentsCount,
    shipments_message: shipmentsMessage,
    grouped: groupedResults,
    per_item: perItemResults,
    products_total: productsTotal,
    grand_total: grandTotal,
    free_shipping: false
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
      },
      auto_return: 'approved'
    }
  });

  return {
    init_point: prefResponse.init_point,
    sandbox_init_point: prefResponse.sandbox_init_point,
    preferenceId: prefResponse.id
  };
};
