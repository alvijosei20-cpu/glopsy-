import crypto from 'node:crypto';
import sharp from 'sharp';

// Formato objetivo: banner/reel/og → 1200x630 · feed → 1080x1080 · story → 1080x1920
const SIZES = {
  banner: { w: 1200, h: 630 },
  og: { w: 1200, h: 630 },
  feed: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
};

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const cleanText = (s, max = 80) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

// Reparte un texto en líneas que caben en ~charsPorLinea.
const wrap = (text, charsPerLine) => {
  const words = cleanText(text, 400).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= charsPerLine) cur = (cur + ' ' + w).trim();
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3).join('\n');
};

const firstImage = (images = []) => {
  for (const i of images) {
    const src = typeof i === 'string' ? i : i?.src || '';
    if (src) return src;
  }
  return null;
};

// ------------------------------------------------------------------ Composición SVG

const layoutFor = (fmt) => {
  const { w, h } = SIZES[fmt] || SIZES.banner;
  const isWide = w > h;
  const pad = Math.round(w * 0.06);
  const gap = Math.round(w * 0.045);
  const topBar = Math.round(h * (isWide ? 0.13 : 0.08));
  const bottomH = Math.round(h * (isWide ? 0.3 : 0.24));
  return { w, h, pad, gap, topBar, bottomH, isWide };
};

const fontPx = (w, scale) => Math.max(20, Math.round(w * scale));

