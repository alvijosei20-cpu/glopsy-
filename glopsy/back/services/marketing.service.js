import { pool } from '../db.js';
import { invalidateCatalogCache, invalidateProductDetailCachesForStore } from './product.service.js';
import { invalidateEdgeCache } from '../utils/cacheInvalidate.js';
import { getFacebookPageStatus } from './facebook.service.js';

const NOW = () => new Date().toISOString();

// Valida/limpia el destino (url) de una campaña push. Solo rutas internas
// de la SPA (catálogo, ficha de producto, consultar pedido) o URLs absolutas.
export const sanitizeCampaignUrl = (value, { publicIds = [] } = {}) => {
  const raw = String(value || '').trim().slice(0, 200);
  if (!raw || raw.includes('..')) return null;
  if (/^https?:\/\/\S+$/i.test(raw)) return raw;
  const productMatch = raw.match(/^\/product\/([A-Za-z0-9_-]{1,64})$/);
  if (productMatch) {
    if (publicIds.length && !publicIds.includes(productMatch[1])) return null;
    return raw;
  }
  if (/^\/listpr$/.test(raw) || /^\/consultar-pedido$/.test(raw)) return raw;
  return null;
};

export const registerMarketingRun = async (tiendaId, tipo) => {
  const { rows } = await pool.query(
    `INSERT INTO marketing_runs (tienda_id, tipo, estado) VALUES ($1, $2, 'running')
     RETURNING id`,
    [tiendaId, tipo]
  );
  return rows[0].id;
};

export const finishMarketingRun = async (runId, resumen, errorMessage = null) => {
  await pool.query(
    `UPDATE marketing_runs
     SET estado = $2, resumen = $3, error_message = $4, finished_at = NOW()
     WHERE id = $1`,
    [runId, errorMessage ? 'error' : 'ok', resumen || {}, errorMessage]
  );
};

export const catalogSnapshot = async (tiendaId, { limit = 200 } = {}) => {
  const { rows } = await pool.query(
    `SELECT p.id,
            p.name,
            p.description,
            p.base_price,
            p.suggested_price,
            p.stock_total,
            p.created_at,
            p.public_id,
            p.images,
            p.seo_title,
            p.seo_keywords,
            p.seo_updated_at,
            c.nombre AS categoria,
            COALESCE(
              (SELECT COALESCE(SUM(oi.quantity), 0)::int
               FROM order_items oi
               JOIN orders o ON o.id = oi.order_id
               WHERE oi.product_id = p.id AND o.tienda_id = $1 AND o.status = 'Completado'
                 AND o.created_at >= NOW() - INTERVAL '30 days'), 0) AS units_30d,
            COALESCE(
              (SELECT COALESCE(SUM(oi.quantity), 0)::int
               FROM order_items oi
               JOIN orders o ON o.id = oi.order_id
               WHERE oi.product_id = p.id AND o.tienda_id = $1 AND o.status = 'Completado'
                 AND o.created_at >= NOW() - INTERVAL '90 days'), 0) AS units_90d,
            COALESCE(
              (SELECT AVG(r.rating)::numeric(3,2)
               FROM reviews r WHERE r.product_id = p.id), 0) AS avg_rating,
            COALESCE(
              (SELECT COUNT(*)::int FROM reviews r WHERE r.product_id = p.id), 0) AS review_count
     FROM produc p
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE p.tienda_id = $1 AND p.status = 'active'
     ORDER BY p.created_at DESC
     LIMIT $2`,
    [tiendaId, limit]
  );
  return rows.map((r) => ({
    ...r,
    price: Number(r.suggested_price ?? r.base_price ?? 0),
    cost: Number(r.base_price ?? 0),
    units_30d: Number(r.units_30d || 0),
    units_90d: Number(r.units_90d || 0),
    avg_rating: Number(r.avg_rating || 0),
    review_count: Number(r.review_count || 0),
    description: (r.description || '').trim(),
    seo_keywords: Array.isArray(r.seo_keywords) ? r.seo_keywords : [],
    images: Array.isArray(r.images) ? r.images.map((i) => i.src || i).filter(Boolean) : [],
  }));
};

