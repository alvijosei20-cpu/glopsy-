// Formato de moneda según el país de la tienda.
// La tienda (vitrina o principal) expone `moneda` y `locale`; si no, Colombia.
import { useStorefront } from '../storefront/StorefrontContext';

export const DEFAULT_CURRENCY = 'COP';
export const DEFAULT_LOCALE = 'es-CO';

export const formatMoney = (value, { currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE } = {}) => {
  const num = Number(value || 0);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
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
export const useMoney = () => {
  const { store } = useStorefront();
  const pricing = store?.pricing;
  const currency = pricing?.displayCurrency || store?.moneda || DEFAULT_CURRENCY;
  const locale = store?.locale || DEFAULT_LOCALE;
  const rate = Number(pricing?.rate) > 0 ? Number(pricing.rate) : 1;
  return {
    currency,
    locale,
    rate,
    converted: Boolean(pricing?.converted),
    format: (value) => formatMoney(Number(value || 0) * rate, { currency, locale }),
  };
};
