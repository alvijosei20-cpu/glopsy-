// Formato de moneda según el país de la tienda.
// La tienda (vitrina o principal) expone `moneda` y `locale`; si no, Colombia.
//
// USDT es solo una etiqueta de visualización: internamente la divisa
// internacional/Venezuela vale 1:1 con USD y nunca se convierte.
import { useStorefront } from '../storefront/StorefrontContext';

export const DEFAULT_CURRENCY = 'COP';
export const DEFAULT_LOCALE = 'es-CO';

// Normaliza la divisa a su etiqueta visible. USD y USDT se muestran como USDT.
export const normalizeCurrency = (currency) => {
  const c = String(currency || '').trim().toUpperCase();
  if (c === 'USD' || c === 'USDT') return 'USDT';
  return c || DEFAULT_CURRENCY;
};

// Moneda/pasarela: solo COP (Bold) o USDT (Glopsy Pay / internacional).
export const isUsdt = (currency) => normalizeCurrency(currency) === 'USDT';

const formatNumber = (value, locale, digits = 2) => {
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return Number(value || 0).toFixed(digits);
  }
};

export const formatMoney = (value, { currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE } = {}) => {
  const num = Number(value || 0);
  const cur = normalizeCurrency(currency);

  // Intl no acepta "USDT" (código no ISO 4217): se formatea a mano.
  if (cur === 'USDT') {
    return `${formatNumber(num, locale, 2)} USDT`;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: 'currency',
      currency: DEFAULT_CURRENCY,
      maximumFractionDigits: 0,
    }).format(num);
  }
};

// Divisa/locale de la tienda actual (vitrina o principal). Fallback Colombia.
// En tiendas habilitadas en USD, a un visitante del mismo país se le muestra
// el precio en su moneda local (store.pricing lo define el backend).
//
// `format(value, currencyOverride?)` permite formatear el precio de un producto
// en SU propia divisa cuando difiere de la de la tienda (producto internacional
// en USDT dentro de la tienda principal COP).
export const useMoney = () => {
  const { store } = useStorefront();
  const pricing = store?.pricing;
  const currency = normalizeCurrency(pricing?.displayCurrency || store?.moneda || DEFAULT_CURRENCY);
  const locale = store?.locale || DEFAULT_LOCALE;
  const rate = Number(pricing?.rate) > 0 ? Number(pricing.rate) : 1;
  return {
    currency,
    locale,
    rate,
    converted: Boolean(pricing?.converted),
    format: (value, currencyOverride) => {
      const cur = currencyOverride ? normalizeCurrency(currencyOverride) : currency;
      const appliedRate = cur === currency ? rate : 1;
      return formatMoney(Number(value || 0) * appliedRate, { currency: cur, locale });
    },
  };
};
