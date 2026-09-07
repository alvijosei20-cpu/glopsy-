import axios from 'axios';
import { pool } from '../db.js';
import { getShippingOptionsFromEnvia } from './envia.service.js';

const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const TIMEOUT_MS = Number(process.env.ASSISTANT_TIMEOUT_MS) || 20000;

// Límites: 3 consultas con IA por producto (por IP/día) y 300 caracteres por pregunta.
export const ASSISTANT_BUDGET_LIMIT = 3;
export const ASSISTANT_MAX_MSG_CHARS = 300;

const BUDGETS = new Map(); // key "producto:ip" -> { date, count } (por día)

const today = () => new Date().toISOString().slice(0, 10);

const budgetState = (key) => {
  const cur = BUDGETS.get(key);
  if (!cur || cur.date !== today()) return { date: today(), count: 0 };
  return cur;
};

const budgetUse = (key) => {
  const s = budgetState(key);
  s.count += 1;
  BUDGETS.set(key, s);
  return s;
};

const budgetInfo = (state) => ({
  limit: ASSISTANT_BUDGET_LIMIT,
  used: state.count,
  remaining: Math.max(0, ASSISTANT_BUDGET_LIMIT - state.count),
});

// ------------------------------------------------------------------ Herramientas
// El asistente consulta el catálogo real por SQL: sugerencias, comparativas y stock.

// Envío gratis aplicable a un producto según la ciudad del usuario (misma lógica del catálogo /listpr).
const freeShippingExists = (cityPh) => `EXISTS (
    SELECT 1
    FROM perfiles_envio pe
    LEFT JOIN ciudades ci ON pe.ciudad_id = ci.id
    WHERE pe.tipo_envio = 'gratis'
      AND (
        (pe.alcance = 'global' AND pe.tienda_id = p.tienda_id)
        OR (pe.alcance = 'ciudad' AND pe.id = p.perfil_envio_id AND $${cityPh}::text IS NOT NULL
            AND (LOWER(ci.nombre) = LOWER($${cityPh}::text) OR ci.id::text = $${cityPh}::text))
      )
  )`;

const catalogSelect = (cityPh) => `
  SELECT p.id, p.public_id, p.name, p.base_price, p.suggested_price, p.stock_total,
         cat.nombre AS categoria_nombre,
         t.nombres AS proveedor,
         fc.nombre AS ciudad,
         COALESCE(p.status,'active') = 'active' AS activo,
         COALESCE(t.activa, true) AS tienda_activa,
         p.warranties,
         (SELECT COUNT(*)::int FROM reviews rv WHERE rv.product_id = p.id) AS review_count,
         (SELECT COALESCE(AVG(rv.rating),0)::numeric(3,2) FROM reviews rv WHERE rv.product_id = p.id) AS avg_rating,
         ${freeShippingExists(cityPh)} AS envio_gratis
  FROM produc p
  LEFT JOIN categorias cat ON cat.id = p.categoria_id
  LEFT JOIN tiendas t ON t.usrid = p.tienda_id
  LEFT JOIN fullments f ON p.fullm_id = f.id
  LEFT JOIN ciudades fc ON f.ciudad_id = fc.id`;

const mapCatalogRow = (r) => ({
  public_id: r.public_id,
  name: r.name,
  categoria: r.categoria_nombre || '',
  proveedor: r.proveedor || '',
  precio: Number(r.suggested_price ?? r.base_price ?? 0),
  stock: Number(r.stock_total || 0),
  calificacion: Number(r.avg_rating || 0).toFixed(1),
  reseñas: r.review_count || 0,
  ciudad: r.ciudad || '',
  envio_gratis: !!r.envio_gratis,
  garantia: fmtWarranty(r.warranties),
  url: `/product/${r.public_id}`,
});

// Normaliza nombres de ciudad (minúsculas, sin acentos ni puntuación) para comparar.
const normCity = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

