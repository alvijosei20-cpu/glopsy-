// TikTok Pixel por tienda (marketing/atribución). Mismo criterio de
// consentimiento que Google Analytics: el pixel no se carga hasta que el usuario
// acepta cookies/analítica.
import { hasAnalyticsConsent } from './cookieConsent';

const configured = new Set();
const pending = new Set();

function ensureSnippet() {
  if (window.ttq) return true;
  if (typeof document === 'undefined') return false;

  const t = (window.ttq = window.ttq || []);
  t.methods = [
    'page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once',
    'ready', 'alias', 'group', 'enableCookie', 'disableCookie',
    'holdConsent', 'revokeConsent', 'grantConsent',
  ];
  t.setAndDefer = function (target, method) {
    target[method] = function () {
      target.push([method].concat(Array.prototype.slice.call(arguments, 0)));
    };
  };
  for (const m of t.methods) t.setAndDefer(t, m);
  t.load = function (id, options) {
    const url = 'https://analytics.tiktok.com/i18n/pixel/events.js?lib=ttq&sdkid=' + id;
    t._i = t._i || {};
    t._i[id] = [];
    t._i[id]._u = url;
    t._t = t._t || {};
    t._t[id] = +new Date();
    t._o = t._o || {};
    t._o[id] = options || {};
    const s = document.createElement('script');
    s.type = 'text/javascript';
    s.async = true;
    s.src = url;
    const first = document.getElementsByTagName('script')[0];
    first.parentNode.insertBefore(s, first);
  };
  return true;
}

function activate(id) {
  const pixelId = String(id || '').trim();
  if (!pixelId || configured.has(pixelId)) return;
  if (!ensureSnippet()) return;
  window.ttq.load(pixelId);
  window.ttq.page();
  configured.add(pixelId);
}

function flushPending() {
  for (const id of pending) activate(id);
}

// Carga el pixel de una tienda (idempotente). Si no hay consentimiento, queda en cola.
export function initTikTokPixel(id) {
  const pixelId = String(id || '').trim();
  if (!pixelId) return;
  pending.add(pixelId);
  if (!hasAnalyticsConsent()) return;
  activate(pixelId);
}

// Mapea los eventos GA4 a los eventos estándar de TikTok.
const EVENT_MAP = {
  view_item: 'ViewContent',
  view_item_list: 'ViewContent',
  select_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  remove_from_cart: 'RemoveFromCart',
  add_to_wishlist: 'AddToWishlist',
  begin_checkout: 'InitiateCheckout',
  add_payment_info: 'AddPaymentInfo',
  purchase: 'CompletePayment',
  search: 'Search',
  share: 'Share',
};

export function trackTikTokEvent(name, params = {}) {
  if (configured.size === 0 || typeof window === 'undefined' || !window.ttq) return;
  const event = EVENT_MAP[name];
  if (!event) return;

  const data = {};
  if (params.value != null) data.value = Number(params.value);
  if (params.currency) data.currency = params.currency;
  if (params.search_term) data.query = params.search_term;
  if (Array.isArray(params.items) && params.items.length) {
    data.contents = params.items.map((i) => ({
      content_id: String(i.item_id || i.id || ''),
      content_type: 'product',
      content_name: i.item_name || i.name,
      quantity: Number(i.quantity || 1),
      price: Number(i.price || 0),
    }));
  }
  window.ttq.track(event, data);
}

export function trackTikTokPage() {
  if (configured.size === 0 || typeof window === 'undefined' || !window.ttq) return;
  window.ttq.page();
}

// Al aceptar cookies se cargan los píxeles pendientes.
if (typeof window !== 'undefined') {
  window.addEventListener('glopsy:cookie-consent', (event) => {
    if (event?.detail?.analytics === true) flushPending();
  });
}
