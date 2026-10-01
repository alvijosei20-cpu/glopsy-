// Google Analytics por tienda (no global):
// - app.glopsy.shop (tienda principal) usa la propiedad por defecto.
// - cada subdominio de tienda usa EL GA que la tienda configuró (store.ga_id).
//
// Cumplimiento: GA sólo se carga después de que el usuario otorga consentimiento
// de cookies/analítica (Ley 1581 de 2012 y RGPD). Hasta entonces las mediciones
// quedan en cola y `trackEvent`/`trackPageView` son no-ops.
import { hasAnalyticsConsent } from './cookieConsent';

const DEFAULT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-HQF14269NQ';
const configured = new Set();
const pending = new Set();

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

function activate(id) {
  const target = String(id || '').trim();
  if (!target || configured.has(target)) return;
  if (ensureTag()) {
    window.gtag('config', target);
    configured.add(target);
  }
}

// Carga todas las propiedades registradas (por defecto y de tiendas).
function flushPending() {
  for (const id of pending) activate(id);
  for (const id of configured) activate(id);
}

// Registra una propiedad GA4 (una por tienda). Si aún no hay consentimiento,
// queda en cola y se activa cuando el usuario acepte.
export function initGA(id) {
  const target = String(id || '').trim();
  if (!target) return;
  pending.add(target);
  if (!hasAnalyticsConsent()) return;
  activate(target);
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

// Al otorgar consentimiento se activan las propiedades pendientes; al revocarlo
// no se descargan scripts ya cargados (requiere recarga), pero se dejan de medir.
if (typeof window !== 'undefined') {
  window.addEventListener('glopsy:cookie-consent', (event) => {
    if (event?.detail?.analytics === true) flushPending();
  });
}
