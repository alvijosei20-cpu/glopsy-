import { pool } from '../db.js';

// Calculadora de aranceles e IVA de importación (estimado informativo).
//
// El cliente paga los tributos a la aduana al recibir (DAP); este cálculo
// solo se muestra para que sepa cuánto podría pagar. Las tasas viven en
// tariff_countries / tariff_rules y son editables sin desplegar.

const iso = (v) => String(v || '').trim().toUpperCase().slice(0, 2);
const num = (v) => Number(v) || 0;
const round2 = (v) => Math.round(v * 100) / 100;

// Cache en memoria de reglas por país (TTL corto) para no golpear la DB.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

const loadCountryRules = async (paisIso) => {
  const key = iso(paisIso);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const { rows: countryRows } = await pool.query(
    `SELECT pais_iso, nombre, iva_pct, de_minimis_usd FROM tariff_countries WHERE pais_iso = $1 AND activo = true LIMIT 1`,
    [key]
  );
  const country = countryRows[0];
  if (!country) {
    cache.set(key, { at: Date.now(), value: null });
    return null;
  }
  const { rows: rules } = await pool.query(
    `SELECT scope, scope_id, arancel_pct FROM tariff_rules WHERE pais_iso = $1 AND activo = true`,
    [key]
  );
  const byCategoria = new Map();
  let fallback = 0;
  for (const r of rules) {
    if (r.scope === 'categoria' && r.scope_id != null) byCategoria.set(Number(r.scope_id), num(r.arancel_pct));
    else if (r.scope === 'default') fallback = num(r.arancel_pct);
  }
  const value = {
    pais_iso: country.pais_iso,
    nombre: country.nombre,
    ivaPct: num(country.iva_pct),
    deMinimisUsd: country.de_minimis_usd == null ? null : num(country.de_minimis_usd),
    byCategoria,
    fallbackArancelPct: fallback,
  };
  cache.set(key, { at: Date.now(), value });
  return value;
};

// Resuelve el % de arancel de un item: por categoría o respaldo del país.
const arancelPctForItem = (rules, categoriaId, hsCodeRules) => {
  if (hsCodeRules && hsCodeRules.length > 0) {
    // Preparado para reglas por HS en el futuro (prefijo de código).
  }
  if (categoriaId != null && rules.byCategoria.has(Number(categoriaId))) {
    return rules.byCategoria.get(Number(categoriaId));
  }
  return rules.fallbackArancelPct;
};

// items: [{ id, name, quantity, price, categoria_id }]
// Devuelve el desglose estimado de tributos de importación.
export const estimateImportDuties = async ({ paisDestino, items = [], shippingCost = 0, currency = 'USD' } = {}) => {
  const rules = await loadCountryRules(paisDestino);
  if (!rules) {
    return { ok: false, reason: 'pais_no_soportado', pais: iso(paisDestino) };
  }

  // Completa la categoría de los items que no la traigan.
  const ids = items.map((i) => Number(i.id)).filter(Boolean);
  let catMap = new Map();
  if (ids.length > 0) {
    const { rows } = await pool.query(
      `SELECT id, categoria_id FROM produc WHERE id = ANY($1::int[])`,
      [ids]
    );
    catMap = new Map(rows.map((r) => [Number(r.id), r.categoria_id]));
  }

  const goodsValue = round2(items.reduce((acc, it) => acc + num(it.price) * (Number(it.quantity) || 1), 0));
  const freight = round2(num(shippingCost));
  const base = round2(goodsValue + freight); // base CIF simplificada

  let dutyTotal = 0;
  const lines = items.map((it) => {
    const lineValue = num(it.price) * (Number(it.quantity) || 1);
    const categoriaId = it.categoria_id != null ? it.categoria_id : catMap.get(Number(it.id));
    const arancelPct = arancelPctForItem(rules, categoriaId, null);
    const duty = round2(lineValue * (arancelPct / 100));
    dutyTotal += duty;
    return {
      itemId: it.id,
      name: it.name || null,
      lineValue: round2(lineValue),
      arancelPct,
      duty,
    };
  });
  dutyTotal = round2(dutyTotal);

  const ivaBase = round2(base + dutyTotal);
  const iva = round2(ivaBase * (rules.ivaPct / 100));
  const totalDuties = round2(dutyTotal + iva);

  // De minimis: si aplica y el valor de mercancía no lo supera, no hay tributo.
  const deMinimis = rules.deMinimisUsd != null && goodsValue <= rules.deMinimisUsd;

  return {
    ok: true,
    pais: rules.pais_iso,
    paisNombre: rules.nombre,
    currency,
    goodsValue,
    shipping: freight,
    base,
    duty: deMinimis ? 0 : dutyTotal,
    ivaPct: rules.ivaPct,
    iva: deMinimis ? 0 : iva,
    total: deMinimis ? 0 : totalDuties,
    deMinimisUsd: rules.deMinimisUsd,
    deMinimisAplicado: deMinimis,
    estimado: true,
    lines,
  };
};

