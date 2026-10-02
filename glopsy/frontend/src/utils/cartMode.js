// Modo del carrito por MONEDA: COP (Bold) o USDT (Glopsy Pay / internacional).
// Nunca se mezclan porque usan pasarelas distintas.
import { normalizeCurrency } from './money';

// Moneda del ítem. Compatibilidad: los ítems viejos solo traen `internacional`.
export const cartCurrencyOf = (item) =>
  normalizeCurrency(item?.currency || (item?.internacional === true ? 'USDT' : 'COP'));

export const isInternationalItem = (item) => cartCurrencyOf(item) !== 'COP';

export const cartModeOf = (item) => cartCurrencyOf(item);

export const getCart = () => {
  try {
    return JSON.parse(localStorage.getItem('glopsy_cart') || '[]');
  } catch {
    return [];
  }
};

export const saveCart = (cart) => {
  localStorage.setItem('glopsy_cart', JSON.stringify(cart));
  window.dispatchEvent(new Event('storage'));
};

// Moneda del carrito completo (la del primer ítem). null si está vacío.
export const cartCurrency = (cart) => (cart && cart.length ? cartCurrencyOf(cart[0]) : null);

// Si el carrito ya tiene ítems de una moneda y el nuevo es de otra, se rechaza.
export const checkCartCompatibility = (cart, item) => {
  const currentMode = cartCurrency(cart);
  const itemMode = cartCurrencyOf(item);
  if (currentMode && itemMode !== currentMode) {
    return { ok: false, reason: 'mezcla', currentMode, itemMode };
  }
  return { ok: true };
};

// Devuelve true si hay artículos de ambas monedas en el carrito (inconsistencia).
export const isMixedCart = (cart) => {
  const modes = new Set(cart.map(cartCurrencyOf));
  return modes.size > 1;
};
