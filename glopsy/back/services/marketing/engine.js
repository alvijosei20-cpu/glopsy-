import { pool } from '../../db.js';
import {
  catalogSnapshot,
  storeBuyerCount,
  insertSuggestion,
  registerMarketingRun,
  finishMarketingRun,
  sanitizeCampaignUrl,
} from '../marketing.service.js';
import { askJson } from './llm.js';
import { formatPrice, configFromMoneda } from '../pais.service.js';

const STOPWORDS = new Set([
  'con', 'para', 'marca', 'color', 'modelo', 'nuevo', 'nueva', 'original', 'ideal',
  'envio', 'gratis', 'oferta', 'precio', 'producto', 'compra', 'ahora', 'tu', 'el',
  'la', 'los', 'las', 'mas', 'max', 'min', 'x2', 'kit', 'combo', 'incluye',
]);

const normalizeWord = (w) => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

const cleanWords = (name) => {
  const seen = new Set();
  const words = [];
  for (const raw of String(name || '').split(/[\s\-_,.;:/]+/)) {
    const w = normalizeWord(raw);
    if (!w || w.length < 3 || STOPWORDS.has(w) || seen.has(w)) continue;
    seen.add(w);
    words.push(w);
  }
  return words.slice(0, 12);
};

const truncate = (text, max) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
};

const firstImage = (product) => product.images?.[0] || null;

// ---------------------------------------------------------------- reglas

const ruleKeywords = (product) => {
  const base = cleanWords(product.name);
  const category = normalizeWord(product.categoria);
  if (category && !base.includes(category)) base.push(category);
  return base.slice(0, 8);
};

const ruleSeoTitle = (product) => {
  const base = truncate(product.name, 60);
  return product.categoria ? `${base} | ${product.categoria}`.slice(0, 160) : base;
};

const ruleSeoDescription = (product) => {
  if (product.description && product.description.length >= 80) return product.description.slice(0, 300);
  const cat = product.categoria ? ` de ${product.categoria}` : '';
  return truncate(
    `${product.name}${cat} — descubre características, calidad y disponibilidad. Envío a todo el país.`,
    300
  );
};

const socialPost = (product) => {
  const name = String(product.name || '').slice(0, 60);
  const price = product.price > 0
    ? formatPrice(product.price, configFromMoneda(product.moneda, product.locale))
    : '';
  const rating = product.review_count > 0 ? ` ⭐ ${product.avg_rating.toFixed(1)} (${product.review_count} reseñas)` : '';
  const stock = product.stock_total > 0 ? ' 📦 Disponible' : '';
  const tags = ruleKeywords(product)
    .map((k) => `#${k}`)
    .slice(0, 6)
    .join(' ');
  return {
    texto: truncate(`${name}${rating}${stock} — ¡no te lo pierdas! ${price ? `Precio: ${price}` : 'Consúltanos precio.'}${stock ? ' ¡Aprovecha antes de que se agote!' : ''}`, 500),
    hashtags: tags,
    cta: 'Compra ahora en el catálogo',
    url: `/product/${product.public_id}`,
  };
};

// ---------------------------------------------------------------- LLM (opcional)

const PROMPT_SYSTEM = `Eres el copywriter SEO y de marketing de una tienda en línea colombiana (glopsy).
Responde SIEMPRE con JSON válido, sin markdown. Textos en español, naturales y sin exagerar.
Nunca inventes precios, garantías ni beneficios que no estén en el contexto.`;

const llmSeo = async (product) => {
  const data = await askJson(PROMPT_SYSTEM, `Genera metadatos SEO para este producto:
Nombre: ${product.name}
Categoría: ${product.categoria || 'Sin categoría'}
Precio: ${product.price}
Descripción actual: ${product.description ? truncate(product.description, 200) : '(vacía)'}

Responde con este JSON exacto:
{"title": "titulo <= 60 chars", "keywords": ["max 6"], "description": "descripcion atractiva <= 160 chars, solo si la actual está vacía o es muy corta; si no, escribe null"}`);

  if (!data || typeof data !== 'object') return null;
  return {
    seo_title: typeof data.title === 'string' && data.title.trim() ? truncate(data.title.trim(), 160) : null,
    keywords: Array.isArray(data.keywords) ? data.keywords.map(String).map((k) => truncate(k, 40)).filter(Boolean).slice(0, 8) : null,
    description: typeof data.description === 'string' && data.description.trim() ? truncate(data.description.trim(), 300) : null,
  };
};

