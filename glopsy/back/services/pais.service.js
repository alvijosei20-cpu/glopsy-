// Configuración de país -> moneda/locale/dominio raíz.
// Cada tienda tiene pais_id; de él se hereda la moneda y el locale de cobro.
// Venezuela opera en USD (pagos PayPal) → su divisa es USD, no Bs.

const DEFAULTS = {
  unidad: 'COP',
  locale: 'es-CO',
  mono: '$',
};

export const CONFIG = {
  CO: { code: 'CO', moneda: 'COP', locale: 'es-CO', simbolo: '$', root: 'glopsy.shop' },
  VE: { code: 'VE', moneda: 'USD', locale: 'es-VE', simbolo: '$', root: 'glopsy.com.ve' },
};

// Normaliza un código de país a mayúsculas y devuelve su config, o la de CO.
export const paisConfig = (codigo) => CONFIG[String(codigo || '').toUpperCase()] || CONFIG.CO;

export const defaultConfig = () => CONFIG.CO;

export const formatPrice = (monto, config = CONFIG.CO) => {
  const n = Number(monto) || 0;
  return `${config.simbolo}${Math.round(n).toLocaleString(config.locale)} ${config.moneda}`.trim();
};

// Deriva la config de formato a partir de la moneda/locale de una tienda.
// Si la moneda no está registrada, usa la de Colombia como base.
export const configFromMoneda = (moneda, locale) => {
  const m = String(moneda || '').toUpperCase();
  const found = Object.values(CONFIG).find((c) => c.moneda === m);
  const base = found || CONFIG.CO;
  return { ...base, moneda: m || base.moneda, locale: locale || base.locale };
};