// Parsea warranties: objeto { period, conditions }, array o string JSON. Devuelve { period, conditions } o null.
const parseWarranty = (raw) => {
  let w = raw;
  if (!w) return null;
  if (typeof w === 'string') {
    try {
      w = JSON.parse(w);
    } catch {
      return null;
    }
  }
  if (Array.isArray(w)) {
    const parts = w.map((x) => {
      if (!x) return '';
      if (typeof x === 'string') return x;
      return String(x?.titulo || x?.descripcion || x?.conditions || x?.period || '');
    }).filter(Boolean);
    return parts.length ? { period: '', conditions: parts.join('. ') } : null;
  }
  if (typeof w === 'object') {
    const period = String(w?.period || w?.periodo || w?.dias || w?.days || '').trim();
    const conditions = String(w?.conditions || w?.condiciones || w?.descripcion || w?.detalle || '').trim();
    if (!period && !conditions) return null;
    return { period, conditions };
  }
  return null;
};

// Resumen corto de garantía legible para el modelo/usuario.
const fmtWarranty = (raw) => {
  const w = parseWarranty(raw);
  if (!w) return '';
  const period = w.period ? `${w.period}${/^\d+$/.test(w.period) ? ' días' : ''} de garantía` : '';
  const conditions = w.conditions && w.conditions.length <= 400 ? w.conditions : '';
  return [period, conditions].filter(Boolean).join('. ') || 'Con garantía';
};

const searchCatalog = async ({ q = '', categoria = '', proveedor = '', max = 6, ciudad = '' } = {}) => {
  const where = ["p.status = 'active'", "COALESCE(t.activa, true) = true"];
  const values = [];
  const cleanQ = String(q || '').trim().slice(0, 120);
  const cleanCat = String(categoria || '').trim().slice(0, 80);
  const cleanProv = String(proveedor || '').trim().slice(0, 80);
  const cleanCiudad = String(ciudad || '').trim().slice(0, 120);
  if (cleanQ) {
    values.push(`%${cleanQ}%`);
    where.push(`(p.name ILIKE $${values.length} OR p.description ILIKE $${values.length})`);
  }
  if (cleanCat) {
    values.push(cleanCat);
    where.push(`cat.nombre ILIKE $${values.length}`);
  }
  if (cleanProv) {
    values.push(cleanProv);
    where.push(`t.nombres ILIKE $${values.length}`);
  }
  // La ciudad del usuario se agrega como parámetro para calcular envio_gratis en el SELECT.
  values.push(cleanCiudad || null);
  const cityPh = values.length;
  const limit = Math.max(1, Math.min(8, Number(max) || 6));
  values.push(limit);
  const { rows } = await pool.query(
    `${catalogSelect(cityPh)} WHERE ${where.join(' AND ')}
     ORDER BY (SELECT COALESCE(AVG(rv.rating),0) FROM reviews rv WHERE rv.product_id = p.id) DESC
     LIMIT $${values.length}`,
    values
  );
  return rows.map(mapCatalogRow);
};

const getProductFull = async (publicIdOrId, ciudad = '') => {
  const identifier = String(publicIdOrId || '').trim().slice(0, 100);
  if (!identifier) return null;
  const where = /^\d+$/.test(identifier) ? 'p.id = $1' : 'p.public_id = $1';
  const cleanCiudad = String(ciudad || '').trim().slice(0, 120);
  const { rows } = await pool.query(
    `${catalogSelect(2)} WHERE ${where} LIMIT 1`,
    [identifier, cleanCiudad || null]
  );
  const r = rows[0];
  if (!r) return null;
  return mapCatalogRow(r);
};

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'buscar_catalogo',
      description:
        'Busca productos reales del catálogo por nombre, categoría o proveedor/vendedor. Úsalo para recomendar alternativas parecidas, productos del mismo vendedor, comparar precios o confirmar disponibilidad. Cada resultado trae envio_gratis (si el envío es gratis para la ciudad del cliente) y ciudad (ciudad desde donde se despacha).',
      parameters: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Términos de búsqueda, p. ej. "zapatillas adidas", "sneakers negros"' },
          categoria: { type: 'string', description: 'Categoría exacta a filtrar (opcional), p. ej. "Ropa y Calzado"' },
          proveedor: { type: 'string', description: 'Nombre del proveedor/vendedor a filtrar (opcional). P. ej. para recomendar otros productos del mismo vendedor' },
          max: { type: 'number', description: 'Cantidad máxima de resultados (1-8). Por defecto 6' },
        },
        required: ['q'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_producto',
      description:
        'Consulta un producto concreto del catálogo por su public_id o id para conocer precio, stock, ciudad de despacho, si su envío es gratis para la ciudad del cliente (envio_gratis) y su garantía (garantia).',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'public_id o id del producto' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cotizar_envio',
      description:
        'Cotiza el envío en tiempo real (ENVIA) de un producto del catálogo hacia la ciudad del cliente: devuelve transportadora, costo y cuántos días tardaría en llegar. Úsalo cuando pregunten cuánto cuesta el envío, cuánto/cuántos días tarda o cuándo llegaría un producto a su ciudad.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'public_id o id del producto a cotizar (opcional; si se omite, cotiza el producto que el cliente está viendo)' },
        },
      },
    },
  },
];

