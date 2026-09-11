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
export const useMoney = () => {
  const { store } = useStorefront();
  const currency = store?.moneda || DEFAULT_CURRENCY;
  const locale = store?.locale || DEFAULT_LOCALE;
  return {
    currency,
    locale,
    format: (value) => formatMoney(value, { currency, locale }),
  };
};
