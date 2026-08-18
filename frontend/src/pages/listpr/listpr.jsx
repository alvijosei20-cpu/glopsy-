import React, { useState, useEffect, useCallback } from 'react';
import { Search, Heart, MapPin, ShoppingCart, Star, ShieldCheck, Tag, Truck, RefreshCw, Filter, ArrowUpDown, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { SkeletonList } from '../../components/SkeletonLoader';
import './listpr.css';

export default function Listpr() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(12);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');
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

    const token = localStorage.getItem('token');
    if (token) {
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
        },
      });

      const data = response.data;
      if (data.ok) {
        const newProducts = data.products || [];
        setTotal(data.total || 0);
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
  }, [limit, userCity]);

  // Carga inicial y al cambiar búsqueda o categoría
  useEffect(() => {
    setOffset(0);
    fetchProducts(submittedQuery, selectedCategory, 0, false);
  }, [submittedQuery, selectedCategory, fetchProducts]);

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
  };

  const handleToggleFavorite = async (productId, e) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    if (!token) {
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
      }
    } catch (err) {
      console.error('Error al alternar favorito:', err);
    }
  };

  // Ordenamiento en frontend
  const sortedProducts = [...products].sort((a, b) => {
    const priceA = Number(a.suggested_price || a.base_price || 0);
    const priceB = Number(b.suggested_price || b.base_price || 0);
    if (sortBy === 'low_price') return priceA - priceB;
    if (sortBy === 'high_price') return priceB - priceA;
    return 0;
  });

  const formatPrice = (val) => {
    const num = Number(val || 0);
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Search Header Bar */}
      <div className="bg-white border-b border-fuchsia-100 shadow-sm py-3 px-4 sm:px-8 sticky top-16 z-45">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Barra de Búsqueda */}
          <form onSubmit={handleSearchSubmit} className="w-full md:w-2/3 flex items-center bg-slate-50 border border-fuchsia-200 rounded-xl shadow-inner overflow-hidden focus-within:ring-2 focus-within:ring-fuchsia-500 transition-all">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar productos, marcas y más..."
              className="w-full px-4 py-2.5 text-slate-800 outline-none text-sm md:text-base placeholder-slate-400 bg-transparent"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setSubmittedQuery(''); }}
                className="px-3 text-slate-400 hover:text-fuchsia-600 text-sm font-bold transition-colors"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              className="bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white px-6 py-2.5 transition-all flex items-center justify-center shadow-md shadow-fuchsia-600/20"
            >
              <Search size={18} />
            </button>
          </form>

          {/* Ubicación del Usuario */}
          <div className="flex items-center gap-2 text-fuchsia-800 text-xs md:text-sm font-medium bg-fuchsia-50/80 px-4 py-2 rounded-xl shadow-sm border border-fuchsia-100">
            <MapPin size={16} className="text-fuchsia-600 shrink-0" />
            <span>Enviar a <b>{userCity}</b></span>
          </div>

        </div>
      </div>

      {/* Main Content & Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Categorías (Filtros estilo Mercado Libre) */}
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold whitespace-nowrap transition-all shadow-sm ${
              selectedCategory === null
                ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-fuchsia-600/20'
                : 'bg-white text-slate-600 border border-fuchsia-100 hover:bg-fuchsia-50 hover:text-fuchsia-600'
            }`}
          >
            Todas las categorías
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold whitespace-nowrap transition-all shadow-sm ${
                selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-fuchsia-600/20'
                  : 'bg-white text-slate-600 border border-fuchsia-100 hover:bg-fuchsia-50 hover:text-fuchsia-600'
              }`}
            >
              {cat.nombre}
            </button>
          ))}
        </div>

        {/* Subheader & Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-fuchsia-100 mb-6 gap-4">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-slate-900">
              {submittedQuery ? `Resultados para "${submittedQuery}"` : (selectedCategory ? categories.find(c => c.id === selectedCategory)?.nombre || 'Categoría' : 'Catálogo de Productos')}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {total} productos encontrados
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <ArrowUpDown size={16} className="text-fuchsia-500" />
              <span>Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-50 border border-fuchsia-200 rounded-xl px-3 py-1.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-fuchsia-500 transition-all"
              >
                <option value="relevance">Más relevantes</option>
                <option value="low_price">Menor precio</option>
                <option value="high_price">Mayor precio</option>
              </select>
            </div>
          </div>
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
              onClick={() => { setQuery(''); setSubmittedQuery(''); setSelectedCategory(null); }}
              className="bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-semibold px-6 py-2.5 rounded-xl transition-all text-sm shadow-md shadow-fuchsia-600/20"
            >
              Ver todos los productos
            </button>
          </div>
        )}

        {/* Products Grid */}
        {sortedProducts.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 max-w-6xl mx-auto">
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
                  onClick={() => navigate(`/product/${p.public_id || p.id}`)}
                  className="bg-white rounded-none shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200 flex flex-col sm:flex-row overflow-hidden group cursor-pointer relative min-h-[14rem] sm:min-h-[13rem]"
                >
                  {/* Image Container */}
                  <div className="relative w-full sm:w-2/5 h-44 sm:h-full bg-slate-50 overflow-hidden flex items-center justify-center border-b sm:border-b-0 sm:border-r border-slate-200 shrink-0">
                    <img
                      src={getProductImage(p)}
                      alt={p.name}
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