const llmSocial = async (product) => {
  const rule = socialPost(product);
  const data = await askJson(PROMPT_SYSTEM, `Crea una publicación corta para redes sociales de este producto:
Nombre: ${product.name}
Categoría: ${product.categoria || 'Sin categoría'}
Precio: ${product.price}
Stock disponible: ${product.stock_total}

Responde con este JSON exacto:
{"texto": "publicacion <= 220 chars con emoji moderado", "hashtags": "max 5 separados por espacio con #"}`);

  if (!data || typeof data !== 'object') return null;
  return {
    ...rule,
    texto: typeof data.texto === 'string' && data.texto.trim() ? truncate(data.texto.trim(), 400) : rule.texto,
    hashtags: typeof data.hashtags === 'string' && data.hashtags.trim() ? truncate(data.hashtags.trim(), 120) : rule.hashtags,
  };
};

const llmCampaign = async ({ storeName, top }) => {
  const publicIds = top.slice(0, 3).map((p) => p.public_id).filter(Boolean);
  const destLines = top.slice(0, 3)
    .map((p) => `- ${p.name} ($${p.price}) → /product/${p.public_id}`)
    .join('\n');
  const data = await askJson(PROMPT_SYSTEM, `Crea una campaña de reactivación por push para la tienda "${storeName}".
Productos destacados con su destino exacto en la app:
${destLines || '(no hay ventas aún)'}

Destinos válidos para "url":
- /listpr (catálogo de la tienda)
- /consultar-pedido (seguimiento de pedidos)
${top.slice(0, 3).map((p) => `- /product/${p.public_id}`).join('\n')}

Elige el destino que más probablemente convierta: si hay productos destacados, normalmente la ficha del más vendido.

Responde con este JSON exacto:
{"title": "titulo <= 60 chars", "body": "cuerpo <= 140 chars con CTA claro", "url": "uno de los destinos válidos, sin otros caracteres"}`);

  if (!data || typeof data !== 'object') return null;
  return {
    title: typeof data.title === 'string' && data.title.trim() ? truncate(data.title.trim(), 120) : null,
    body: typeof data.body === 'string' && data.body.trim() ? truncate(data.body.trim(), 200) : null,
    url: sanitizeCampaignUrl(data.url, { publicIds }),
  };
};

// ---------------------------------------------------------------- acciones por tipo

const MAX_PROMOS_PER_RUN = Number(process.env.MARKETING_MAX_PROMOS) || 8;

const suggestedPromo = (product) => {
  const stock = Number(product.stock_total || 0);
  const units90 = Number(product.units_90d || 0);
  if (stock <= 0) return null;
  if (units90 === 0) {
    const pct = stock > 300 ? 20 : stock > 80 ? 15 : 10;
    return {
      tipo: 'porcentaje',
      valor: pct,
      titulo: `Liquidación ${pct}% – ${String(product.name).slice(0, 60)}`,
      detalle: `Sin ventas en los últimos 90 días con ${stock} unidades en inventario. Una promoción del ${pct}% ayuda a mover el stock.`,
    };
  }
  if (product.units_30d > 0 && stock < Math.max(5, product.units_30d)) {
    return {
      tipo: 'stock',
      titulo: `Stock bajo – reponer ${String(product.name).slice(0, 60)}`,
      detalle: `Vendiste ${product.units_30d} unidades en 30 días y quedan solo ${stock}. Repón inventario para no perder ventas.`,
    };
  }
  if (stock > 500 && units90 > 0 && units90 <= 3) {
    return {
      tipo: 'porcentaje',
      valor: 10,
      titulo: `Promoción 10% – ${String(product.name).slice(0, 60)}`,
      detalle: `Inventario alto (${stock} unidades) con rotación lenta (${units90} uds en 90 días).`,
    };
  }
  return null;
};