// Limpia la cache (por si se editan reglas desde el panel).
export const clearTariffCache = () => cache.clear();

// -------- Optimización de empaque (peso volumétrico) --------
// El courier cobra por peso volumétrico (LxWxH/5000). Para no sobrefacturar,
// se usa un empaque típico por categoría y se acota al contenido real.
const PACKAGING_DIVISOR = Number(process.env.PACKAGING_VOLUMETRIC_DIVISOR) || 5000;
const packagingCache = new Map();

const loadPackagingRules = async () => {
  const hit = packagingCache.get('all');
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value;
  const { rows } = await pool.query(
    `SELECT scope, scope_id, largo_cm, ancho_cm, alto_cm, peso_min_kg, product_peso_factor
     FROM packaging_rules WHERE activo = true`
  );
  const byCategoria = new Map();
  let fallback = null;
  for (const r of rows) {
    const rule = {
      largo: num(r.largo_cm),
      ancho: num(r.ancho_cm),
      alto: num(r.alto_cm),
      pesoMin: num(r.peso_min_kg),
      factor: num(r.product_peso_factor) || 1,
    };
    if (r.scope === 'categoria' && r.scope_id != null) byCategoria.set(Number(r.scope_id), rule);
    else fallback = rule;
  }
  const value = { byCategoria, fallback: fallback || { largo: 35, ancho: 30, alto: 20, pesoMin: 1, factor: 1.15 } };
  packagingCache.set('all', { at: Date.now(), value });
  return value;
};

export const clearPackagingCache = () => packagingCache.clear();

// Devuelve { length, width, height, weight } optimizados para un producto.
// - Usa la caja típica de su categoría (o el respaldo).
// - Acota el volumen al peso real del producto para no inflar el cobro.
export const resolvePackagingForProduct = async ({ categoriaId, peso, largo, alto, ancho } = {}) => {
  const rules = await loadPackagingRules();
  const rule = (categoriaId != null && rules.byCategoria.get(Number(categoriaId))) || rules.fallback;

  const pesoReal = num(peso) > 0 ? num(peso) : 0;
  const weight = Math.max(rule.pesoMin, round2(pesoReal * rule.factor));

  const dims = {
    length: num(largo) > 0 ? num(largo) : rule.largo,
    width: num(ancho) > 0 ? num(ancho) : rule.ancho,
    height: num(alto) > 0 ? num(alto) : rule.alto,
  };
  const volumetric = (dims.length * dims.width * dims.height) / PACKAGING_DIVISOR;
  if (pesoReal > 0 && volumetric > pesoReal * 3) {
    const scale = Math.cbrt((pesoReal * 3 * PACKAGING_DIVISOR) / (dims.length * dims.width * dims.height));
    dims.length = round2(dims.length * scale);
    dims.width = round2(dims.width * scale);
    dims.height = round2(dims.height * scale);
  }
  return { length: dims.length, width: dims.width, height: dims.height, weight };
};

export default { estimateImportDuties, clearTariffCache, resolvePackagingForProduct, clearPackagingCache };
