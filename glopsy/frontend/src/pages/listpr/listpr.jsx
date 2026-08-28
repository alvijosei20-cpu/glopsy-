import React, { useState, useEffect, useCallback } from 'react';
import { Search, Heart, MapPin, ShoppingCart, Star, Truck, Filter, ChevronDown, X, Check } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { isLoggedIn } from '../../utils/session';
import { SkeletonList } from '../../components/SkeletonLoader';
import { useSEO } from '../../utils/seo';
import { trackEvent } from '../../utils/analytics';
import './listpr.css';

export default function Listpr() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  useSEO({
    title: 'Tienda — Compra Productos en Línea',
    description:
      'Explora miles de productos de tiendas verificadas en Glopsy. Filtra por categoría, precio, envío gratis y calificación. Compra con pagos seguros en Colombia.',
    path: '/listpr',
  });
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [submittedQuery, setSubmittedQuery] = useState(() => searchParams.get('q') || '');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const cat = searchParams.get('categoria');
    return cat ? Number(cat) : null;
  });
  const [offset, setOffset] = useState(0);
  const [limit] = useState(12);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [freeShipping, setFreeShipping] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [favorites, setFavorites] = useState(new Set());
  const [cartItemCount, setCartItemCount] = useState(0);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const updateCount = () => {
      try {
        const items = JSON.parse(localStorage.getItem('glopsy_cart') || '[]');
        const totalCount = items.reduce((acc, item) => acc + Number(item.quantity || 1), 0);
        setCartItemCount(totalCount);
      } catch {
        setCartItemCount(0);
      }
    };
    updateCount();
    window.addEventListener('storage', updateCount);
    const interval = setInterval(updateCount, 500);
    return () => {
      window.removeEventListener('storage', updateCount);
      clearInterval(interval);
    };
  }, []);

  const handleAddToCart = (p, e) => {
    e.stopPropagation();
    try {
      const existingCart = JSON.parse(localStorage.getItem('glopsy_cart') || '[]');
      const baseP = Number(p.suggested_price || p.base_price || 0);
      let finalPrice = baseP;
      if (p.oferta_activa) {
        if (p.oferta_activa.tipo === 'porcentaje') {
          finalPrice = baseP * (1 - Number(p.oferta_activa.valor) / 100);
        } else if (p.oferta_activa.tipo === 'monto_fijo') {
          finalPrice = Math.max(0, baseP - Number(p.oferta_activa.valor));
        }
      }
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
          tienda_id: p.tienda_id
        });
      }
      localStorage.setItem('glopsy_cart', JSON.stringify(existingCart));
      window.dispatchEvent(new Event('storage'));

      trackEvent('add_to_cart', {
        currency: 'COP',
        value: finalPrice,
        items: [
          {
            item_id: String(p.public_id || p.id),
            item_name: p.name,
            item_brand: p.tienda_nombre || 'Glopsy',
            item_category: p.categoria_nombre || '',
            price: finalPrice,
            quantity: 1,
          },
        ],
      });

      setToastMessage('¡Producto agregado al carrito!');
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.error('Error al añadir al carrito:', err);
    }
  };

  const getUserCity = () => {
    try {
      const data = JSON.parse(sessionStorage.getItem('location_data') || localStorage.getItem('location_data') || '{}');
      if (data.city) return data.city;
    } catch {}
    return sessionStorage.getItem('location_city') || localStorage.getItem('location_city') || 'Bogotá D.C.';
  };
  const userCity = getUserCity();

  // Cargar categorías y favoritos al montar
  useEffect(() => {
    api.get('/product/categories')
      .then(res => {
        if (res.data.ok) {
          setCategories(res.data.categories || []);
        }
      })
      .catch(err => console.error('Error al cargar categorías:', err));

    if (isLoggedIn()) {
      api.get('/product/favorites')
        .then(res => {
          if (res.data.ok) {
            setFavorites(new Set(res.data.favorites));
          }
        })
        .catch(err => console.error('Error al cargar favoritos:', err));
    }
  }, []);

  const fetchProducts = useCallback(async (searchQ, catId, currentOffset, isAppend = false) => {
    if (isAppend) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await api.get('/product', {
        params: {
          q: searchQ,
          categoria_id: catId || undefined,
          limit,
          offset: currentOffset,
          ciudad: userCity,
          sort: sortBy,
          price_min: priceMin || undefined,
          price_max: priceMax || undefined,
          min_rating: minRating > 0 ? minRating : undefined,
          envio_gratis: freeShipping || undefined,
        },
      });

      const data = response.data;
      if (data.ok) {
        const newProducts = data.products || [];
        setTotal(data.total || 0);
        if (newProducts.length > 0 && !isAppend) {
          trackEvent('view_item_list', {
            currency: 'COP',
            item_list_id: 'catalog',
            item_list_name: 'Catálogo de productos',
            items: newProducts.map(p => ({
              item_id: String(p.public_id || p.id),
              item_name: p.name,
              item_brand: p.tienda_nombre || 'Glopsy',
              item_category: p.categoria_nombre || '',
              price: Number(p.suggested_price || p.base_price || 0),
              quantity: 1,
            })),
          });
        }
        if (isAppend) {
          setProducts(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const filtered = newProducts.filter(p => !existingIds.has(p.id));
            return [...prev, ...filtered];
          });
        } else {
          setProducts(newProducts);
        }
      }
    } catch (error) {
      console.error('Error al cargar productos:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [limit, userCity, sortBy, priceMin, priceMax, minRating, freeShipping]);

  // Carga inicial y al cambiar búsqueda, categoría, orden o filtros
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setOffset(0);
    fetchProducts(submittedQuery, selectedCategory, 0, false);
  }, [submittedQuery, selectedCategory, sortBy, priceMin, priceMax, minRating, freeShipping, fetchProducts]);

  // Manejo de Infinite Scroll (al llegar al final del scroll)
  useEffect(() => {
    const handleScroll = () => {
      if (loading || loadingMore) return;
      if (products.length >= total) return;

      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.scrollHeight - 250;

      if (scrollPosition >= threshold) {
        const nextOffset = offset + limit;
        setOffset(nextOffset);
        fetchProducts(submittedQuery, selectedCategory, nextOffset, true);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, loadingMore, products.length, total, offset, limit, submittedQuery, selectedCategory, fetchProducts]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSubmittedQuery(query);
    trackEvent('search', {
      search_term: query.trim(),
      search_type: 'catalog',
    });
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
          if (res.data.favorited) {
            next.add(productId);
          } else {
            next.delete(productId);
          }
          return next;
        });
        const p = products.find(prod => Number(prod.id) === Number(productId));
        const item = {
          item_id: String(p?.public_id || productId),
          item_name: p?.name || 'Producto',
          price: Number(p?.suggested_price || p?.base_price || 0),
          quantity: 1,
        };
        trackEvent(res.data.favorited ? 'add_to_wishlist' : 'remove_from_wishlist', {
          currency: 'COP',
          value: item.price,
          items: [item],
        });
      }
    } catch (err) {
      console.error('Error al alternar favorito:', err);
    }
  };

  // Ordenamiento ahora se aplica en el servidor (respeta paginación)
  const sortedProducts = products;

  const formatPrice = (val) => {
    const num = Number(val || 0);
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
  };

  const hasActiveFilters = Boolean(submittedQuery || selectedCategory || priceMin || priceMax || minRating > 0 || freeShipping);

  const clearFilters = () => {
    setQuery('');
    setSubmittedQuery('');
    setSelectedCategory(null);
    setPriceMin('');
    setPriceMax('');
    setMinRating(0);
    setFreeShipping(false);
    setSortBy('relevance');
  };

  const StarRating = ({ rating, size = 14, count }) => {
    const value = Number(rating || 0);
    const full = Math.round(value);
    return (
      <span className="flex items-center gap-1">
        <span className="flex items-center">
          {[1, 2, 3, 4, 5].map(i => (
            <Star
              key={i}
              size={size}
              className={i <= full ? 'text-amber-400 fill-amber-400' : 'text-slate-300 fill-slate-200'}
            />
          ))}
        </span>
        {value > 0 && <span className="text-xs font-bold text-slate-600">{Number(value).toFixed(1)}</span>}
        {count > 0 && <span className="text-[10px] text-slate-400">({count})</span>}
      </span>
    );
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

  const sidebar = (
    <div className="space-y-4">
      {/* ===== Categorías ===== */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3 sm:p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Categorías</h3>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all border flex items-center justify-between ${
              selectedCategory === null
                ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                : 'bg-white text-slate-600 border-transparent hover:bg-slate-50 hover:border-slate-200'
            }`}
          >
            Todas
            {selectedCategory === null && <Check size={14} className="shrink-0" />}
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all border flex items-center justify-between ${
                selectedCategory === cat.id
                  ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                  : 'bg-white text-slate-600 border-transparent hover:bg-slate-50 hover:border-slate-200'
              }`}
            >
              {cat.nombre}
              {selectedCategory === cat.id && <Check size={14} className="shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Filtros ===== */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Filtros</h3>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs font-semibold text-fuchsia-600 hover:text-fuchsia-700 transition-all"
            >
              <X size={13} />
              Limpiar
            </button>
          )}
        </div>

        <div className="space-y-4">
          {/* Precio */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">Precio</label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder="Mín"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="w-full min-w-0 h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none placeholder-slate-400 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/15 transition-all"
              />
              <span className="text-slate-300 text-sm shrink-0">—</span>
              <input
                type="number"
                min="0"
                placeholder="Máx"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="w-full min-w-0 h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none placeholder-slate-400 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/15 transition-all"
              />
            </div>
          </div>

          {/* Calificación mínima */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">Calificación</label>
            <select
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/15 transition-all"
            >
              <option value={0}>Cualquier rating</option>
              <option value={4}>4+ estrellas</option>
              <option value={3}>3+ estrellas</option>
              <option value={2}>2+ estrellas</option>
            </select>
          </div>

          {/* Envío gratis */}
          <button
            type="button"
            onClick={() => setFreeShipping(!freeShipping)}
            className={`w-full flex items-center justify-between gap-2 h-9 px-3 rounded-lg border text-xs font-semibold transition-all ${
              freeShipping
                ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-fuchsia-300 hover:text-fuchsia-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <Truck size={14} />
              Envío gratis
            </span>
            {freeShipping && <Check size={14} />}
          </button>

          {/* Ordenar */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">Ordenar por</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/15 transition-all"
            >
              <option value="relevance">Más relevantes</option>
              <option value="low_price">Menor precio</option>
              <option value="high_price">Mayor precio</option>
              <option value="newest">Más recientes</option>
              <option value="rating">Mejor calificados</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* ===== Barra de búsqueda ===== */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-16 z-45">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-fuchsia-500/30 focus-within:border-fuchsia-400 transition-all">
              <Search size={18} className="ml-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar productos, marcas y más..."
                className="flex-1 min-w-0 px-3 py-2.5 text-slate-800 outline-none text-sm md:text-base placeholder-slate-400 bg-transparent"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setSubmittedQuery(''); }}
                  className="px-3 text-slate-400 hover:text-fuchsia-600 text-sm font-bold transition-colors"
                  aria-label="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-white px-5 py-2.5 transition-all flex items-center justify-center gap-2 text-sm font-semibold"
              >
                <Search size={16} />
                <span className="hidden sm:inline">Buscar</span>
              </button>
            </form>

            {/* Ubicación del Usuario */}
            <div className="flex items-center gap-2 text-slate-600 text-xs md:text-sm font-medium bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 shrink-0">
              <MapPin size={16} className="text-fuchsia-600 shrink-0" />
              <span>Enviar a <b className="text-slate-900">{userCity}</b></span>
            </div>
          </div>

          {/* Categorías (solo móvil) */}
          <div className="mt-3 md:hidden flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 shrink-0 mr-1">Categorías</span>
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                selectedCategory === null
                  ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-fuchsia-300 hover:text-fuchsia-600'
              }`}
            >
              Todas
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                  selectedCategory === cat.id
                    ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-fuchsia-300 hover:text-fuchsia-600'
                }`}
              >
                {cat.nombre}
              </button>
            ))}
          </div>

          {/* Filtros colapsables (solo móvil) */}
          {filtersOpen && (
            <div className="mt-3 pt-3 border-t border-slate-100 md:hidden flex flex-wrap items-center gap-x-6 gap-y-2.5">
            {/* Precio */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Precio</span>
              <input
                type="number"
                min="0"
                placeholder="Mín"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="w-20 h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none placeholder-slate-400 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/15 transition-all"
              />
              <span className="text-slate-300 text-sm">—</span>
              <input
                type="number"
                min="0"
                placeholder="Máx"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="w-20 h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none placeholder-slate-400 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/15 transition-all"
              />
            </div>

            {/* Calificación mínima */}
            <div className="flex items-center gap-2">
              <Star size={13} className={minRating > 0 ? 'text-amber-500 fill-amber-400' : 'text-slate-400'} />
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/15 transition-all"
              >
                <option value={0}>Cualquier rating</option>
                <option value={4}>4+ estrellas</option>
                <option value={3}>3+ estrellas</option>
                <option value={2}>2+ estrellas</option>
              </select>
            </div>

            {/* Envío gratis */}
            <button
              type="button"
              onClick={() => setFreeShipping(!freeShipping)}
              className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-xs font-semibold transition-all ${
                freeShipping
                  ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-fuchsia-300 hover:text-fuchsia-600'
              }`}
            >
              <Truck size={14} />
              Envío gratis
            </button>

            {/* Ordenar */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ordenar</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/15 transition-all"
              >
                <option value="relevance">Más relevantes</option>
                <option value="low_price">Menor precio</option>
                <option value="high_price">Mayor precio</option>
                <option value="newest">Más recientes</option>
                <option value="rating">Mejor calificados</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs font-semibold text-fuchsia-600 hover:text-fuchsia-700 transition-all"
              >
                <X size={13} />
                Limpiar filtros
              </button>
            )}
            </div>
          )}
        </div>
      </div>

      {/* ===== Layout dos columnas: Sidebar (izquierda) + Productos (derecha) ===== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="md:grid md:grid-cols-[280px_1fr] md:gap-8 md:items-start">

          {/* Sidebar (solo tablet/desktop) */}
          <aside className="hidden md:block md:sticky md:top-36">
            {sidebar}
          </aside>

          {/* Columna de productos */}
          <section className="min-w-0">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-lg md:text-xl font-bold text-slate-900">
                  {submittedQuery ? `Resultados para "${submittedQuery}"` : (selectedCategory ? categories.find(c => c.id === selectedCategory)?.nombre || 'Categoría' : 'Catálogo de Productos')}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {total} {total === 1 ? 'producto' : 'productos'} encontrados
                </p>
              </div>
              {hasActiveFilters && (
                <span className="hidden sm:inline-flex shrink-0 text-[11px] font-semibold text-fuchsia-600 bg-fuchsia-50 border border-fuchsia-100 px-2.5 py-1 rounded-full">
                  {[selectedCategory !== null, priceMin !== '', priceMax !== '', minRating > 0, freeShipping].filter(Boolean).length} filtros activos
                </span>
              )}
              <button
                type="button"
                onClick={() => setFiltersOpen(!filtersOpen)}
                className={`md:hidden flex items-center gap-1.5 h-9 px-3.5 rounded-lg border text-xs font-semibold transition-all ${
                  filtersOpen
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-fuchsia-300 hover:text-fuchsia-600'
                }`}
              >
                <Filter size={13} />
                <span className="hidden sm:inline">Filtros</span>
                <ChevronDown size={14} className={`transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Loading Initial */}
            {loading && products.length === 0 && (
              <SkeletonList count={8} />
            )}

            {/* Empty State */}
            {!loading && products.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-fuchsia-100 p-12 text-center max-w-lg mx-auto my-12">
                <div className="w-16 h-16 bg-fuchsia-50 text-fuchsia-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Search size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">No encontramos productos en esta categoría</h3>
                <p className="text-slate-500 text-sm mb-6">
                  Intenta seleccionar otra categoría o buscar con otros términos.
                </p>
                <button
                  onClick={clearFilters}
                  className="bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-semibold px-6 py-2.5 rounded-xl transition-all text-sm shadow-md shadow-fuchsia-600/20"
                >
                  Ver todos los productos
                </button>
              </div>
            )}

        {/* Products Grid */}
        {sortedProducts.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 md:gap-4">
            {sortedProducts.map((p) => {
              const baseP = Number(p.suggested_price || p.base_price || 0);
              let finalPrice = baseP;
              let discountInfo = null;

              if (p.oferta_activa) {
                discountInfo = p.oferta_activa;
                if (discountInfo.tipo === 'porcentaje') {
                  finalPrice = baseP * (1 - Number(discountInfo.valor) / 100);
                } else if (discountInfo.tipo === 'monto_fijo') {
                  finalPrice = Math.max(0, baseP - Number(discountInfo.valor));
                }
              }

              const hasDiscount = Boolean(p.oferta_activa && finalPrice < baseP);
              const hasFreeShipping = Boolean(p.envio_gratis);
              const isFavorite = favorites.has(p.id);

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    trackEvent('select_item', {
                      currency: 'COP',
                      item_list_id: 'catalog',
                      item_list_name: 'Catálogo de productos',
                      items: [
                        {
                          item_id: String(p.public_id || p.id),
                          item_name: p.name,
                          item_brand: p.tienda_nombre || 'Glopsy',
                          item_category: p.categoria_nombre || '',
                          price: finalPrice,
                          quantity: 1,
                        },
                      ],
                    });
                    navigate(`/product/${p.public_id || p.id}`);
                  }}
                  className="bg-white rounded-none shadow-sm hover:shadow-xl transition-shadow duration-300 border border-slate-200 flex flex-col sm:flex-row overflow-hidden group cursor-pointer relative min-h-[14rem] sm:min-h-[13rem] [content-visibility:auto] [contain-intrinsic-size:auto_300px]"
                >
                  {/* Image Container */}
                  <div className="relative w-full sm:w-2/5 h-44 sm:h-full bg-slate-50 overflow-hidden flex items-center justify-center border-b sm:border-b-0 sm:border-r border-slate-200 shrink-0">
                    <img
                      src={getProductImage(p)}
                      alt={p.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    
                    {/* Botón Favorito (Toggle Switch de Corazón) */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleFavorite(p.id, e)}
                      className={`absolute top-2 left-2 z-20 p-1.5 rounded-full shadow-md transition-all duration-300 ${
                        isFavorite
                          ? 'bg-pink-600 text-white shadow-pink-500/40 scale-110'
                          : 'bg-white/90 backdrop-blur-sm text-slate-400 hover:text-pink-600 hover:bg-white border border-fuchsia-100'
                      }`}
                      title={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                    >
                      <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
                    </button>

                    {/* Badge de Descuento */}
                    {hasDiscount && (
                      <span className="absolute top-2 right-2 bg-gradient-to-r from-pink-600 to-rose-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-md shadow-pink-500/30">
                        {discountInfo.tipo === 'porcentaje' ? `${discountInfo.valor}% OFF` : '¡OFERTA!'}
                      </span>
                    )}
                  </div>

                  {/* Content Container */}
                  <div className="w-full sm:w-3/5 p-3.5 sm:p-4 flex flex-col flex-grow justify-between text-left pr-12">
                    <div>
                      {/* 1. Nombre */}
                      <h2 className="text-xs sm:text-sm font-normal text-slate-800 line-clamp-2 group-hover:text-fuchsia-600 transition-colors mb-2 leading-snug">
                        {p.name}
                      </h2>

                      {/* 1b. Calificación (reseñas) */}
                      {Number(p.review_count || 0) > 0 && (
                        <div className="mb-1.5">
                          <StarRating rating={p.avg_rating} count={p.review_count} />
                        </div>
                      )}

                      {/* 2. Precio y Botón Agregar al Carrito */}
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <div>
                          {hasDiscount && (
                            <span className="text-[11px] text-slate-400 line-through block">
                              {formatPrice(baseP)}
                            </span>
                          )}
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="text-base sm:text-lg font-bold text-slate-900">
                              {formatPrice(hasDiscount ? finalPrice : baseP)}
                            </span>
                            {hasDiscount && (
                              <span className="text-[11px] font-bold text-pink-600">
                                {discountInfo.tipo === 'porcentaje' ? `${discountInfo.valor}% OFF` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleAddToCart(p, e)}
                          className="absolute bottom-3 right-3 z-20 bg-fuchsia-100 hover:bg-fuchsia-200 active:bg-fuchsia-300 text-fuchsia-700 w-9 h-9 rounded-full shadow-md transition-all duration-200 cursor-pointer hover:scale-110 active:scale-95 flex items-center justify-center"
                          title="Agregar al carrito"
                        >
                          <ShoppingCart size={16} />
                          <span className="absolute top-1 right-2 text-pink-600 text-[10px] font-black">+</span>
                        </button>
                      </div>
                    </div>

                    {/* 3. Envio gratis / ofertas */}
                    {(hasFreeShipping || hasDiscount) && (
                      <div className="flex flex-wrap gap-1 pt-2 border-t border-fuchsia-50 mt-2">
                        {hasFreeShipping && (
                          <div className="flex items-center gap-1 text-emerald-600 text-[11px] font-bold bg-emerald-50 px-2 py-0.5 rounded w-fit">
                            <Truck size={12} />
                            <span>Envío gratis</span>
                          </div>
                        )}
                        {hasDiscount && (
                          <div className="flex items-center gap-1 text-pink-600 text-[11px] font-bold bg-pink-50 px-2 py-0.5 rounded w-fit">
                            <span>Oferta</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Loading More Indicator */}
        {loadingMore && (
          <div className="flex items-center justify-center py-8 gap-3">
            <div className="w-6 h-6 border-3 border-fuchsia-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium text-slate-600">Cargando más productos...</span>
          </div>
        )}

        {/* End of results notice */}
        {!loading && products.length > 0 && products.length >= total && (
          <div className="text-center py-12 text-slate-400 text-sm font-medium">
            ¡Has visto todos los resultados disponibles! 🎉
          </div>
        )}

          </section>
        </div>
      </div>

      {/* Floating Cart Button */}
      <button
        onClick={() => navigate('/cart')}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white p-4 rounded-full shadow-2xl shadow-fuchsia-600/40 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center group cursor-pointer"
        title="Ver carrito de compras"
      >
        <ShoppingCart size={24} className="group-hover:rotate-12 transition-transform" />
        {cartItemCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-pink-700 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold shadow-lg shadow-pink-600/50 animate-bounce">
            {cartItemCount}
          </span>
        )}
      </button>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-xs font-bold animate-in fade-in slide-in-from-bottom-3 flex items-center gap-2 border border-fuchsia-500/30">
          <ShoppingCart size={16} className="text-fuchsia-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