const getStoreMeta = async (tiendaId) => {
  const { rows } = await pool.query(
    `SELECT t.nombres,
            COALESCE(t.moneda, pa.moneda, 'COP') AS moneda,
            COALESCE(t.locale, pa.locale, 'es-CO') AS locale
     FROM tiendas t LEFT JOIN paises pa ON pa.id = t.pais_id
     WHERE t.usrid = $1 LIMIT 1`,
    [tiendaId]
  );
  return {
    nombre: rows[0]?.nombres || 'Mi tienda',
    moneda: rows[0]?.moneda || 'COP',
    locale: rows[0]?.locale || 'es-CO',
  };
};

const ruleBasedSuggestions = async (tiendaId) => {
  const [products, buyers, storeMeta] = await Promise.all([
    catalogSnapshot(tiendaId),
    storeBuyerCount(tiendaId),
    getStoreMeta(tiendaId),
  ]);
  for (const p of products) {
    p.moneda = storeMeta.moneda;
    p.locale = storeMeta.locale;
  }
  if (products.length === 0) {
    return { stats: { seo: 0, promo: 0, stock: 0, social: 0, email: 0, skips: 0 }, totalProducts: 0 };
  }

  // Circuit breaker: si el LLM falla 3 veces seguidas, el resto del ciclo usa solo reglas.
  let llmFails = 0;
  const llmBreaker = async (fn, fallback) => {
    if (llmFails >= 3) return fallback;
    const res = await fn();
    if (res && res !== fallback) {
      llmFails = 0;
      return res;
    }
    llmFails += 1;
    return fallback;
  };

  const seoCandidates = products.filter((p) => !p.seo_title || !p.seo_keywords?.length || (p.description || '').length < 40);
  const stats = { seo: 0, promo: 0, stock: 0, social: 0, email: 0, skips: 0 };

  for (const product of seoCandidates.slice(0, 50)) {
    const fallbackSeo = {
      seo_title: ruleSeoTitle(product),
      keywords: ruleKeywords(product),
      description: product.description && product.description.length >= 80 ? null : ruleSeoDescription(product),
    };
    const llm = await llmBreaker(() => llmSeo(product), null);
    const payload = llm
      ? {
          seo_title: llm.seo_title || fallbackSeo.seo_title,
          keywords: llm.keywords?.length ? llm.keywords : fallbackSeo.keywords,
          description: llm.description || fallbackSeo.description,
        }
      : fallbackSeo;
    const inserted = await insertSuggestion({
      tiendaId,
      tipo: 'seo',
      fuente: llm ? 'llm' : 'rules',
      titulo: `SEO: ${truncate(product.name, 60)}`,
      detalle: `Meta título y palabras clave generados${llm ? ' con IA' : ''}. Aplicar actualiza el SEO del producto.`,
      payload,
      productId: product.id,
      dedupeKey: `seo:${product.id}`,
    });
    if (inserted) stats.seo += 1;
  }

  const orderedByValue = [...products].sort((a, b) => {
    const aScore = (a.units_30d || 0) * 2 + a.avg_rating * 0.5;
    const bScore = (b.units_30d || 0) * 2 + b.avg_rating * 0.5;
    return bScore - aScore;
  });

  const dateKey = new Date().toISOString().slice(0, 10);
  const featured = orderedByValue.filter((p) => p.units_30d > 0).slice(0, 3)
    .concat(products.filter((p) => !p.units_90d).slice(0, 2));
  const uniqFeatured = [...new Map(featured.map((p) => [p.id, p])).values()];

  for (const product of uniqFeatured.slice(0, 3)) {
    const rule = socialPost(product);
    const llm = await llmBreaker(() => llmSocial(product), null);
    const inserted = await insertSuggestion({
      tiendaId,
      tipo: 'social',
      fuente: llm ? 'llm' : 'rules',
      titulo: `Post: ${truncate(product.name, 60)}`,
      detalle: 'Contenido listo para publicar en tus redes. Copia el texto, adjunta una foto y publica.',
      payload: {
        ...rule,
        texto: llm?.texto || rule.texto,
        hashtags: llm?.hashtags || rule.hashtags,
        imagen: firstImage(product),
      },
      productId: product.id,
      dedupeKey: `social:${product.id}:${dateKey}`,
    });
    if (inserted) stats.social += 1;
  }

  const promoRanked = products
    .map((p) => ({ p, promo: suggestedPromo(p) }))
    .filter((x) => x.promo && x.promo.tipo === 'porcentaje')
    .sort((a, b) => Number(b.p.stock_total || 0) - Number(a.p.stock_total || 0))
    .slice(0, MAX_PROMOS_PER_RUN);

  for (const { p: product, promo } of promoRanked) {
    const inserted = await insertSuggestion({
      tiendaId,
      tipo: 'promo',
      fuente: 'rules',
      titulo: promo.titulo,
      detalle: promo.detalle,
      payload: { ...promo, productId: product.id, price: product.price },
      productId: product.id,
      dedupeKey: `promo:${product.id}`,
    });
    if (inserted) stats.promo += 1;
  }

  const stockRanked = products
    .map((p) => ({ p, promo: suggestedPromo(p) }))
    .filter((x) => x.promo && x.promo.tipo === 'stock');
  for (const { p: product, promo } of stockRanked) {
    const inserted = await insertSuggestion({
      tiendaId,
      tipo: 'stock',
      fuente: 'rules',
      titulo: promo.titulo,
      detalle: promo.detalle,
      payload: { productId: product.id, stock: product.stock_total, units_30d: product.units_30d },
      productId: product.id,
      dedupeKey: `stock:${product.id}`,
    });
    if (inserted) stats.stock += 1;
  }

  const storeName = storeMeta.nombre;
  const topForCampaign = orderedByValue.filter((p) => p.units_30d > 0).slice(0, 3);
  const campaignProducts = topForCampaign.length
    ? topForCampaign
    : products.filter((p) => !p.units_90d).slice(0, 3);
  const firstProduct = campaignProducts[0];
  const fallbackUrl = firstProduct?.public_id ? `/product/${firstProduct.public_id}` : '/listpr';
  const fallbackCamp = {
    title: topForCampaign.length
      ? `Lo más vendido de ${truncate(storeName, 40)}`
      : `Novedades de ${truncate(storeName, 40)}`,
    body: topForCampaign.length
      ? `${topForCampaign[0].name} y más. ¡Míralo antes de que se agote!`
      : 'Revisa los nuevos productos de la tienda. ¡Te van a encantar!',
  };
  const llmRes = await llmBreaker(() => llmCampaign({ storeName, top: campaignProducts }), null);
  const llmCamp = llmRes || fallbackCamp;
  const insertedEmail = await insertSuggestion({
    tiendaId,
    tipo: 'email',
    fuente: llmRes ? 'llm' : 'rules',
    titulo: `Campaña: ${llmCamp.title || fallbackCamp.title}`,
    detalle: `Audiencia: ${buyers.buyers} compradores (${buyers.push_ready} con push). Enviar notifica a tus compradores.`,
    payload: {
      title: llmCamp.title || fallbackCamp.title,
      body: llmCamp.body || fallbackCamp.body,
      url: llmCamp.url || fallbackUrl,
      audiencia: buyers,
      productos: campaignProducts.map((p) => ({ id: p.id, name: p.name, price: p.price, public_id: p.public_id })),
    },
    dedupeKey: `email:${dateKey}`,
  });
  if (insertedEmail) stats.email += 1;
  else stats.skips += 1;

  return { stats, totalProducts: products.length };
};

export const runMarketingAnalysis = async (tiendaId, { manual = false } = {}) => {
  const runId = await registerMarketingRun(tiendaId, manual ? 'manual' : 'auto');
  try {
    const result = await ruleBasedSuggestions(tiendaId);
    await finishMarketingRun(runId, {
      stats: result.stats,
      totalProducts: result.totalProducts,
      llm: { enabled: !!(process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY) },
    });
    return { runId, ...result };
  } catch (err) {
    await finishMarketingRun(runId, {}, err.message);
    throw err;
  }
};