const runTool = async (name, rawArgs, ciudad = '', defaultProductId = '') => {
  try {
    const args = JSON.parse(rawArgs || '{}');
    if (name === 'buscar_catalogo') {
      const res = await searchCatalog({ ...args, ciudad });
      return JSON.stringify({ resultados: res.length ? res : [] });
    }
    if (name === 'ver_producto') {
      const res = await getProductFull(args.id, ciudad);
      return JSON.stringify(res || { error: 'Producto no encontrado en el catálogo.' });
    }
    if (name === 'cotizar_envio') {
      const id = String(args.id || defaultProductId || '').trim().slice(0, 100);
      const res = await quoteShippingDelivery(id, ciudad);
      return JSON.stringify(res);
    }
    return JSON.stringify({ error: 'Herramienta desconocida.' });
  } catch (err) {
    // Nunca devolver detalles internos al modelo externo: solo un mensaje genérico.
    console.error('[product-assistant] error en herramienta:', name, err.message);
    return JSON.stringify({ error: 'No fue posible consultar el catálogo en este momento.' });
  }
};

// Estado de envío del producto que el cliente está viendo (misma lógica del catálogo).
const currentProductShipping = async (product, ciudad = '') => {
  const identifier = product?.id || product?.public_id;
  if (!identifier) return { envio_gratis: false, ciudad: '' };
  const where = /^\d+$/.test(String(identifier)) ? 'p.id = $1' : 'p.public_id = $1';
  const city = String(ciudad || '').trim().slice(0, 120) || null;
  try {
    const { rows } = await pool.query(
      `${catalogSelect(2)} WHERE ${where} LIMIT 1`,
      [identifier, city]
    );
    if (!rows[0]) return { envio_gratis: false, ciudad: '' };
    return {
      envio_gratis: !!rows[0].envio_gratis,
      ciudad: rows[0].ciudad || product?.ciudad_nombre || product?.ciudad || '',
    };
  } catch (err) {
    console.warn('[product-assistant] sin datos de envío del producto:', err.message);
    return { envio_gratis: false, ciudad: product?.ciudad_nombre || product?.ciudad || '' };
  }
};

// Resuelve la ciudad destino por nombre (o id numérico) hacia un id de ciudades.
const resolveDestCityId = async (ciudad) => {
  const raw = String(ciudad || '').trim().slice(0, 120);
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  const target = normCity(raw);
  try {
    const [{ rows }, { rows: covRows }] = await Promise.all([
      pool.query(`SELECT id, nombre FROM ciudades`),
      pool.query(`SELECT DISTINCT f.ciudad_id FROM fullments f WHERE f.estado = 'activo'`),
    ]);
    const covSet = new Set((covRows || []).map((r) => Number(r.ciudad_id)));
    const scored = (rows || []).map((r) => {
      const n = normCity(r.nombre);
      if (!n) return null;
      let score = 0;
      if (n === target) score = 3;
      else if (n.includes(target) || target.includes(n)) score = 1;
      if (covSet.has(Number(r.id))) score += 10;
      return score > 0 ? { id: r.id, score } : null;
    }).filter(Boolean).sort((a, b) => b.score - a.score);
    return scored.length ? scored[0].id : null;
  } catch (err) {
    console.warn('[product-assistant] sin lista de ciudades:', err.message);
    return null;
  }
};

