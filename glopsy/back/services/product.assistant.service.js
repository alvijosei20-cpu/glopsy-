import axios from 'axios';
import { pool } from '../db.js';

const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const TIMEOUT_MS = Number(process.env.ASSISTANT_TIMEOUT_MS) || 20000;

export const assistantConfigured = () => Boolean(API_KEY);

const cleanText = (text, max = 500) =>
  String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const firstSrc = (x) => (typeof x === 'string' ? x : x?.src || '');

// ------------------------------------------------------------------ Herramientas
// El asistente consulta el catálogo real por SQL: sugerencias, comparativas y stock.

const CATALOG_SELECT = `
  SELECT p.id, p.public_id, p.name, p.base_price, p.suggested_price, p.stock_total,
         cat.nombre AS categoria_nombre,
         COALESCE(p.status,'active') = 'active' AS activo,
         COALESCE(t.activa, true) AS tienda_activa,
         (SELECT COUNT(*)::int FROM reviews rv WHERE rv.product_id = p.id) AS review_count,
         (SELECT COALESCE(AVG(rv.rating),0)::numeric(3,2) FROM reviews rv WHERE rv.product_id = p.id) AS avg_rating
  FROM produc p
  LEFT JOIN categorias cat ON cat.id = p.categoria_id
  LEFT JOIN tiendas t ON t.usrid = p.tienda_id`;

const searchCatalog = async ({ q = '', categoria = '', max = 6 } = {}) => {
  const where = ["p.status = 'active'", "COALESCE(t.activa, true) = true"];
  const values = [];
  const cleanQ = String(q || '').trim().slice(0, 120);
  const cleanCat = String(categoria || '').trim().slice(0, 80);
  if (cleanQ) {
    values.push(`%${cleanQ}%`);
    where.push(`(p.name ILIKE $${values.length} OR p.description ILIKE $${values.length})`);
  }
  if (cleanCat) {
    values.push(cleanCat);
    where.push(`cat.nombre ILIKE $${values.length}`);
  }
  const limit = Math.max(1, Math.min(8, Number(max) || 6));
  values.push(limit);
  const { rows } = await pool.query(
    `${CATALOG_SELECT} WHERE ${where.join(' AND ')}
     ORDER BY (SELECT COALESCE(AVG(rv.rating),0) FROM reviews rv WHERE rv.product_id = p.id) DESC
     LIMIT $${values.length}`,
    values
  );
  return rows.map((r) => ({
    id: r.id,
    public_id: r.public_id,
    name: r.name,
    categoria: r.categoria_nombre || '',
    precio: Number(r.suggested_price ?? r.base_price ?? 0),
    stock: Number(r.stock_total || 0),
    calificacion: Number(r.avg_rating || 0).toFixed(1),
    reseñas: r.review_count || 0,
    url: `/product/${r.public_id}`,
  }));
};

const getProductFull = async (publicIdOrId) => {
  const identifier = String(publicIdOrId || '').trim().slice(0, 100);
  if (!identifier) return null;
  const where = /^\d+$/.test(identifier) ? 'p.id = $1' : 'p.public_id = $1';
  const { rows } = await pool.query(
    `${CATALOG_SELECT} WHERE ${where} LIMIT 1`,
    [identifier]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    public_id: r.public_id,
    name: r.name,
    categoria: r.categoria_nombre || '',
    descripcion: cleanText(r.description, 400),
    precio: Number(r.suggested_price ?? r.base_price ?? 0),
    stock: Number(r.stock_total || 0),
    calificacion: Number(r.avg_rating || 0).toFixed(1),
    reseñas: r.review_count || 0,
    tienda_activa: r.tienda_activa,
    url: `/product/${r.public_id}`,
  };
};

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'buscar_catalogo',
      description:
        'Busca productos reales del catálogo de la tienda por nombre o categoría. Úsalo para sugerir alternativas, comparar precios, recomendar productos parecidos o confirmar disponibilidad.',
      parameters: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Términos de búsqueda, p. ej. "zapatillas adidas", "sneakers negros"' },
          categoria: { type: 'string', description: 'Categoría exacta a filtrar (opcional), p. ej. "Ropa y Calzado"' },
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
        'Consulta un producto concreto del catálogo por su public_id o id para conocer precio, stock y detalles.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'public_id o id del producto' },
        },
        required: ['id'],
      },
    },
  },
];

