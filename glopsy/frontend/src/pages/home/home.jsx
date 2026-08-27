import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Truck, ShieldCheck, Fingerprint, Store, Star, ShoppingCart, Heart, ArrowRight, Sparkles, BadgeCheck, Package, ChevronLeft, ChevronRight, TrendingUp, Timer, Users, Flame } from 'lucide-react';
import api from '../../services/api';
import { isLoggedIn } from '../../utils/session';
import { SkeletonList } from '../../components/SkeletonLoader';
import Footer from '../../components/footer';
import { useSEO } from '../../utils/seo';
import { trackEvent } from '../../utils/analytics';
import './home.css';

const CATEGORY_STYLE = [
  'from-fuchsia-600 to-pink-600',
  'from-purple-600 to-fuchsia-600',
  'from-pink-500 to-rose-500',
  'from-fuchsia-500 to-purple-700',
  'from-pink-600 to-purple-600',
  'from-rose-500 to-fuchsia-600',
  'from-purple-700 to-pink-600',
  'from-fuchsia-600 to-pink-500',
];

const SLIDES = [
  {
    icon: ShieldCheck,
    badge: 'Compra protegida',
    title: 'Tu dinero está seguro con Glopsy',
    highlight: 'de principio a fin',
    desc: 'Paga con Mercado Pago, confirma con tu huella y recibe tu pedido protegido. Si algo sale mal, te devolvemos tu plata.',
    cta: 'Explorar con confianza',
    to: '/listpr',
    gradient: 'from-fuchsia-600 via-pink-600 to-purple-800',
    glow: 'rgba(236,72,153,0.55)',
  },
  {
    icon: Truck,
    badge: `Envío gratis en ${'%CITY%'}`,
    title: 'Recibe tu pedido',
    highlight: 'gratis en tu ciudad',
    desc: 'Miles de vendedores cerca de ti envían sin costo. Compra hoy, recibe rápido y sin pagar más por el transporte.',
    cta: 'Ver envíos gratis',
    to: '/listpr?envio_gratis=true',
    gradient: 'from-purple-700 via-fuchsia-600 to-pink-600',
    glow: 'rgba(168,85,247,0.55)',
  },
  {
    icon: Flame,
    badge: 'Ofertas por tiempo limitado',
    title: 'Los descuentos vuelan',
    highlight: 'no te quedes sin el tuyo',
    desc: 'Las ofertas más buscadas desaparecen en horas. Entra ahora y asegura tu precio antes de que se agote.',
    cta: 'Ver ofertas hoy',
    to: '/listpr',
    gradient: 'from-pink-600 via-rose-600 to-purple-800',
    glow: 'rgba(244,63,94,0.55)',
  },
  {
    icon: Store,
    badge: 'Vende sin pagar nada',
    title: 'Convierte lo que tienes',
    highlight: 'en dinero en tu bolsillo',
    desc: 'Crea tu tienda gratis en minutos y llega a miles de compradores en Colombia. Sin costos de apertura.',
    cta: 'Crear mi tienda gratis',
    to: '/login',
    gradient: 'from-purple-800 via-fuchsia-700 to-pink-600',
    glow: 'rgba(147,51,234,0.55)',
  },
];

const BENEFITS = [
  {
    icon: ShieldCheck,
    title: 'Pagos 100% seguros',
    desc: 'Procesa tus pagos con Mercado Pago y protección al comprador en cada transacción.',
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    icon: Truck,
    title: 'Envíos a todo Colombia',
    desc: 'Coordinamos el envío de tus productos a cualquier ciudad del país con opciones de envío gratis.',
    gradient: 'from-fuchsia-600 to-pink-600',
  },
  {
    icon: Fingerprint,
    title: 'Autenticación biométrica',
    desc: 'Compra y confirma con tu huella. Máxima seguridad para ti y tu cuenta en Glopsy.',
    gradient: 'from-purple-600 to-fuchsia-600',
  },
];

