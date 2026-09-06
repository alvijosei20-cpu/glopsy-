import { trackEvent } from './analytics';

export const productShareUrl = (publicIdOrId) => {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/product/${String(publicIdOrId || '').trim()}`;
};

export const shareProduct = async ({ title = '', url = '', itemId = '', category = '' }) => {
  if (!url) return null;
  const text = title ? `Mira "${title}" en Glopsy 🛍️` : 'Mira este producto en Glopsy 🛍️';
  const shareData = { title, text, url };
  let method = '';

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(shareData);
      method = 'navigator.share';
    } catch (err) {
      if (err && err.name === 'AbortError') return null;
    }
  }

  if (!method) {
    try {
      await navigator.clipboard.writeText(url);
      method = 'clipboard';
    } catch {
      return null;
    }
  }

  try {
    trackEvent('share', {
      method,
      content_type: 'product',
      item_id: itemId || undefined,
      content_category: category || undefined,
    });
  } catch {
    /* analytics nunca debe bloquear el compartir */
  }

  return method;
};
