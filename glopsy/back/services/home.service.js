import { redisClient } from './redis.service.js';

const BANNERS_KEY = 'home:banners';

const DEFAULT_BANNERS = [
  {
    id: 1,
    icon: 'ShieldCheck',
    badge: 'Compra protegida',
    title: 'Tu dinero está seguro con Glopsy',
    highlight: 'de principio a fin',
    desc: 'Paga con Mercado Pago, confirma con tu huella y recibe tu pedido protegido. Si algo sale mal, te devolvemos tu plata.',
    cta: 'Explorar con confianza',
    to: '/listpr',
    bgFrom: '#c026d3',
    bgVia: '#db2777',
    bgTo: '#7c3aed',
    glow: 'rgba(236,72,153,0.55)',
    btnBg: '#db2777',
    btnText: '#ffffff',
    active: true,
  },
  {
    id: 2,
    icon: 'Truck',
    badge: 'Envío gratis en %CITY%',
    title: 'Recibe tu pedido',
    highlight: 'gratis en tu ciudad',
    desc: 'Miles de vendedores cerca de ti envían sin costo. Compra hoy, recibe rápido y sin pagar más por el transporte.',
    cta: 'Ver envíos gratis',
    to: '/listpr?envio_gratis=true',
    bgFrom: '#7c3aed',
    bgVia: '#c026d3',
    bgTo: '#db2777',
    glow: 'rgba(168,85,247,0.55)',
    btnBg: '#db2777',
    btnText: '#ffffff',
    active: true,
  },
  {
    id: 3,
    icon: 'Flame',
    badge: 'Ofertas por tiempo limitado',
    title: 'Los descuentos vuelan',
    highlight: 'no te quedes sin el tuyo',
    desc: 'Las ofertas más buscadas desaparecen en horas. Entra ahora y asegura tu precio antes de que se agote.',
    cta: 'Ver ofertas hoy',
    to: '/listpr',
    bgFrom: '#db2777',
    bgVia: '#e11d48',
    bgTo: '#7c3aed',
    glow: 'rgba(244,63,94,0.55)',
    btnBg: '#db2777',
    btnText: '#ffffff',
    active: true,
  },
  {
    id: 4,
    icon: 'Store',
    badge: 'Vende sin pagar nada',
    title: 'Convierte lo que tienes',
    highlight: 'en dinero en tu bolsillo',
    desc: 'Crea tu tienda gratis en minutos y llega a miles de compradores en Colombia. Sin costos de apertura.',
    cta: 'Crear mi tienda gratis',
    to: '/login',
    bgFrom: '#7c3aed',
    bgVia: '#a21caf',
    bgTo: '#db2777',
    glow: 'rgba(147,51,234,0.55)',
    btnBg: '#db2777',
    btnText: '#ffffff',
    active: true,
  },
];

const ICONS = new Set(['ShieldCheck', 'Truck', 'Flame', 'Store', 'Sparkles', 'Package', 'Star', 'Heart', 'Zap', 'Tag', 'Gift', 'Lock']);

function sanitizeColor(v, fallback) {
  if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) return v;
  return fallback;
}

function sanitizeBanner(raw, index) {
  const def = DEFAULT_BANNERS[index] || {};
  return {
    id: Number(raw.id) || index + 1,
    icon: ICONS.has(raw.icon) ? raw.icon : def.icon,
    badge: String(raw.badge ?? def.badge ?? '').trim().slice(0, 120),
    title: String(raw.title ?? def.title ?? '').trim().slice(0, 200),
    highlight: String(raw.highlight ?? def.highlight ?? '').trim().slice(0, 120),
    desc: String(raw.desc ?? def.desc ?? '').trim().slice(0, 600),
    cta: String(raw.cta ?? def.cta ?? '').trim().slice(0, 80),
    to: String(raw.to ?? def.to ?? '/listpr').trim().slice(0, 300),
    bgFrom: sanitizeColor(raw.bgFrom, def.bgFrom),
    bgVia: sanitizeColor(raw.bgVia, def.bgVia),
    bgTo: sanitizeColor(raw.bgTo, def.bgTo),
    glow: String(raw.glow ?? def.glow ?? 'rgba(236,72,153,0.55)').slice(0, 60),
    btnBg: sanitizeColor(raw.btnBg, def.btnBg),
    btnText: sanitizeColor(raw.btnText, def.btnText),
    active: raw.active !== false,
  };
}

export function normalizeBanners(list) {
  const arr = Array.isArray(list) ? list.slice(0, 4) : [];
  const result = [];
  for (let i = 0; i < 4; i++) {
    result.push(sanitizeBanner(arr[i] || {}, i));
  }
  return result;
}

export async function getBanners() {
  try {
    const raw = await redisClient.get(BANNERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeBanners(parsed);
    }
  } catch (err) {
    console.error('Error leyendo banners de Redis:', err.message);
  }
  return DEFAULT_BANNERS;
}

export async function saveBanners(list) {
  const banners = normalizeBanners(list);
  await redisClient.set(BANNERS_KEY, JSON.stringify(banners));
  return banners;
}

export async function resetBanners() {
  await redisClient.del(BANNERS_KEY);
  return DEFAULT_BANNERS;
}

export { DEFAULT_BANNERS };