// Cotiza en ENVIA (tarifas reales) cuántos días tarda y cuánto cuesta enviar 1 unidad a la ciudad del cliente.
const quoteShippingDelivery = async (identifier, ciudad) => {
  const cleanId = String(identifier || '').trim().slice(0, 100);
  if (!cleanId) return { error: 'Falta el identificador del producto para cotizar.' };
  const destId = await resolveDestCityId(ciudad);
  if (!destId) return { error: 'No se reconoció la ciudad de destino para cotizar el envío.' };

  let prod = null;
  try {
    const where = /^\d+$/.test(cleanId) ? 'p.id = $1' : 'p.public_id = $1';
    const { rows } = await pool.query(
      `SELECT p.id, p.tienda_id, p.name,
              COALESCE(p.peso, e.peso, $2) AS peso,
              COALESCE(p.largo, e.largo, $3) AS largo,
              COALESCE(p.alto, e.alto, $4) AS alto,
              COALESCE(p.ancho, e.ancho, $5) AS ancho
       FROM produc p
       LEFT JOIN tipo_empaque e ON e.id = p.tipo_empaque_id
       WHERE ${where} LIMIT 1`,
      [cleanId, Number(process.env.ENVIA_DEFAULT_WEIGHT || 1), Number(process.env.ENVIA_DEFAULT_LENGTH || 10), Number(process.env.ENVIA_DEFAULT_HEIGHT || 10), Number(process.env.ENVIA_DEFAULT_WIDTH || 10)]
    );
    prod = rows[0] || null;
  } catch (err) {
    console.warn('[product-assistant] sin datos para cotizar:', err.message);
  }
  if (!prod) return { error: 'Producto no encontrado para cotizar el envío.' };

  try {
    const items = [{
      id: prod.id,
      name: prod.name || 'Producto',
      quantity: 1,
      weight: Number(prod.peso) || 1,
      length: Number(prod.largo) || 10,
      height: Number(prod.alto) || 10,
      width: Number(prod.ancho) || 10,
    }];
    const { shippingOptions } = await getShippingOptionsFromEnvia(items, destId, prod.tienda_id);
    const opts = (Array.isArray(shippingOptions) ? shippingOptions : [])
      .map((o) => ({
        transportadora: o.carrier || o.provider || '',
        servicio: o.service || 'Standard',
        precio: Math.round(Number(o.price) || 0),
        dias: o.delivery_estimate || o.deliveryEstimate || '',
      }))
      .filter((o) => o.precio > 0 && o.transportadora);
    if (!opts.length) {
      return { error: 'La tienda aún no tiene tarifas de envío ENVIA para esta ciudad.' };
    }
    return { destino: String(ciudad || '').trim() || null, opciones: opts };
  } catch (err) {
    console.warn('[product-assistant] ENVIA no disponible:', err.message);
    return { error: 'No fue posible cotizar el envío en este momento.' };
  }
};

// ------------------------------------------------------------------ Contexto

