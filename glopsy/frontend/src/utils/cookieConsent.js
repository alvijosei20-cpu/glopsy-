// Gestión del consentimiento de cookies y tecnologías de seguimiento.
// Requerido por la Ley 1581 de 2012 / Decreto 1377 de 2013 y por el RGPD para
// visitantes de la Unión Europea. El consentimiento se versiona: si la versión
// cambia, se vuelve a solicitar.

export const COOKIE_CONSENT_KEY = 'glopsy_cookie_consent';
export const COOKIE_CONSENT_VERSION = '2026-10-01';
export const OPEN_CONSENT_EVENT = 'glopsy:open-cookie-consent';

export function getCookieConsent() {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== COOKIE_CONSENT_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent() {
  return getCookieConsent()?.analytics === true;
}

export function setCookieConsent({ analytics = false, marketing = false } = {}) {
  const data = {
    version: COOKIE_CONSENT_VERSION,
    analytics: analytics === true,
    marketing: marketing === true,
    decided_at: new Date().toISOString(),
  };
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(data));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('glopsy:cookie-consent', { detail: data }));
  }
  return data;
}

export function clearCookieConsent() {
  try {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('glopsy:cookie-consent', { detail: null }));
  }
}

// Permite reabrir el banner desde el footer u otro punto de la interfaz.
export function openCookieConsent() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}