// SVG con el diseño del banner (degradado, texto y "slot" de la foto del producto).
const svgDoc = ({ data, layout, slot }) => {
  const { w, h, pad, topBar, isWide } = layout;
  const name = cleanText(data.name, 90);
  const category = cleanText(data.category, 50);
  const price = data.price ? `Desde ${data.price}` : '';
  const badge = cleanText(data.badge, 28);
  const brand = cleanText(data.brand, 40) || 'Glopsy';
  const f = (scale) => fontPx(w, scale);

  const wrapW = isWide ? Math.round(w * 0.5) : Math.round(w * 0.8);
  const charsPerLine = Math.max(14, Math.round(wrapW / (f(0.024)) * 1.05));
  const titleLines = wrap(name, charsPerLine).split('\n').slice(0, 3);

  const textX = pad;
  const tsize = f(isWide ? 0.038 : 0.046);
  const lineH = Math.round(tsize * 1.22);
  const firstBaseline = topBar + lineH;
  const textBottom = firstBaseline + (titleLines.length - 1) * lineH;

  const extraLines = titleLines.slice(1)
    .map((l) => `<tspan x="${textX}" dy="${lineH}">${esc(l)}</tspan>`)
    .join('');

  // Foto: lado derecho (wide) o banda superior (cuadrado/story)
  const imgX = isWide ? Math.round(w * 0.46) : pad;
  const imgY = isWide ? 0 : 0;
  const imgW = isWide ? w - imgX : w - pad * 2;
  const imgH = isWide ? h : Math.round(h * 0.34);

  const ctaW = Math.round(f(0.03) * 11);
  const ctaH = Math.round(f(0.012) * 6);
  const ctaR = Math.round(ctaH / 2);
  const priceLineH = Math.round(f(0.026) * 1.3);
  const catH = category ? Math.round(f(0.019) * 1.3) : 0;

  const contentArea = isWide ? h - pad : Math.round(h * 0.62);
  const ctaY = contentArea - ctaH - priceLineH - catH - Math.round(h * 0.015);
  const catY = ctaY - Math.round(h * 0.02);
  const priceY = ctaY + ctaH + priceLineH;

  const svg = `
  <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#7c3aed"/>
        <stop offset="55%" stop-color="#d946ef"/>
        <stop offset="100%" stop-color="#ec4899"/>
      </linearGradient>
      <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#0f0a1e" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#0f0a1e" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
    <rect x="0" y="0" width="${isWide ? Math.round(w * 0.62) : w}" height="${h}" fill="url(#fade)"/>

    <text x="${textX}" y="${topBar}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${f(0.02)}" font-weight="700" letter-spacing="5" fill="#ffffff" opacity="0.95">${esc(brand.toUpperCase())}</text>

    <text x="${textX}" y="${firstBaseline}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${tsize}" font-weight="800" fill="#ffffff">${esc(titleLines[0] || '')}${extraLines}</text>

    ${category ? `<text x="${textX}" y="${catY}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${f(0.019)}" font-weight="600" fill="#ffffff" opacity="0.95">${esc(category)}</text>` : ''}

    ${price ? `<text x="${textX}" y="${priceY}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${f(0.026)}" font-weight="800" fill="#ffffff">${esc(price)}</text>` : ''}

    <rect x="${textX}" y="${ctaY}" width="${ctaW}" height="${ctaH}" rx="${ctaR}" fill="#ffffff"/>
    <text x="${textX + ctaW / 2}" y="${ctaY + ctaH / 2 + f(0.0055)}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${f(0.015)}" font-weight="800" fill="#a21caf" text-anchor="middle">VER PRODUCTO</text>

    ${badge ? `<rect x="${w - pad - Math.round(f(0.008) * 22)}" y="${Math.round(h * 0.045)}" width="${Math.round(f(0.008) * 22)}" height="${Math.round(f(0.009) * 7)}" rx="${Math.round(f(0.0045))}" fill="#ff2d78"/>
    <text x="${w - pad - Math.round(f(0.008) * 11)}" y="${Math.round(h * 0.045) + Math.round(f(0.009) * 4.6)}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${f(0.014)}" font-weight="800" fill="#ffffff" text-anchor="middle">${esc(badge)}</text>` : ''}

    ${slot ? `<rect x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" fill="#ffffff"/>` : ''}
  </svg>`;
  return { svg, imgX, imgY, imgW, imgH };
};

// ------------------------------------------------------------------ Generación

export const FORMATS = Object.keys(SIZES);

export const generateBanner = async ({ name, category = '', price = '', badge = '', brand = 'Glopsy', images = [], format = 'feed' }) => {
  const fmt = FORMATS.includes(format) ? format : 'feed';
  const layout = layoutFor(fmt);
  const { w, h } = layout;
  const productSrc = firstImage(images);
  const { svg, imgX, imgY, imgW, imgH } = svgDoc({ data: { name, category, price, badge, brand }, layout, slot: Boolean(productSrc) });

  const layer = (buf) =>
    sharp(buf, { density: 200 })
      .resize(w, h, { fit: 'cover', kernel: 'lanczos3' })
      .png()
      .toBuffer();

  const base = await layer(Buffer.from(svg));

  if (productSrc) {
    try {
      const abs = /^https?:\/\//i.test(productSrc) ? productSrc : `https:${productSrc}`;
      const resp = await fetch(abs, { signal: AbortSignal.timeout(12000) });
      if (resp.ok) {
        const imgBuf = Buffer.from(await resp.arrayBuffer());
        const resized = await sharp(imgBuf)
          .rotate()
          .resize(imgW, imgH, { fit: 'cover', kernel: 'lanczos3' })
          .png()
          .toBuffer();
        return await sharp(base)
          .composite([{ input: resized, left: imgX, top: imgY }])
          .png({ quality: 90 })
          .toBuffer();
      }
    } catch (err) {
      console.warn('[banners] sin foto de producto:', err.message);
    }
  }

  return base;
};

// ------------------------------------------------------------------ Registro en memoria

const REGISTRY = new Map();
const MAX_KEYS = 300;
const TTL_MS = 10 * 60 * 1000;

const hashOf = (payload) => crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');

export const storeBanner = (payload, buffer) => {
  const key = hashOf(payload);
  if (REGISTRY.size >= MAX_KEYS) {
    const oldest = REGISTRY.keys().next().value;
    REGISTRY.delete(oldest);
  }
  REGISTRY.set(key, { buffer, at: Date.now() });
  return key;
};

export const getBanner = (key) => {
  const item = REGISTRY.get(key);
  if (!item) return null;
  if (Date.now() - item.at > TTL_MS) {
    REGISTRY.delete(key);
    return null;
  }
  item.at = Date.now();
  return item.buffer;
};