const buildSystem = (product, ciudad) => {
  const base = Number(product?.suggested_price ?? product?.base_price ?? 0);
  let precio = base;
  const of = product?.oferta_activa;
  if (of) {
    if (of.tipo === 'porcentaje') precio = base * (1 - Number(of.valor || 0) / 100);
    else if (of.tipo === 'monto_fijo') precio = Math.max(0, base - Number(of.valor || 0));
  }
  const stock = Number(product?.stock_total || 0);
  const envioGratis = product?.envio_gratis ? 'SÍ' : 'NO';
  const ciudadDespacho = product?.ciudad_despacho || product?.ciudad_nombre || 'no especificada';
  const garantia = fmtWarranty(product?.warranties) || 'Información según el proveedor (aparece en la página).';
  return `Eres "GlopsyBot", el asesor virtual de Glopsy (marketplace colombiano) que aparece en la ficha de un producto.

Producto que está viendo el cliente:
- Nombre: ${product?.name || '—'}
- Categoría: ${product?.categoria_nombre || product?.category || 'General'}
- Precio final: $${Math.round(precio).toLocaleString('es-CO')} COP${of ? ` (con ${of.tipo === 'porcentaje' ? `${of.valor}% de descuento` : `descuento de $${of.valor}`} aplicado)` : ''}
- Stock: ${stock} ${stock === 1 ? 'unidad' : 'unidades'}${stock <= 0 ? ' — AGOTADO, sugiere alternativas' : ''}
- Ciudad de envío del cliente: ${ciudad || 'no especificada'}
- Ciudad desde donde se despacha el producto: ${ciudadDespacho}
- Envío gratis para la ciudad del cliente: ${envioGratis}
- Garantía: ${garantia}
- Tienda del producto: ${product?.tienda_nombre || product?.proveedor || 'Glopsy'}
- Calificación: ${Number(product?.avg_rating || 0).toFixed(1)}/5 (${Number(product?.review_count || 0)} reseñas)

Puedes consultar TODO el catálogo real usando las herramientas buscar_catalogo y ver_producto para:
- recomendar productos parecidos o en oferta,
- recomendar OTROS productos del MISMO proveedor/vendedor (usa buscar_catalogo con proveedor = nombre de la tienda),
- comparar precios y stock entre productos,
- sugerir qué comprar según el presupuesto/interés del cliente.

Cada resultado de estas herramientas incluye: nombre, precio, stock, ciudad (desde donde se despacha), envio_gratis (si el envío es gratis para la ciudad del cliente) y garantia (texto de la garantía del producto).

Para saber cuánto cuesta el envío o cuántos días tardaría en llegar un producto a la ciudad del cliente usa la herramienta cotizar_envio, que cotiza en ENVIA en tiempo real.

Reglas:
1. Responde en español con respuestas CORTAS y PRECISAS. Ve directo al dato que piden: sin rodeos ni repeticiones.
2. NUNCA inventes precios, stock, descuentos, envíos, tiempos de entrega ni garantías: usa las herramientas o la información anterior. Si cotizar_envio no devuelve opciones o falla, dilo sin inventar días ni costos.
3. Cuando el cliente pida una RECOMENDACIÓN, alternativa o productos similares: SIEMPRE consulta buscar_catalogo (o ver_producto) y responde ENUMERANDO los productos encontrados (máx 3). Cada producto debe ir como enlace clicable: [Nombre del producto](/product/public_id), seguido de su precio y su envío: si es gratis para la ciudad del cliente ("Envío gratis") o no, y desde qué ciudad se despacha. Al final añade [Ver todos en el catálogo](/listpr). NUNCA respondas una recomendación solo con el enlace del catálogo ni sin productos concretos.
4. Si el producto está agotado, ofrece alternativas concretas consultando el catálogo.
5. No des consejos médicos, financieros ni prometas resultados.
6. Si te preguntan cómo comprar: indica que use "Comprar ahora" o "Agregar al carrito" y complete el pago; el envío se calcula según la ciudad en el checkout.
7. Si no hay stock o el precio no está claro, dilo y sugiere preguntar al vendedor.
8. Si preguntan por la GARANTÍA, devoluciones o cambios del producto: responde con la información de la línea "Garantía:" de arriba o la que traiga ver_producto (garantia). Si no hay datos específicos, explica el respaldo de Glopsy (el pago se libera al vendedor al confirmar la entrega y se pueden abrir reclamaciones desde "Consultar pedido") sin inventar términos.`.replace(/\n{3,}/g, '\n\n');
};

// ------------------------------------------------------------------ Chat con tools

const MAX_TOOL_ROUNDS = 4;
const MAX_HISTORY = 12;

// ------------------------------------------------------------------ Fallback sin IA
// Si DeepSeek no está disponible se responde con FAQ local basada en datos reales.

const fmtCOP = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')} COP`;

