// Detección del subdominio de tienda (Opción B).
// - app.glopsy.shop / www.glopsy.shop / glopsy.shop  -> marketplace (sin tienda)
// - <slug>.glopsy.shop                                -> vitrina de esa tienda

const ROOT_DOMAIN = String(import.meta.env.VITE_ROOT_DOMAIN || 'glopsy.shop')
  .toLowerCase()
  .replace(/^\./, '');

const APP_HOSTS = new Set(['app', 'www']);

export const getStoreSlug = () => {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname.toLowerCase();
  if (host === ROOT_DOMAIN) return null;
  if (!host.endsWith(`.${ROOT_DOMAIN}`)) return null;
  const first = host.slice(0, host.length - ROOT_DOMAIN.length - 1).split('.')[0];
  if (!first || APP_HOSTS.has(first)) return null;
  return first;
};

export const isStoreHost = () => Boolean(getStoreSlug());

export const getRootOrigin = () => `https://app.${ROOT_DOMAIN}`;

export const getRootDomain = () => ROOT_DOMAIN;