const runTool = async (name, rawArgs) => {
  try {
    const args = JSON.parse(rawArgs || '{}');
    if (name === 'buscar_catalogo') {
      const res = await searchCatalog(args);
      return JSON.stringify({ resultados: res.length ? res : [] });
    }
    if (name === 'ver_producto') {
      const res = await getProductFull(args.id);
      return JSON.stringify(res || { error: 'Producto no encontrado en el catálogo.' });
    }
    return JSON.stringify({ error: 'Herramienta desconocida.' });
  } catch (err) {
    return JSON.stringify({ error: `Error ejecutando ${name}: ${err.message}` });
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
  return `Eres "GlopsyBot", el asesor virtual de Glopsy (marketplace colombiano) que aparece en la ficha de un producto.

Producto que está viendo el cliente:
- Nombre: ${product?.name || '—'}
- Categoría: ${product?.categoria_nombre || product?.category || 'General'}
- Precio final: $${Math.round(precio).toLocaleString('es-CO')} COP${of ? ` (con ${of.tipo === 'porcentaje' ? `${of.valor}% de descuento` : `descuento de $${of.valor}`} aplicado)` : ''}
- Stock: ${stock} ${stock === 1 ? 'unidad' : 'unidades'}${stock <= 0 ? ' — AGOTADO, sugiere alternativas' : ''}
- Ciudad de envío del cliente: ${ciudad || 'no especificada'}
- Tienda del producto: ${product?.tienda_nombre || 'Glopsy'}
- Calificación: ${Number(product?.avg_rating || 0).toFixed(1)}/5 (${Number(product?.review_count || 0)} reseñas)

Puedes consultar TODO el catálogo real usando las herramientas buscar_catalogo y ver_producto para:
- recomendar productos parecidos o en oferta,
- comparar precios y stock entre productos,
- sugerir qué comprar según el presupuesto/interés del cliente.

Reglas:
1. Responde en español, amable, conciso (máx ~3 párrafos) y sin inventar NUNCA precios, stock, descuentos ni envíos: usa las herramientas o la información anterior.
2. Si el producto está agotado, ofrece alternativas consultando el catálogo.
3. No des consejos médicos, financieros ni prometas resultados.
4. Si te preguntan cómo comprar: indica que use "Comprar ahora" o "Agregar al carrito" y complete el pago; el envío se calcula según la ciudad en el checkout.
5. Si no hay stock o el precio no está claro, dilo y sugiere preguntar al vendedor.`;
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

  if (mentions('envio', 'envian', 'llega', 'tardas', 'cuanto cuesta el envio', 'domicilio')) {
    return `Sobre el envío de "${product?.name}":\n• Se calcula en el checkout según tu ciudad (${ciudad || 'no especificada'}).\n• Algunas tiendas ofrecen envío gratis o descuentos visibles en el carrito.\n• Revisa en la página las condiciones de la tienda (proveedor) para tiempos y cobertura.`;
  }
  if (mentions('garantia', 'garanti', 'reembolso', 'devolucion', 'cambios', 'falla', 'defecto')) {
    const w = product?.warranties;
    if (Array.isArray(w) && w.length) {
      return `Garantía de "${product?.name}": ${w.map((x) => typeof x === 'string' ? x : (x?.titulo || x?.descripcion || '')).filter(Boolean).join(', ')}.`;
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
  if (mentions('recomiendame algo similar', 'alternativa', 'parecido', 'similar', 'opciones', 'otro', 'recomiendame', 'sugiere')) {
    const key = msg.replace(/recomiendame|algo|similar|parecido|alternativa|de|menor|precio|mas|barato|otra|opcion|opciones|sugiere|un|una|del/g, ' ').replace(/\s+/g, ' ').trim() || product?.name;
    try {
      const results = await searchCatalog({ q: key, max: 4 });
      const others = results.filter((r) => r.public_id !== (product?.public_id || product?.id));
      if (!others.length) {
        return `No encontré productos muy parecidos a "${product?.name}" en este momento. Puedes explorar la categoría "${product?.categoria_nombre || product?.category || 'General'}" desde el catálogo.`;
      }
      const lines = others.map((r) => `• ${r.name} — ${fmtCOP(r.precio)}${r.stock > 0 ? ` (${r.stock} uds)` : ' (agotado)'}${r.calificacion && Number(r.calificacion) > 0 ? ` ⭐${r.calificacion}` : ''}`).join('\n');
      return `Alternativas en el catálogo:\n${lines}\n\nToca el producto para verlo en detalle.`;
    } catch {
      return `No pude consultar las alternativas ahora. Explora la categoría "${product?.categoria_nombre || product?.category || 'General'}" desde el catálogo.`;
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
      temperature: 0.6,
      max_tokens: 900,
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

export const productAssistantChat = async ({ product, ciudad = '', messages = [] }) => {
  const clean = (m) => ({
    role: m?.role === 'assistant' ? 'assistant' : 'user',
    content: String(m?.content || '').replace(/\s+/g, ' ').trim().slice(0, 800),
  });

  const history = (Array.isArray(messages) ? messages : [])
    .map(clean)
    .filter((m) => m.content)
    .slice(-MAX_HISTORY);

  if (!history.length || history[history.length - 1].role !== 'user') {
    throw new Error('Mensaje inválido.');
  }

  // Sin API key o con IA caída → fallback con datos reales (FAQ local).
  if (!API_KEY) {
    const reply = await fallbackAnswer({ product, ciudad, lastMessage: history[history.length - 1].content });
    return { ok: true, reply, fallback: true };
  }

  const msgs = [{ role: 'system', content: buildSystem(product, ciudad) }, ...history];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const msg = await callModel(msgs);
      if (!msg) throw new Error('No hubo respuesta del modelo.');

      const toolCalls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
      msgs.push({ role: 'assistant', content: msg.content || '', tool_calls: toolCalls.length ? toolCalls : undefined });

      if (!toolCalls.length) {
        return { ok: true, reply: (msg.content || '').trim() };
      }

      for (const tc of toolCalls) {
        const name = tc?.function?.name || '';
        const args = tc?.function?.arguments || '{}';
        const result = await runTool(name, args);
        msgs.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }
    }
  } catch (err) {
    console.warn('[product-assistant] IA no disponible, respondiendo con fallback:', err.message);
    const reply = await fallbackAnswer({ product, ciudad, lastMessage: history[history.length - 1].content });
    return { ok: true, reply, fallback: true };
  }

  return { ok: true, reply: 'Ups, tardé demasiado en organizar la respuesta. Vuelve a preguntarme 🙂' };
};
