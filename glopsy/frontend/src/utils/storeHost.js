// Detección del subdominio de tienda (Opción B) con soporte MULTIPAÍS.
// Cada país puede tener su propio dominio raíz (glopsy.shop, glopsy.com.ve…).
// - glopsy.shop / www.glopsy.shop / app.glopsy.shop        -> marketplace principal
// - <slug>.glopsy.shop                                     -> vitrina de esa tienda
// - glopsy.com.ve / app.glopsy.com.ve                      -> marketplace Venezuela
// - <slug>.glopsy.com.ve                                   -> vitrina de esa tienda

// Lista de dominios raíz. Se configura con VITE_ROOT_DOMAINS (separados por coma)
// o, por compatibilidad, con VITE_ROOT_DOMAIN (uno solo).
const parseRoots = () => {
  const raw =
    import.meta.env.VITE_ROOT_DOMAINS ||
    import.meta.env.VITE_ROOT_DOMAIN ||
    'glopsy.shop';
  return String(raw)
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean);
};

const ROOT_DOMAINS = parseRoots();

const APP_HOSTS = new Set(['app', 'www']);

// Devuelve el root que corresponde al hostname actual (el más específico).
const matchRoot = (host) => {
  let best = null;
  for (const root of ROOT_DOMAINS) {
    if (host === root) {
      if (!best || root.length > best.length) best = root;
      continue;
    }
    if (host.endsWith(`.${root}`)) {
      if (!best || root.length > best.length) best = root;
    }
  }
  return best;
};

export const getStoreSlug = () => {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname.toLowerCase();
  const root = matchRoot(host);
  if (!root || host === root) return null;
  const first = host.slice(0, host.length - root.length - 1).split('.')[0];
  if (!first || APP_HOSTS.has(first)) return null;
  return first;
};

export const isStoreHost = () => Boolean(getStoreSlug());

// Origen del marketplace para el dominio raíz detectado (o el primero por defecto).
export const getRootOrigin = () => {
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const root = matchRoot(host) || ROOT_DOMAINS[0] || 'glopsy.shop';
  return `https://app.${root}`;
};

export const getRootDomain = () => {
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  return matchRoot(host) || ROOT_DOMAINS[0] || 'glopsy.shop';
};

export const getRootDomains = () => [...ROOT_DOMAINS];
