import { useEffect } from 'react';

const SITE_NAME = 'Glopsy';
const SITE_URL = 'https://glopsy.app';

function setMeta(attr, key, content) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(url) {
  const full = url.startsWith('http') ? url : SITE_URL + url;
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', full);
}

function injectJsonLd(data) {
  if (!data) return;
  removeJsonLd('seo-page');
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'seo-page';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

export function removeJsonLd(id = 'seo-page') {
  document.getElementById(id)?.remove();
}

function cleanText(text) {
  return (text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 158);
}

export function useSEO({ title, description, path = '/', image = '/og-image.png', jsonLd, type = 'website' }) {
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : null;

  useEffect(() => {
    const finalTitle = title ? `${cleanText(title)} | ${SITE_NAME}` : `${SITE_NAME} — Compra y Vende en Línea`;
    document.title = finalTitle;

    setMeta('name', 'description', cleanText(description));
    setMeta('property', 'og:title', cleanText(title));
    setMeta('property', 'og:description', cleanText(description));
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', SITE_URL + path);
    setMeta('property', 'og:image', image.startsWith('http') ? image : SITE_URL + image);
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('name', 'twitter:title', cleanText(title));
    setMeta('name', 'twitter:description', cleanText(description));
    setMeta('name', 'twitter:image', image.startsWith('http') ? image : SITE_URL + image);

    setCanonical(path);
    injectJsonLd(jsonLd);
    return () => removeJsonLd('seo-page');
  }, [title, description, path, image, type, jsonLdKey]);
}

export { SITE_URL };
