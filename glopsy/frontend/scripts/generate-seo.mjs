import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');
const SITE_URL = process.env.SITE_URL || 'https://glopsy.app';
const API_URL = process.env.SEO_API || 'http://localhost:3000/api';

const INDEX = path.join(DIST, 'index.html');
if (!fs.existsSync(INDEX)) {
  console.error('❌ dist/index.html no existe. Ejecuta `vite build` primero.');
  process.exit(1);
}

const base = fs.readFileSync(INDEX, 'utf8');
const SITE_NAME = 'Glopsy';

const routes = [
  {
    path: '/',
    file: 'index.html',
    title: 'Compra y Vende Productos en Línea',
    description:
      'Glopsy es el marketplace donde compras y vendes productos en línea con pagos seguros, envíos a todo Colombia y autenticación biométrica. Crea tu tienda gratis.',
    type: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      alternateName: 'Glopsy Marketplace',
      url: SITE_URL + '/',
      description: 'Marketplace colombiano para comprar y vender productos en línea.',
      inLanguage: 'es-CO',
    },
  },
  {
    path: '/listpr',
    file: 'listpr/index.html',
    title: 'Tienda — Compra Productos en Línea',
    description:
      'Explora miles de productos de tiendas verificadas en Glopsy. Filtra por categoría, precio, envío gratis y calificación. Compra con pagos seguros en Colombia.',
    type: 'website',
  },
  {
    path: '/consultar-pedido',
    file: 'consultar-pedido/index.html',
    title: 'Consultar Pedido — Seguimiento de Compras',
    description:
      'Consulta el estado de tu pedido en Glopsy con tu número de pedido o documento de identidad. Seguimiento de compras en tiempo real en todo Colombia.',
    type: 'website',
  },
];

const escapeXml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const cleanText = (text) =>
  String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 158);

const jsonLdScript = (data) =>
  `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

function buildHtml({ title, description, path, type = 'website', image = '/og-image.png', jsonLd }) {
  const fullTitle = title ? `${cleanText(title)} | ${SITE_NAME}` : `${SITE_NAME} — Compra y Vende en Línea`;
  const fullUrl = SITE_URL + path;
  const fullImage = image.startsWith('http') ? image : SITE_URL + image;

  let html = base;
  const replaceTag = (name, content) => {
    const re = new RegExp(`<meta name="${name}" content="[^"]*"\\s*/>`);
    if (re.test(html)) {
      html = html.replace(re, `<meta name="${name}" content="${content}" />`);
    } else {
      html = html.replace('</head>', `    <meta name="${name}" content="${content}" />\n  </head>`);
    }
  };
  const replaceProp = (name, content) => {
    const re = new RegExp(`<meta property="${name}" content="[^"]*"\\s*/>`);
    if (re.test(html)) {
      html = html.replace(re, `<meta property="${name}" content="${content}" />`);
    } else {
      html = html.replace('</head>', `    <meta property="${name}" content="${content}" />\n  </head>`);
    }
  };

  html = html.replace(/<title>.*?<\/title>/, `<title>${fullTitle}</title>`);
  html = html.replace(/<html lang="[^"]*"/, '<html lang="es"');

  replaceTag('description', cleanText(description));
  replaceProp('og:title', cleanText(title));
  replaceProp('og:description', cleanText(description));
  replaceProp('og:url', fullUrl);
  replaceProp('og:type', type);
  replaceProp('og:image', fullImage);
  replaceProp('og:site_name', SITE_NAME);
  replaceTag('twitter:title', cleanText(title));
  replaceTag('twitter:description', cleanText(description));
  replaceTag('twitter:image', fullImage);

  const canonicalRe = /<link rel="canonical" href="[^"]*"\s*\/>/;
  if (canonicalRe.test(html)) {
    html = html.replace(canonicalRe, `<link rel="canonical" href="${fullUrl}" />`);
  } else {
    html = html.replace('</head>', `    <link rel="canonical" href="${fullUrl}" />\n  </head>`);
  }

  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    jsonLd ? jsonLdScript(jsonLd) : ''
  );

  return html;
}

const sitemapUrls = [];
const writeRoute = (route) => {
  const file = path.join(DIST, route.file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buildHtml(route));
  sitemapUrls.push(route.path);
  console.log(`✔ prerender ${route.path}`);
};

routes.forEach(writeRoute);

const productPrice = (p) => {
  const base = Number(p.suggested_price || p.base_price || 0);
  let final = base;
  const of = p.oferta_activa;
  if (of) {
    if (of.tipo === 'porcentaje') final = base * (1 - Number(of.valor || 0) / 100);
    else if (of.tipo === 'monto_fijo') final = Math.max(0, base - Number(of.valor || 0));
  }
  return Math.max(0, Number(final || base)).toFixed(0);
};

let productCount = 0;
try {
  console.log(`🔍 Consultando API de productos: ${API_URL}/product?limit=100`);
  let offset = 0;
  for (;;) {
    const res = await fetch(`${API_URL}/product?limit=100&offset=${offset}`);
    if (!res.ok) throw new Error(`API respondió ${res.status}`);
    const data = await res.json();
    const products = data.products || [];
    if (products.length === 0) break;

    for (const p of products) {
      const pid = p.public_id || p.id;
      if (!pid) continue;
      const imgs = [];
      try {
        const parsed = typeof p.images === 'string' ? JSON.parse(p.images) : p.images;
        if (Array.isArray(parsed)) imgs.push(...parsed.map((i) => i.src || i).filter(Boolean));
      } catch {}
      if (p.images && typeof p.images !== 'string' && !imgs.length) imgs.push(p.images);
      const image = imgs[0] || '';

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        description: cleanText(p.description),
        image,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'COP',
          price: productPrice(p),
          availability:
            Number(p.stock_total || 0) > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          url: `${SITE_URL}/product/${pid}`,
        },
      };

      writeRoute({
        path: `/product/${pid}`,
        file: `product/${pid}/index.html`,
        title: p.name,
        description: cleanText(p.description) || 'Compra este producto en Glopsy con pagos seguros y envíos a todo Colombia.',
        type: 'product',
        image,
        jsonLd,
      });
      productCount++;
    }

    if (offset + products.length >= Number(data.total || 0)) break;
    offset += products.length;
  }
} catch (err) {
  console.warn(`⚠ No se generaron páginas de productos (${err.message}). Ejecuta el backend para incluirlas.`);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(SITE_URL + u)}</loc>
    <changefreq>${u.startsWith('/product') ? 'weekly' : 'daily'}</changefreq>
    <priority>${u === '/' ? '1.0' : u === '/listpr' ? '0.9' : '0.7'}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap);
console.log(`✔ sitemap.xml generado (${sitemapUrls.length} URLs, ${productCount} productos)`);
