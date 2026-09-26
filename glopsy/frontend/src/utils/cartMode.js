// Modo del carrito: local (país del usuario) o internacional (tiendas que
// venden al exterior). Nunca se mezclan para no romper el checkout/divisa.

export const isInternationalItem = (item) => item?.internacional === true;

export const cartModeOf = (item) => (isInternationalItem(item) ? 'internacional' : 'local');

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

// Si el carrito ya tiene artículos de un modo y el nuevo es del otro, se rechaza
// para evitar mezclar checkout. El artículo nuevo debe llevar `internacional`.
export const checkCartCompatibility = (cart, item) => {
  const currentMode = cart.length ? cartModeOf(cart[0]) : null;
  const itemMode = cartModeOf(item);
  if (currentMode && itemMode !== currentMode) {
    return { ok: false, reason: 'mezcla', currentMode, itemMode };
  }
  return { ok: true };
};

// Devuelve true si hay artículos de ambos modos en el carrito (inconsistencia).
export const isMixedCart = (cart) => {
  const modes = new Set(cart.map(cartModeOf));
  return modes.size > 1;
};