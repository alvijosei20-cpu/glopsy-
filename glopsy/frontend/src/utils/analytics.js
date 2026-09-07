// Google Analytics por tienda (no global):
// - app.glopsy.shop (tienda principal) usa la propiedad por defecto.
// - cada subdominio de tienda usa EL GA que la tienda configuró (store.ga_id).
const DEFAULT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-HQF14269NQ';
const configured = new Set();

function ensureTag() {
  if (window.gtag) return true;
  if (typeof document === 'undefined') return false;
  if (!document.querySelector('script[data-gtag]')) {
    const s = document.createElement('script');
    s.async = true;
    s.setAttribute('data-gtag', '1');
    s.src = `https://www.googletagmanager.com/gtag/js?id=${DEFAULT_ID}`;
    document.head.appendChild(s);
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  return true;
}

// Activa una propiedad GA4 (una por tienda). Idempotente por propiedad.
export function initGA(id) {
  const target = String(id || '').trim();
  if (!target || configured.has(target)) return;
  if (ensureTag()) {
    window.gtag('config', target);
    configured.add(target);
  }
}

// Propiedad por defecto de la app principal.
export function loadGA() {
  initGA(DEFAULT_ID);
}

export function trackPageView(path) {
  if (configured.size === 0 || !window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
  });
}

export function trackEvent(name, params = {}) {
  if (configured.size === 0 || !window.gtag) return;
  window.gtag('event', name, params);
}
