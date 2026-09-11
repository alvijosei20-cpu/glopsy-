// Integración con la API pública de ZOOM Envíos (Venezuela).
// Docs: https://zoom.red/api-documentacion-zoom-envios/
// Base pública: https://sandbox.zoom.red/baaszoom/public/canguroazul (sandbox)
// Los precios se devuelven en bolívares con formato es-VE ("30.414,29").
import { redisClient } from './redis.service.js';
import { getVeUsdRate, bsToUsd } from './rates.service.js';

const ZOOM_API_BASE =
  process.env.ZOOM_API_BASE || 'https://sandbox.zoom.red/baaszoom/public/canguroazul';

const CITIES_CACHE_KEY = 'zoom:ciudades';
const CITIES_TTL_SECONDS = 60 * 60 * 24; // 1 día

const normalize = (s) =>
  String(s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(CIUDAD|MUNICIPIO|PARROQUIA|AEROPUERTO)\b/g, ' ')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// "30.414,29" -> 30414.29
export const parseBs = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const s = String(value).trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const callZoom = async (endpoint, params = {}) => {
  const url = new URL(`${ZOOM_API_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Zoom ${endpoint} HTTP ${res.status}`);
  const data = await res.json();
  if (data?.codrespuesta && data.codrespuesta !== 'COD_000') {
    const err = new Error(data?.mensaje || 'Error de Zoom');
    err.code = data.codrespuesta;
    throw err;
  }
  return data;
};

// Lista de ciudades de servicio (filtro: 'origen' | 'nacional' | ...)
export const getZoomCities = async (filtro = 'origen') => {
  const key = `${CITIES_CACHE_KEY}:${filtro}`;
  const cached = await redisClient.get(key).catch(() => null);
  if (cached) return JSON.parse(cached);
  const data = await callZoom('getCiudades', filtro ? { filtro } : {});
  const list = Array.isArray(data?.entidadRespuesta) ? data.entidadRespuesta : [];
  await redisClient.set(key, JSON.stringify(list), { EX: CITIES_TTL_SECONDS }).catch(() => {});
  return list;
};

// Resuelve el código de ciudad de Zoom a partir del nombre de ciudad y estado.
export const findZoomCityCode = async (cityName, stateName) => {
  const cities = await getZoomCities('origen');
  const targetCity = normalize(cityName);
  const targetState = normalize(stateName);
  if (!targetCity) return null;

  let byCityState = null;
  let byCity = null;
  for (const c of cities) {
    const cName = normalize(c.nombre_ciudad);
    const cState = normalize(c.nombre_estado);
    if (cName === targetCity) {
      if (!byCity) byCity = c;
      if (targetState && cState === targetState) {
        byCityState = c;
        break;
      }
    }
  }
  const found = byCityState || byCity;
  return found ? { codciudad: Number(found.codciudad), nombre: found.nombre_ciudad, estado: found.nombre_estado } : null;
};

// Cotiza un envío nacional (puerta a puerta por defecto) y devuelve Bs + USD.
// tipo_tarifa: 1 COD, 2 NACIONAL, 3 INTERNACIONAL. modalidad: 1 oficina, 2 puerta a puerta.
export const quoteZoomShipping = async ({
  origenCodciudad,
  destinoCodciudad,
  pesoKg = 1,
  valorMercancia = 0,
  valorDeclarado = 0,
  cantidadPiezas = 1,
  tipoTarifa = 2,
  modalidad = 2,
  oficinaRetirar = 0,
} = {}) => {
  if (!origenCodciudad || !destinoCodciudad) return null;

  const data = await callZoom('CalcularTarifa', {
    tipo_tarifa: tipoTarifa,
    modalidad_tarifa: modalidad,
    ciudad_remitente: origenCodciudad,
    ciudad_destinatario: destinoCodciudad,
    oficina_retirar: oficinaRetirar,
    cantidad_piezas: cantidadPiezas,
    peso: pesoKg,
    valor_mercancia: valorMercancia,
    valor_declarado: valorDeclarado,
  });

  const e = data?.entidadRespuesta || {};
  const detalle = e.detalle || {};
  const totalBs = parseBs(e.total);
  const rate = await getVeUsdRate();
  const totalUsd = bsToUsd(totalBs, rate);

  return {
    totalBs,
    totalUsd,
    rate,
    fleteBs: parseBs(e.flete),
    ivaBs: parseBs(e.iva),
    detalle,
  };
};