export const storeBuyerCount = async (tiendaId) => {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT user_id)::int AS buyers,
            COUNT(DISTINCT user_id) FILTER (WHERE u.push_subscription IS NOT NULL)::int AS push_ready
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     WHERE o.tienda_id = $1 AND o.user_id IS NOT NULL`,
    [tiendaId]
  );
  return { buyers: rows[0].buyers || 0, push_ready: rows[0].push_ready || 0 };
};

export const insertSuggestion = async (suggestion) => {
  const { rows } = await pool.query(
    `INSERT INTO marketing_suggestions
       (tienda_id, tipo, estado, fuente, titulo, detalle, payload, product_id, oferta_id, dedupe_key, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (tienda_id, dedupe_key) DO NOTHING
     RETURNING id`,
    [
      suggestion.tiendaId,
      suggestion.tipo,
      'pendiente',
      suggestion.fuente || 'rules',
      suggestion.titulo,
      suggestion.detalle || null,
      suggestion.payload || {},
      suggestion.productId ?? null,
      suggestion.ofertaId ?? null,
      suggestion.dedupeKey,
      suggestion.createdAt || NOW(),
    ]
  );
  return rows[0] || null;
};

export const markSuggestionState = async (tiendaId, suggestionId, estado, extra = {}) => {
  const set = ['estado = $3', 'applied_at = NOW()'];
  const values = [tiendaId, suggestionId, estado];
  if (extra.ofertaId !== undefined) {
    set.push('oferta_id = $' + (values.length + 1));
    values.push(extra.ofertaId);
  }
  const { rows } = await pool.query(
    `UPDATE marketing_suggestions SET ${set.join(', ')}
     WHERE id = $2 AND tienda_id = $1
     RETURNING *`,
    values
  );
  return rows[0] || null;
};

export const updateSuggestionUrl = async (tiendaId, suggestionId, url) => {
  const { rows } = await pool.query(
    `UPDATE marketing_suggestions
     SET payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object('url', $3)
     WHERE id = $2 AND tienda_id = $1 AND tipo = 'email' AND estado = 'pendiente'
     RETURNING *`,
    [tiendaId, suggestionId, url]
  );
  return rows[0] || null;
};

export const applySeoSuggestion = async (suggestion) => {
  const p = suggestion.payload || {};
  const description = typeof p.description === 'string' ? p.description : null;
  const updates = [];
  const values = [];
  if (suggestion.product_id) {
    if (description && description.length > 40) {
      updates.push('description = $' + (values.length + 1));
      values.push(description);
    }
    if (p.seo_title) {
      updates.push('seo_title = $' + (values.length + 1));
      values.push(String(p.seo_title).slice(0, 160));
    }
    if (Array.isArray(p.keywords) && p.keywords.length) {
      updates.push('seo_keywords = $' + (values.length + 1));
      values.push(JSON.stringify(p.keywords.map((k) => String(k).slice(0, 60))));
    }
    if (updates.length) {
      updates.push('seo_updated_at = NOW()');
      await pool.query(
        `UPDATE produc SET ${updates.join(', ')} WHERE id = $${values.length + 1}`,
        [...values, suggestion.product_id]
      );
    }
  }
  await invalidateCatalogCache().catch(() => {});
  await invalidateProductDetailCachesForStore(suggestion.tienda_id).catch(() => {});
  await invalidateEdgeCache().catch(() => {});
};

export const applyPromoSuggestion = async (suggestion, tiendaId) => {
  const p = suggestion.payload || {};
  const tipo = p.tipo === 'monto_fijo' ? 'monto_fijo' : 'porcentaje';
  const valor = Number(p.valor);
  const productId = suggestion.product_id;
  if (!productId || !valor || valor <= 0) {
    throw new Error('Payload de promoción inválido.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const titulo = String(p.titulo || `Promoción ${valor}%`).slice(0, 150);
    const insert = await client.query(
      `INSERT INTO ofertas (tienda_id, titulo, descripcion, tipo_descuento, valor_descuento, alcance,
                            fecha_inicio, fecha_fin)
       VALUES ($1, $2, $3, $4, $5, 'productos', NOW(), NOW() + INTERVAL '7 days')
       RETURNING id`,
      [tiendaId, titulo, p.detalle || null, tipo, valor]
    );
    const ofertaId = insert.rows[0].id;
    await client.query(
      `INSERT INTO oferta_productos (oferta_id, producto_id) VALUES ($1, $2)`,
      [ofertaId, productId]
    );
    await client.query('COMMIT');
    await invalidateEdgeCache().catch(() => {});
    await invalidateCatalogCache().catch(() => {});
    return ofertaId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const listSuggestions = async ({ tiendaId, tipo, estado, limit = 50, offset = 0 }) => {
  const where = ['s.tienda_id = $1'];
  const values = [tiendaId];
  if (tipo) {
    values.push(tipo);
    where.push(`s.tipo = $${values.length}`);
  }
  if (estado) {
    values.push(estado);
    where.push(`s.estado = $${values.length}`);
  }
  values.push(limit);
  values.push(offset);
  const { rows } = await pool.query(
    `SELECT s.*, p.name AS product_name, p.public_id AS product_public_id,
            p.images AS product_images, o.titulo AS oferta_titulo
     FROM marketing_suggestions s
     LEFT JOIN produc p ON p.id = s.product_id
     LEFT JOIN ofertas o ON o.id = s.oferta_id
     WHERE ${where.join(' AND ')}
     ORDER BY s.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return rows;
};

export const marketingOverview = async (tiendaId) => {
  const [counts, lastRun, facebook] = await Promise.all([
    pool.query(
      `SELECT tipo,
              COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes,
              COUNT(*) FILTER (WHERE estado = 'aplicada')::int AS aplicadas,
              COUNT(*) FILTER (WHERE estado = 'descartada')::int AS descartadas
       FROM marketing_suggestions
       WHERE tienda_id = $1
       GROUP BY tipo`,
      [tiendaId]
    ),
    pool.query(
      `SELECT id, tipo, estado, resumen, started_at, finished_at, error_message
       FROM marketing_runs
       WHERE tienda_id = $1
       ORDER BY started_at DESC
       LIMIT 1`,
      [tiendaId]
    ),
    getFacebookPageStatus(tiendaId).catch(() => null),
  ]);
  const summary = {
    seo: 0, promo: 0, stock: 0, social: 0, email: 0,
    total_pendientes: 0, total_aplicadas: 0, total_descartadas: 0,
    total_pendientes_promo: 0,
  };
  for (const r of counts.rows) {
    if (!(r.tipo in summary)) continue;
    summary[r.tipo] = Number(r.pendientes || 0);
    summary.total_pendientes += Number(r.pendientes || 0);
    summary.total_aplicadas += Number(r.aplicadas || 0);
    summary.total_descartadas += Number(r.descartadas || 0);
    if (r.tipo === 'promo') summary.total_pendientes_promo = Number(r.pendientes || 0);
  }
  return { summary, lastRun: lastRun.rows[0] || null, facebook };
};