const SOCIAL_PROOF = [
  { icon: ShieldCheck, value: '100%', label: 'pagos protegidos' },
  { icon: Users, value: '32', label: 'departamentos alcanzados' },
  { icon: Store, value: 'Gratis', label: 'crea tu tienda' },
  { icon: Fingerprint, value: 'Biométrico', label: 'login seguro' },
];

const RECENT_VIEWS_KEY = 'glopsy_recent_views';

const ProductCard = ({ p, favorites, onToggleFavorite, onAddToCart, formatPrice, getFinalPrice, getProductImage, baseP }) => {
  const navigate = useNavigate();
  const finalPrice = getFinalPrice(p);
  const hasDiscount = Boolean(p.oferta_activa && finalPrice < baseP);
  const isFavorite = favorites.has(p.id);
  const discountPct = hasDiscount && p.oferta_activa.tipo === 'porcentaje' ? Number(p.oferta_activa.valor) : 0;

  const handleClick = () => {
    trackEvent('select_item', {
      currency: 'COP',
      item_list_id: p._list_id,
      item_list_name: p._list_name,
      items: [{
        item_id: String(p.public_id || p.id),
        item_name: p.name,
        item_brand: p.tienda_nombre || 'Glopsy',
        item_category: p.categoria_nombre || '',
        price: finalPrice,
        quantity: 1,
      }],
    });
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_VIEWS_KEY) || '[]');
      recent.push({
        product_id: p.id,
        category_id: p.categoria_id,
        category_name: p.categoria_nombre,
        ts: Date.now(),
      });
      localStorage.setItem(RECENT_VIEWS_KEY, JSON.stringify(recent.slice(-24)));
    } catch {}
    navigate(`/product/${p.public_id || p.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className="group bg-white dark:bg-[#121212] rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-fuchsia-500/10 hover:-translate-y-1 hover:border-fuchsia-300 dark:hover:border-fuchsia-900 transition-all duration-300 cursor-pointer relative"
    >
      <div className="relative aspect-[4/3] bg-slate-50 dark:bg-zinc-900 overflow-hidden">
        <img
          src={getProductImage(p)}
          alt={p.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <button
          type="button"
          onClick={(e) => onToggleFavorite(p.id, e)}
          className={`absolute top-2 left-2 z-10 p-1.5 rounded-full shadow-md transition-all duration-300 cursor-pointer ${
            isFavorite
              ? 'bg-pink-600 text-white shadow-pink-500/40 scale-110'
              : 'bg-white/90 backdrop-blur-sm text-slate-400 hover:text-pink-600 border border-fuchsia-100'
          }`}
          title={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        >
          <Heart size={15} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        {hasDiscount && (
          <span className="absolute top-2 right-2 z-10 bg-gradient-to-r from-pink-600 to-rose-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-md shadow-pink-500/30">
            {discountPct ? `${discountPct}% OFF` : '¡OFERTA!'}
          </span>
        )}
        {p.envio_gratis && (
          <span className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md inline-flex items-center gap-1">
            <Truck size={11} /> Envío gratis
          </span>
        )}
      </div>

      <div className="p-3">
        <h3 className="text-xs sm:text-sm font-normal text-slate-800 dark:text-slate-200 line-clamp-2 group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-400 transition-colors mb-1.5 leading-snug min-h-[2.2rem]">
          {p.name}
        </h3>
        {Number(p.review_count || 0) > 0 && (
          <div className="mb-1.5 flex items-center gap-1">
            <span className="flex items-center">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={12} className={i <= Math.round(Number(p.avg_rating || 0)) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 fill-slate-200'} />
              ))}
            </span>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{Number(p.avg_rating).toFixed(1)}</span>
            <span className="text-[10px] text-slate-400">({p.review_count})</span>
          </div>
        )}
        <div className="flex items-end justify-between gap-2">
          <div>
            {hasDiscount && (
              <span className="text-[11px] text-slate-400 line-through block">{formatPrice(baseP)}</span>
            )}
            <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              {formatPrice(finalPrice)}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => onAddToCart(p, e)}
            className="bg-fuchsia-100 hover:bg-fuchsia-200 dark:bg-fuchsia-900/40 dark:hover:bg-fuchsia-800/40 text-fuchsia-700 dark:text-fuchsia-300 w-8 h-8 rounded-full shadow-sm transition-all duration-200 cursor-pointer hover:scale-110 active:scale-95 flex items-center justify-center"
            title="Agregar al carrito"
          >
            <ShoppingCart size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

const ProductCarousel = ({ items, favorites, onToggleFavorite, onAddToCart, formatPrice, getFinalPrice, getProductImage, basePriceOf }) => {
  const scroller = useRef(null);
  const wrapRef = useRef(null);
  const [inView, setInView] = useState(false);
  const canScroll = items.length > 4;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const scrollByDir = (dir) => {
    scroller.current?.scrollBy({ left: dir * 260, behavior: 'smooth' });
  };

  return (
    <div ref={wrapRef} className="relative">
      {canScroll && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => scrollByDir(-1)}
            className="absolute -left-2 sm:-left-4 top-1/2 -translate-y-1/2 z-10 hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-white/10 text-slate-600 dark:text-white border border-slate-200 dark:border-white/10 shadow-sm hover:bg-slate-50 dark:hover:bg-white/20 transition-all cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => scrollByDir(1)}
            className="absolute -right-2 sm:-right-4 top-1/2 -translate-y-1/2 z-10 hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-white/10 text-slate-600 dark:text-white border border-slate-200 dark:border-white/10 shadow-sm hover:bg-slate-50 dark:hover:bg-white/20 transition-all cursor-pointer"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}
      <div
        ref={scroller}
        className="flex gap-3 sm:gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain snap-x snap-proximity home-no-scrollbar -mx-4 px-4 pb-2"
      >
        {items.map((p, i) => {
          const fx = ['homeFadeUp', 'homeFadeLeft', 'homeFadeRight', 'homePop'][i % 4];
          return (
            <div
              key={p.id}
              className="w-36 sm:w-48 flex-none snap-start"
              style={inView ? { animation: `${fx} 400ms ease both`, animationDelay: `${i * 80}ms` } : { opacity: 0 }}
            >
              <ProductCard
                p={p}
                favorites={favorites}
                onToggleFavorite={onToggleFavorite}
                onAddToCart={onAddToCart}
                formatPrice={formatPrice}
                getFinalPrice={getFinalPrice}
                getProductImage={getProductImage}
                baseP={basePriceOf(p)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SectionHeader = ({ icon: Icon, title, subtitle, onSeeAll, seeAllLabel = 'Ver todos' }) => (
  <div className="flex items-end justify-between mb-6">
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white flex items-center justify-center shadow-md shrink-0">
        <Icon size={18} />
      </div>
      <div>
        <h2 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">{title}</h2>
        {subtitle && <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {onSeeAll && (
      <button
        onClick={onSeeAll}
        className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-fuchsia-600 hover:text-fuchsia-700 dark:text-fuchsia-400 transition-colors cursor-pointer whitespace-nowrap"
      >
        {seeAllLabel} <ArrowRight size={16} />
      </button>
    )}
  </div>
);

const SegmentDivider = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
    <div className="flex items-center gap-4">
      <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-700" />
      <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-zinc-600" />
      <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-700" />
    </div>
  </div>
);

export default function Home() {
  const navigate = useNavigate();
  useSEO({
    title: 'Compra y Vende Productos en Línea',
    description:
      'Glopsy es el marketplace donde compras y vendes productos en línea con pagos seguros, envíos a todo Colombia y autenticación biométrica. Crea tu tienda gratis.',
    path: '/',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Glopsy',
      url: 'https://app.glopsy.shop/',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://app.glopsy.shop/listpr?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
  });

  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const catRef = useRef(null);
  const [catInView, setCatInView] = useState(false);
  const [freeShip, setFreeShip] = useState([]);
  const [deals, setDeals] = useState([]);
  const [popular, setPopular] = useState([]);
  const [personalized, setPersonalized] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState(new Set());
  const [toastMessage, setToastMessage] = useState('');
  const [slideIdx, setSlideIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);

  const getUserCity = () => {
    try {
      const data = JSON.parse(sessionStorage.getItem('location_data') || localStorage.getItem('location_data') || '{}');
      if (data.city) return data.city;
    } catch {}
    return sessionStorage.getItem('location_city') || localStorage.getItem('location_city') || 'Bogotá D.C.';
  };
  const userCity = getUserCity();

  useEffect(() => {
    api.get('/product/categories')
      .then(res => {
        if (res.data.ok) setCategories(res.data.categories || []);
      })
      .catch(err => console.error('Error al cargar categorías:', err));

    if (isLoggedIn()) {
      api.get('/product/favorites')
        .then(res => {
          if (res.data.ok) setFavorites(new Set(res.data.favorites));
        })
        .catch(err => console.error('Error al cargar favoritos:', err));
    }
  }, []);

  useEffect(() => {
    const el = catRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      setCatInView(entry.isIntersecting);
    }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const trackList = (listId, listName, items) => {
    if (!items.length) return;
    trackEvent('view_item_list', {
      currency: 'COP',
      item_list_id: listId,
      item_list_name: listName,
      items: items.map(p => ({
        item_id: String(p.public_id || p.id),
        item_name: p.name,
        item_brand: p.tienda_nombre || 'Glopsy',
        item_category: p.categoria_nombre || '',
        price: Number(p.suggested_price || p.base_price || 0),
        quantity: 1,
      })),
    });
  };

  const fetchSection = useCallback(async (params, listId, listName) => {
    try {
      const response = await api.get('/product', {
        params: { limit: 8, offset: 0, ciudad: userCity, ...params },
      });
      if (!response.data.ok) return [];
      const items = (response.data.products || []).map(p => ({ ...p, _list_id: listId, _list_name: listName }));
      trackList(listId, listName, items);
      return items;
    } catch (err) {
      console.error(`Error al cargar ${listName}:`, err);
      return [];
    }
  }, [userCity]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [freeItems, dealItems, popItems] = await Promise.all([
      fetchSection({ envio_gratis: true }, 'envio_gratis', `Envío gratis en ${userCity}`),
      fetchSection({ limit: 20 }, 'ofertas', 'Ofertas del día'),
      fetchSection({ sort: 'rating' }, 'populares', `Los más buscados en ${userCity}`),
    ]);

    const dealFiltered = dealItems.filter(p => p.oferta_activa && Number(p.oferta_activa.valor || 0) > 0).slice(0, 8);

    setFreeShip(freeItems);
    setDeals(dealFiltered);
    setPopular(popItems);

    // Personalización: categorías de lo que el usuario vio/buscó
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_VIEWS_KEY) || '[]');
      const searchCats = JSON.parse(localStorage.getItem('glopsy_search_cats') || '[]');
      const allInterests = [...recent, ...searchCats];
      const counts = {};
      allInterests.forEach(r => {
        if (!r.category_id) return;
        counts[r.category_id] = (counts[r.category_id] || 0) + 1;
      });
      const topCats = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
      if (topCats.length) {
        const results = await Promise.all(
          topCats.map(catId => fetchSection({ categoria_id: catId, limit: 6 }, 'para_ti', 'Para ti'))
        );
        const seen = new Set();
        const merged = [];
        results.flat().forEach(p => {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            merged.push(p);
          }
        });
        setPersonalized(merged.slice(0, 8));
      } else {
        setPersonalized([]);
      }
    } catch {
      setPersonalized([]);
    }
    setLoading(false);
  }, [fetchSection, userCity]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Autoplay del carrusel
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setSlideIdx(prev => (prev + 1) % SLIDES.length), 5500);
    return () => clearInterval(t);
  }, [paused]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    trackEvent('search', { search_term: query.trim(), search_type: 'home' });
    navigate(`/listpr?q=${encodeURIComponent(query.trim())}`);
  };

  const getProductImage = (p) => {
    try {
      if (Array.isArray(p.images) && p.images[0]?.src) return p.images[0].src;
      if (typeof p.images === 'string') {
        const parsed = JSON.parse(p.images);
        if (Array.isArray(parsed) && parsed[0]?.src) return parsed[0].src;
      }
    } catch {}
    return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60';
  };

  const formatPrice = (val) => {
    const num = Number(val || 0);
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
  };

  const getFinalPrice = (p) => {
    const baseP = Number(p.suggested_price || p.base_price || 0);
    if (p.oferta_activa) {
      if (p.oferta_activa.tipo === 'porcentaje') return baseP * (1 - Number(p.oferta_activa.valor) / 100);
      if (p.oferta_activa.tipo === 'monto_fijo') return Math.max(0, baseP - Number(p.oferta_activa.valor));
    }
    return baseP;
  };

  const handleAddToCart = (p, e) => {
    e.stopPropagation();
    try {
      const existingCart = JSON.parse(localStorage.getItem('glopsy_cart') || '[]');
      const finalPrice = getFinalPrice(p);
      const itemIndex = existingCart.findIndex(item => item.id === p.id);
      if (itemIndex > -1) {
        existingCart[itemIndex].quantity = (existingCart[itemIndex].quantity || 1) + 1;
      } else {
        existingCart.push({
          id: p.id,
          name: p.name,
          price: finalPrice,
          image: getProductImage(p),
          quantity: 1,
          tienda_id: p.tienda_id,
        });
      }
      localStorage.setItem('glopsy_cart', JSON.stringify(existingCart));
      window.dispatchEvent(new Event('storage'));

      trackEvent('add_to_cart', {
        currency: 'COP',
        value: finalPrice,
        item_list_id: p._list_id || 'home',
        item_list_name: p._list_name || 'Home',
        items: [{
          item_id: String(p.public_id || p.id),
          item_name: p.name,
          item_brand: p.tienda_nombre || 'Glopsy',
          item_category: p.categoria_nombre || '',
          price: finalPrice,
          quantity: 1,
        }],
      });

      setToastMessage('¡Producto agregado al carrito!');
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.error('Error al añadir al carrito:', err);
    }
  };

  const handleToggleFavorite = async (productId, e) => {
    e.stopPropagation();
    if (!isLoggedIn()) {
      navigate('/login');
      return;
    }
    try {
      const res = await api.post('/product/favorite', { productId });
      if (res.data.ok) {
        setFavorites(prev => {
          const next = new Set(prev);
          if (res.data.favorited) next.add(productId);
          else next.delete(productId);
          return next;
        });
        trackEvent(res.data.favorited ? 'add_to_wishlist' : 'remove_from_wishlist', {
          currency: 'COP',
          value: 0,
          items: [{ item_id: String(productId), quantity: 1 }],
        });
      }
    } catch (err) {
      console.error('Error al alternar favorito:', err);
    }
  };

  const goToSlide = (i) => {
    setSlideIdx((i + SLIDES.length) % SLIDES.length);
    trackEvent('select_content', { content_type: 'banner', content_id: String(i + 1), content_name: SLIDES[i].badge });
  };

  const goToSection = (to, name) => {
    trackEvent('select_content', { content_type: 'section_cta', content_name: name });
    navigate(to);
  };

  const slide = SLIDES[slideIdx];
  const basePriceOf = (p) => Number(p.suggested_price || p.base_price || 0);

  return (
    <div className="min-h-screen bg-white dark:bg-black text-slate-800 dark:text-slate-100">
      {/* ===== BUSCADOR + UBICACIÓN ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center bg-white dark:bg-black rounded-2xl p-1.5 shadow-2xl shadow-fuchsia-900/30 max-w-3xl mx-auto border border-slate-200 dark:border-zinc-800">
          <Search size={20} className="ml-3 text-slate-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`¿Qué buscas hoy en ${userCity}?`}
            className="flex-1 min-w-0 px-3 py-2.5 text-sm md:text-base text-slate-800 dark:text-white outline-none placeholder-slate-400 bg-transparent"
          />
          <button
            type="submit"
            className="bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-md shadow-fuchsia-600/30 cursor-pointer"
          >
            <Search size={16} />
            <span className="hidden sm:inline">Buscar</span>
          </button>
        </form>

        <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium mt-4">
          <MapPin size={15} className="text-fuchsia-600 shrink-0" />
          <span>
            Enviando a <b className="text-slate-900 dark:text-white">{userCity}</b> — envíos gratis desde tiendas cercanas
          </span>
        </div>
      </section>

      {/* ===== HERO CARRUSEL (fijo, minimalista, degradado fusionado) ===== */}
      <section
        className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 pt-6"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 48) goToSlide(dx < 0 ? slideIdx + 1 : slideIdx - 1);
          touchX.current = null;
        }}
      >
        <div className="relative h-64 sm:h-80 rounded-none sm:rounded-3xl p-px bg-gradient-to-br from-fuchsia-400/60 via-transparent to-purple-400/60 dark:from-fuchsia-500/40 dark:via-transparent dark:to-purple-500/40">
        <div className="relative h-full w-full overflow-hidden rounded-none sm:rounded-[calc(1.5rem-1px)] bg-gradient-to-br from-fuchsia-200 via-white to-purple-200 dark:from-fuchsia-950 dark:via-zinc-950 dark:to-purple-950">
          {/* Fondos por slide con desvanecimiento cruzado */}
          {SLIDES.map((s, i) => (
            <div
              key={s.badge}
              className={`absolute inset-0 transition-opacity duration-1000 ${i === slideIdx ? 'opacity-100' : 'opacity-0'}`}
              aria-hidden="true"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} home-bg-animated opacity-40 dark:opacity-70`} />
              <div
                className="absolute inset-0 home-blob"
                style={{ background: `radial-gradient(ellipse_at_top_right, ${s.glow}, transparent 55%), radial-gradient(ellipse_at_bottom_left, rgba(124,58,237,0.5), transparent 55%)` }}
              />
              <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full blur-3xl home-blob-slow" style={{ background: s.glow }} />
              <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full blur-3xl home-blob-slow" style={{ background: 'rgba(124,58,237,0.45)' }} />
            </div>
          ))}

          <div className="relative h-full flex items-center px-6 sm:px-12">
            <div key={slideIdx} className="home-fade-in max-w-3xl w-full">
              <span className="home-stagger-1 inline-flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-fuchsia-700 dark:text-fuchsia-400 bg-fuchsia-100/80 dark:bg-fuchsia-950/50 border border-fuchsia-200/70 dark:border-fuchsia-900/50 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 font-semibold mb-2 sm:mb-4">
                <slide.icon size={13} />
                {slide.badge.replace('%CITY%', userCity)}
              </span>

              <h1 className="home-stagger-2 text-lg sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight mb-2 sm:mb-3">
                {slide.title}
                <span className="block bg-gradient-to-r from-fuchsia-600 via-pink-600 to-purple-600 bg-clip-text text-transparent">
                  {slide.highlight}
                </span>
              </h1>

              <p className="home-stagger-3 text-slate-600 dark:text-slate-400 text-xs sm:text-base mb-3 sm:mb-6 max-w-xl leading-relaxed line-clamp-2 sm:line-clamp-none">
                {slide.desc}
              </p>

              <button
                onClick={() => goToSection(slide.to, slide.cta)}
                className="home-stagger-4 inline-flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-bold px-4 sm:px-6 py-2 sm:py-3 rounded-xl text-xs sm:text-sm shadow-md shadow-fuchsia-600/25 transition-all hover:scale-[1.03] active:scale-95 cursor-pointer"
              >
                {slide.cta} <ArrowRight size={15} />
              </button>
            </div>
          </div>

          {/* Controles del carrusel */}
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => goToSlide(slideIdx - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-white/80 dark:bg-white/10 text-slate-600 dark:text-white border border-slate-200 dark:border-white/10 backdrop-blur-sm shadow-sm hover:bg-white dark:hover:bg-white/20 transition-all cursor-pointer"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => goToSlide(slideIdx + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-white/80 dark:bg-white/10 text-slate-600 dark:text-white border border-slate-200 dark:border-white/10 backdrop-blur-sm shadow-sm hover:bg-white dark:hover:bg-white/20 transition-all cursor-pointer"
          >
            <ChevronRight size={20} />
          </button>

          {/* Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
            {SLIDES.map((s, i) => (
              <button
                key={s.badge}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => goToSlide(i)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${i === slideIdx ? 'w-7 bg-fuchsia-600 dark:bg-fuchsia-400' : 'w-1.5 bg-slate-300 dark:bg-zinc-700 hover:bg-slate-400 dark:hover:bg-zinc-600'}`}
              />
            ))}
          </div>
          </div>
        </div>
      </section>

      {/* ===== ENVÍO GRATIS ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12">
        <SectionHeader
          icon={Truck}
          title={`Envío gratis en ${userCity}`}
          subtitle="Productos cerca de ti que llegan sin costo adicional"
          onSeeAll={() => goToSection(`/listpr?envio_gratis=true`, 'Ver envíos gratis')}
          seeAllLabel="Ver todos"
        />
        {loading && <SkeletonList count={4} />}
        {!loading && freeShip.length === 0 && (
          <div className="bg-white dark:bg-[#121212] rounded-2xl border border-slate-200 dark:border-zinc-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Aún no hay productos con envío gratis en {userCity}.
          </div>
        )}
        {!loading && freeShip.length > 0 && (
          <ProductCarousel
            items={freeShip}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onAddToCart={handleAddToCart}
            formatPrice={formatPrice}
            getFinalPrice={getFinalPrice}
            getProductImage={getProductImage}
            basePriceOf={basePriceOf}
          />
        )}
      </section>

      <SegmentDivider />

      {/* ===== PRUEBA SOCIAL ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {SOCIAL_PROOF.map((s) => (
            <div key={s.label} className="flex items-center gap-3 bg-white dark:bg-[#121212] rounded-2xl border border-slate-200 dark:border-zinc-800 p-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white flex items-center justify-center shadow-md shrink-0">
                <s.icon size={18} />
              </div>
              <div>
                <p className="font-extrabold text-slate-900 dark:text-white leading-none">{s.value}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== OFERTAS ===== */}
      {!loading && deals.length > 0 && (
        <>
          <SegmentDivider />
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            <SectionHeader
              icon={Timer}
              title="Ofertas que no puedes dejar pasar"
              subtitle={`Descuentos activos ahora mismo en ${userCity}`}
              onSeeAll={() => goToSection('/listpr?sort=high_price', 'Ver todas las ofertas')}
              seeAllLabel="Ver todas"
            />
            <ProductCarousel
              items={deals}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onAddToCart={handleAddToCart}
              formatPrice={formatPrice}
              getFinalPrice={getFinalPrice}
              getProductImage={getProductImage}
              basePriceOf={basePriceOf}
            />
          </section>
        </>
      )}

      {/* ===== PERSONALIZADO ===== */}
      {!loading && personalized.length > 0 && (
        <>
          <SegmentDivider />
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            <SectionHeader
              icon={Sparkles}
              title={`Para ti en ${userCity}`}
              subtitle="Según lo que viste y buscaste recientemente"
              onSeeAll={() => goToSection('/listpr', 'Ver recomendados')}
              seeAllLabel="Ver más"
            />
            {!loading && personalized.length > 0 && (
              <ProductCarousel
                items={personalized}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                onAddToCart={handleAddToCart}
                formatPrice={formatPrice}
                getFinalPrice={getFinalPrice}
                getProductImage={getProductImage}
                basePriceOf={basePriceOf}
              />
            )}
          </section>
        </>
      )}

      <SegmentDivider />

      {/* ===== MÁS BUSCADOS ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <SectionHeader
          icon={TrendingUp}
          title={`Los más buscados en ${userCity}`}
          subtitle="Lo que la gente está comprando y valorando ahora"
          onSeeAll={() => goToSection('/listpr?sort=rating', 'Ver más buscados')}
          seeAllLabel="Ver más"
        />
        {loading && <SkeletonList count={4} />}
        {!loading && popular.length === 0 && (
          <div className="bg-white dark:bg-[#121212] rounded-2xl border border-slate-200 dark:border-zinc-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Aún no hay productos disponibles en {userCity}.
          </div>
        )}
        {!loading && popular.length > 0 && (
          <ProductCarousel
            items={popular}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onAddToCart={handleAddToCart}
            formatPrice={formatPrice}
            getFinalPrice={getFinalPrice}
            getProductImage={getProductImage}
            basePriceOf={basePriceOf}
          />
        )}
      </section>

      <SegmentDivider />

      {/* ===== BENEFICIOS ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="group bg-white dark:bg-[#121212] rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${b.gradient} flex items-center justify-center text-white shadow-md mb-3 group-hover:scale-110 transition-transform`}>
                <b.icon size={20} />
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">{b.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CATEGORÍAS ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <SectionHeader
          icon={Package}
          title="Explora por categoría"
          subtitle="Encuentra exactamente lo que buscas"
          onSeeAll={() => goToSection('/listpr', 'Ver todas las categorías')}
          seeAllLabel="Ver todas"
        />

        <div ref={catRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {categories.map((cat, i) => (
            <button
              key={cat.id}
              onClick={() => {
                trackEvent('select_content', {
                  content_type: 'category',
                  content_id: String(cat.id),
                  content_name: cat.nombre,
                });
                try {
                  const searchCats = JSON.parse(localStorage.getItem('glopsy_search_cats') || '[]');
                  searchCats.push({ category_id: cat.id, category_name: cat.nombre, ts: Date.now() });
                  localStorage.setItem('glopsy_search_cats', JSON.stringify(searchCats.slice(-12)));
                } catch {}
                navigate(`/listpr?categoria=${cat.id}`);
              }}
              className="group relative overflow-hidden rounded-2xl p-4 text-left text-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer min-h-24"
              style={catInView ? { animation: `${['homeFadeUp', 'homeFadeLeft', 'homeFadeRight', 'homePop'][i % 4]} 400ms ease both`, animationDelay: `${(i % 8) * 70}ms` } : { opacity: 0 }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${CATEGORY_STYLE[i % CATEGORY_STYLE.length]} opacity-90 group-hover:opacity-100 transition-opacity`} />
              <div className="relative">
                <h3 className="font-bold text-sm sm:text-base mb-0.5">{cat.nombre}</h3>
                <p className="text-white/80 text-[11px] line-clamp-1">{cat.descripcion || 'Ver productos'}</p>
              </div>
              <ArrowRight size={16} className="absolute bottom-3 right-3 text-white/70 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      </section>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-24 right-6 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3 rounded-2xl shadow-2xl text-xs font-bold animate-in fade-in slide-in-from-bottom-3 flex items-center gap-2 border border-fuchsia-500/30 dark:border-fuchsia-300/40">
          <BadgeCheck size={16} className="text-fuchsia-400 dark:text-fuchsia-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      <Footer />
    </div>
  );
}