const fallbackAnswer = async ({ product, ciudad, lastMessage }) => {
  const base = Number(product?.suggested_price ?? product?.base_price ?? 0);
  let precio = base;
  const of = product?.oferta_activa;
  if (of) {
    if (of.tipo === 'porcentaje') precio = base * (1 - Number(of.valor || 0) / 100);
    else if (of.tipo === 'monto_fijo') precio = Math.max(0, base - Number(of.valor || 0));
  }
  const stock = Number(product?.stock_total || 0);
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const msg = String(lastMessage || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const mentions = (...words) => words.some((w) => msg.includes(w));

  const asksDeliveryTime = mentions('cuanto tarda', 'cuantos dias', 'cuantos días', 'en cuanto llega', 'cuando llega', 'en cuanto tiempo', 'tiempo de entrega', 'tiempo de llegada', 'dias tarda', 'días tarda', 'llegaria', 'llegaría');

  if (mentions('envio', 'envian', 'llega', 'tardas', 'cuanto cuesta el envio', 'domicilio') || asksDeliveryTime) {
    const despacho = product?.ciudad_despacho || product?.ciudad_nombre || 'la ciudad de la tienda';
    const destino = ciudad || 'no especificada';

    // Si preguntan por el tiempo de llegada, intenta cotizar en ENVIA (tiempo real).
    if (asksDeliveryTime) {
      try {
        const quote = await quoteShippingDelivery(product?.public_id || product?.id, ciudad);
        if (quote && quote.opciones?.length) {
          const lines = quote.opciones
            .slice(0, 3)
            .map((o) => `• ${o.transportadora}${o.servicio ? ` (${o.servicio})` : ''}: ${fmtCOP(o.precio)}${o.dias ? ` · llega en ~${o.dias}` : ''}`)
            .join('\n');
          return `Sobre el tiempo de llegada de "${product?.name}" a ${destino}:\n${lines}\n\nEstos son tiempos/costos estimados de ENVIA según tu ciudad y se confirman en el checkout.`;
        }
      } catch {
        // si ENVIA falla, cae al texto genérico de envío
      }
      return `Sobre el envío de "${product?.name}" a ${destino}:\n• Se despacha desde ${despacho}.\n• El tiempo y costo exactos se calculan en el checkout con las transportadoras según tu ciudad.\n• Revisa en la página si la tienda ofrece envío gratis o descuentos.`;
    }

    if (product?.envio_gratis) {
      return `El envío de "${product?.name}" es GRATIS para tu ciudad (${destino}).\n• Se despacha desde ${despacho}.\n• En el checkout se confirma la cobertura y los tiempos.`;
    }
    return `Sobre el envío de "${product?.name}":\n• Se despacha desde ${despacho}.\n• El costo se calcula en el checkout según tu ciudad (${destino}).\n• Revisa en la página si la tienda ofrece envío gratis o descuentos (proveedor) para tiempos y cobertura.`;
  }
  if (mentions('garantia', 'garanti', 'reembolso', 'devolucion', 'cambios', 'falla', 'defecto')) {
    const w = product?.warranties;
    const texto = fmtWarranty(w);
    if (texto) {
      return `Garantía de "${product?.name}": ${texto}.`;
    }
    return `Sobre garantía/reembolsos:\n• Glopsy protege tu compra: el pago se libera al vendedor cuando confirmas que el pedido llegó bien.\n• Si algo falla, puedes abrir una reclamación desde "Consultar pedido".\n• Detalles de garantía de este producto aparecen en la sección del proveedor.`;
  }
  if (mentions('stock', 'disponible', 'agotado', 'hay unidades', 'talla', 'quedan')) {
    if (stock <= 0) return `Este producto está agotado ahora mismo. Prueba con "Recomiéndame algo similar" para ver alternativas.`;
    let extra = '';
    if (variants.length) extra = `\nOpciones disponibles: ${variants.map((v) => v?.name || v?.title || '').filter(Boolean).join(', ')}.`;
    return `Disponibilidad de "${product?.name}":\n• Quedan ${stock} ${stock === 1 ? 'unidad' : 'unidades'} en stock.\n• Precio: ${fmtCOP(precio)}${extra}\n• Agrega al carrito o usa "Comprar ahora" para reservarlo.`;
  }
  if (mentions('precio', 'cuanto cuesta', 'costo', 'cuanto vale', 'oferta', 'descuento', 'barato', 'caro')) {
    const orig = of ? `\nPrecio original: ${fmtCOP(base)} (${of.tipo === 'porcentaje' ? `${of.valor}% de descuento` : `descuento de ${fmtCOP(of.valor)}`})` : '';
    return `Precio de "${product?.name}": ${fmtCOP(precio)}${orig}\n• IVA incluido.\n• El envío se suma en el checkout según tu ciudad (${ciudad || '—'}).`;
  }
  if (mentions('como comprar', 'como compro', 'como lo compro', 'como pago', 'como lo pago', 'comprar ahora', 'quiero comprar', 'pagar', 'pedido', 'compra', 'comprarlo')) {
    return `Cómo comprar "${product?.name}":\n1. Pulsa "Comprar ahora" (o agrégalo al carrito).\n2. Elige cantidad/variante y verifica tu dirección de envío.\n3. Paga con Mercado Pago (tarjeta, PSE, etc.) de forma segura.\n4. Sigue tu pedido en "Consultar pedido".`;
  }
  if (mentions('calificacion', 'reseñas', 'opiniones', 'rating', 'bueno', 'recomendado', 'estrellas')) {
    const rc = Number(product?.review_count || 0);
    if (rc > 0) return `"${product?.name}" tiene ${Number(product?.avg_rating || 0).toFixed(1)}/5 estrellas basado en ${rc} ${rc === 1 ? 'reseña' : 'reseñas'}. Puedes leerlas más abajo en la página.`;
    return `Este producto aún no tiene reseñas. Si lo compras, podrás ser el primero en opinar tras recibirlo.`;
  }
  if (mentions('recomiendame algo similar', 'alternativa', 'parecido', 'similar', 'opciones', 'otro', 'recomiendame', 'sugiere', 'mismo proveedor', 'misma tienda', 'mismo vendedor', 'de la misma tienda', 'del mismo vendedor', 'del mismo proveedor')) {
    const key = msg.replace(/recomiendame|algo|similar|parecido|alternativa|de|menor|precio|mas|barato|otra|opcion|opciones|sugiere|un|una|del/g, ' ').replace(/\s+/g, ' ').trim();
    const wantSameProvider = mentions('mismo proveedor', 'misma tienda', 'mismo vendedor', 'de la misma tienda', 'del mismo vendedor', 'del mismo proveedor');
    const categ = product?.categoria_nombre || product?.category || '';
    try {
      const prov = product?.proveedor || product?.tienda_nombre || '';
      const excludeSelf = (arr) => arr.filter((r) => String(r.name || '').toLowerCase() !== String(product?.name || '').toLowerCase());
      let others = [];
      // Del mismo proveedor siempre que se pida, sino parecidos por nombre.
      if (wantSameProvider && prov) {
        others = excludeSelf(await searchCatalog({ proveedor: prov, max: 6, ciudad }));
      } else if (key && key !== product?.name) {
        others = excludeSelf(await searchCatalog({ q: key, max: 6, ciudad }));
      }
      // Si aún no hay sugerencias concretas, busca por la misma categoría.
      if (!others.length && categ) {
        others = excludeSelf(await searchCatalog({ q: '', categoria: categ, max: 6, ciudad }));
      }
      // Último recurso: populares del catálogo.
      if (!others.length) {
        others = excludeSelf(await searchCatalog({ q: '', max: 6, ciudad }));
      }
      const head = wantSameProvider && prov
        ? `Otros productos del proveedor **${prov}**:`
        : 'Alternativas parecidas:';
      if (!others.length) {
        return `No encontré ${wantSameProvider ? 'otros productos del mismo proveedor' : 'productos muy parecidos'} a "${product?.name}" en este momento. Explora más en [Catálogo](/listpr).`;
      }
      const lines = others
        .slice(0, 4)
        .map((r) => `• ${fmtCOP(r.precio)} · [${r.name}](${r.url})${r.envio_gratis ? ' · 🚚 Envío gratis' : ''}${r.ciudad ? ` · desde ${r.ciudad}` : ''}${r.stock > 0 ? '' : ' · agotado'}${r.calificacion && Number(r.calificacion) > 0 ? ` · ⭐${r.calificacion}` : ''}`)
        .join('\n');
      return `${head}\n${lines}\n\n¿Quieres ver más opciones? [Catálogo](/listpr)`;
    } catch {
      return `No pude consultar las alternativas ahora. Explora la categoría "${product?.categoria_nombre || product?.category || 'General'}" desde [Catálogo](/listpr).`;
    }
  }
  if (mentions('hola', 'buenas', 'hey', 'que tal', 'buenos dias', 'buenas tardes', 'buenas noches')) {
    return `¡Hola! 👋 Soy el asistente de "${product?.name}".\nPuedo decirte su precio, stock, envío, garantía o recomendarte alternativas del catálogo.`;
  }

  return `Puedo ayudarte con "${product?.name}" (${product?.categoria_nombre || product?.category || 'General'}): precio ${fmtCOP(precio)}, ${stock} en stock. Pregúntame por envío, garantía, reseñas o pídeme alternativas.`;
};

const callModel = async (messages) => {
  const { data } = await axios.post(
    `${BASE_URL}/chat/completions`,
    {
      model: MODEL,
      messages,
      temperature: 0.5,
      max_tokens: 700,
      tools: TOOLS,
      tool_choice: 'auto',
    },
    {
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      timeout: TIMEOUT_MS,
    }
  );
  return data?.choices?.[0]?.message || null;
};

// budgetKey: "public_id:ip". Solo se descuenta cuando la IA se llama de verdad.
export const productAssistantChat = async ({ product, ciudad = '', messages = [], budgetKey = '' }) => {
  const clean = (m) => ({
    role: m?.role === 'assistant' ? 'assistant' : 'user',
    content: String(m?.content || '').replace(/\s+/g, ' ').trim().slice(0, ASSISTANT_MAX_MSG_CHARS),
  });

  const history = (Array.isArray(messages) ? messages : [])
    .map(clean)
    .filter((m) => m.content)
    .slice(-MAX_HISTORY);

  if (!history.length || history[history.length - 1].role !== 'user') {
    throw new Error('Mensaje inválido.');
  }

  // Enriquecer el contexto con el envío y la ciudad de despacho del producto actual.
  const ship = await currentProductShipping(product, ciudad).catch(() => ({ envio_gratis: false, ciudad: '' }));
  const ctxProduct = {
    ...(product || {}),
    envio_gratis: Boolean(ship.envio_gratis),
    ciudad_despacho: ship.ciudad || product?.ciudad_nombre || product?.ciudad || '',
  };

  const budget = budgetKey ? budgetState(budgetKey) : { date: today(), count: 0 };

  // Sin API key → FAQ local gratis (no descuenta IA).
  if (!API_KEY) {
    const reply = await fallbackAnswer({ product: ctxProduct, ciudad, lastMessage: history[history.length - 1].content });
    return { ok: true, reply, fallback: true, budget: budgetInfo(budget) };
  }

  // Límite de consultas IA alcanzado → se sigue ayudando con FAQ local (gratis, sin LLM).
  if (budgetKey && budget.count >= ASSISTANT_BUDGET_LIMIT) {
    const reply = await fallbackAnswer({ product: ctxProduct, ciudad, lastMessage: history[history.length - 1].content });
    return { ok: true, reply, fallback: true, budget: budgetInfo(budget) };
  }

  const msgs = [{ role: 'system', content: buildSystem(ctxProduct, ciudad) }, ...history];
  const used = budgetKey ? budgetUse(budgetKey) : { ...budget, count: budget.count + 1 };
  const info = budgetInfo(used);

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const msg = await callModel(msgs);
      if (!msg) throw new Error('No hubo respuesta del modelo.');

      const toolCalls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
      msgs.push({ role: 'assistant', content: msg.content || '', tool_calls: toolCalls.length ? toolCalls : undefined });

      if (!toolCalls.length) {
        return { ok: true, reply: (msg.content || '').trim(), budget: info };
      }

      for (const tc of toolCalls) {
        const name = tc?.function?.name || '';
        const args = tc?.function?.arguments || '{}';
        const result = await runTool(name, args, ciudad, ctxProduct.public_id || ctxProduct.id);
        msgs.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }
    }
  } catch (err) {
    console.warn('[product-assistant] IA no disponible, respondiendo con fallback:', err.message);
    const reply = await fallbackAnswer({ product: ctxProduct, ciudad, lastMessage: history[history.length - 1].content });
    return { ok: true, reply, fallback: true, budget: info };
  }

  return { ok: true, reply: 'Ups, tardé demasiado en organizar la respuesta. Vuelve a preguntarme 🙂', budget: info };
};
