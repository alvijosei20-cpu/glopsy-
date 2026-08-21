import React, { useState, useEffect } from 'react';
import { Heart, ShoppingBag, ArrowLeft, Star, MapPin, Store as StoreIcon, Sparkles } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { SkeletonList } from '../../components/SkeletonLoader';
import { trackEvent } from '../../utils/analytics';

export default function Favorites() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const userCity = sessionStorage.getItem('location_city') || 'Bogotá D.C.';
        const res = await api.get('/product/favorite-products', { params: { ciudad: userCity } });
        if (res.data.ok) {
          const favs = res.data.products || [];
          setProducts(favs);
          if (favs.length > 0) {
            trackEvent('view_item_list', {
              currency: 'COP',
              item_list_id: 'wishlist',
              item_list_name: 'Favoritos',
              items: favs.map(p => ({
                item_id: String(p.public_id || p.id),
                item_name: p.name,
                item_brand: p.tienda_nombre || 'Glopsy',
                item_category: p.categoria_nombre || '',
                price: Number(p.suggested_price || p.base_price || 0),
                quantity: 1,
              })),
            });
          }
        }
      } catch (err) {
        console.error('Error al cargar productos favoritos:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, []);

  const getProductImage = (p) => {
    try {
      if (p.image && typeof p.image === 'string' && p.image.startsWith('http')) return p.image;
      if (Array.isArray(p.images) && p.images.length > 0) {
        const first = p.images[0];
        if (typeof first === 'string') return first;
        if (first?.src) return first.src;
      }
      if (typeof p.images === 'string') {
        const parsed = JSON.parse(p.images);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const first = parsed[0];
          if (typeof first === 'string') return first;
          if (first?.src) return first.src;
        }
        if (typeof parsed === 'string') return parsed;
      }
    } catch {}
    return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60';
  };

  const handleRemoveFavorite = async (productId, e) => {
    e.stopPropagation();
    try {
      const res = await api.post('/product/favorite', { productId });
      if (res.data.ok && !res.data.favorited) {
        setProducts(prev => prev.filter(p => p.id !== productId));
        setToastMessage('Producto eliminado de favoritos');
        setTimeout(() => setToastMessage(''), 3000);
        const p = products.find(prod => Number(prod.id) === Number(productId));
        trackEvent('remove_from_wishlist', {
          currency: 'COP',
          value: Number(p?.suggested_price || p?.base_price || 0),
          items: [
            {
              item_id: String(p?.public_id || productId),
              item_name: p?.name || 'Producto',
              price: Number(p?.suggested_price || p?.base_price || 0),
              quantity: 1,
            },
          ],
        });
      }
    } catch (err) {
      console.error('Error al quitar de favoritos:', err);
    }
  };

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
        item_list_id: 'wishlist',
        item_list_name: 'Favoritos',
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

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="h-10 bg-slate-200 rounded-xl w-1/3 animate-pulse"></div>
        <SkeletonList count={4} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative min-h-[80vh]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Heart className="text-pink-500 fill-pink-500 animate-pulse" size={30} />
            Mis Favoritos
          </h1>
          <p className="text-slate-600 mt-1 text-sm sm:text-base">
            Tus productos guardados organizados en un acceso rápido.
          </p>
        </div>
        <Link
          to="/listpr"
          className="flex items-center gap-2 text-sm font-medium text-fuchsia-600 hover:text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 px-4 py-2.5 rounded-xl transition-all shadow-xs"
        >
          <ArrowLeft size={16} />
          Explorar
        </Link>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in border border-slate-700">
          <Sparkles className="text-fuchsia-400" size={18} />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-fuchsia-100/60 shadow-sm p-8">
          <div className="w-16 h-16 bg-fuchsia-50 text-fuchsia-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Heart size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">No tienes favoritos guardados</h2>
          <p className="text-slate-600 max-w-md mx-auto mb-6 text-sm">
            Explora nuestro catálogo y haz clic en el ícono de corazón para guardar tus productos preferidos aquí.
          </p>
          <Link
            to="/listpr"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white px-6 py-3 rounded-xl font-medium shadow-md shadow-fuchsia-600/20 hover:from-fuchsia-500 hover:to-pink-500 transition-all text-sm"
          >
            <ShoppingBag size={18} />
            Ver Catálogo
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map(p => {
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
            const price = hasDiscount ? finalPrice : baseP;
            const image = getProductImage(p);

            return (
              <div
                key={p.id}
                onClick={() => {
                  trackEvent('select_item', {
                    currency: 'COP',
                    item_list_id: 'wishlist',
                    item_list_name: 'Favoritos',
                    items: [
                      {
                        item_id: String(p.public_id || p.id),
                        item_name: p.name,
                        item_brand: p.tienda_nombre || 'Glopsy',
                        item_category: p.categoria_nombre || '',
                        price: price,
                        quantity: 1,
                      },
                    ],
                  });
                  navigate(`/product/${p.public_id || p.id}`);
                }}
                className="group bg-white rounded-2xl border border-slate-100 hover:border-slate-200 p-3 sm:p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-row items-center gap-3.5 sm:gap-5 cursor-pointer relative"
              >
                {/* Product Image Thumbnail */}
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                  <img
                    src={image}
                    alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60';
                    }}
                  />
                  {hasDiscount && (
                    <span className="absolute top-1 right-1 bg-pink-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                      {discountInfo.tipo === 'porcentaje' ? `${discountInfo.valor}%` : 'OFF'}
                    </span>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {p.categoria && (
                      <span className="text-[11px] font-medium text-fuchsia-600 uppercase tracking-wider">
                        {p.categoria}
                      </span>
                    )}
                    {p.ciudad && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <MapPin size={10} className="text-fuchsia-500 shrink-0" />
                          {p.ciudad}
                        </span>
                      </>
                    )}
                  </div>

                  <h3 className="font-medium text-slate-800 group-hover:text-fuchsia-600 transition-colors text-sm sm:text-base line-clamp-1 mb-1">
                    {p.name}
                  </h3>

                  <div className="flex items-baseline gap-2">
                    <span className="text-sm sm:text-base font-bold text-slate-900">
                      ${price.toLocaleString()} COP
                    </span>
                    {hasDiscount && (
                      <span className="text-xs text-slate-400 line-through">
                        ${baseP.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => handleAddToCart(p, e)}
                    className="p-2 sm:px-3.5 sm:py-2 bg-slate-50 hover:bg-fuchsia-50 text-slate-700 hover:text-fuchsia-700 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 border border-slate-200/60 hover:border-fuchsia-200"
                    title="Agregar al carrito"
                  >
                    <ShoppingBag size={15} />
                    <span className="hidden sm:inline">Agregar</span>
                  </button>

                  <button
                    onClick={(e) => handleRemoveFavorite(p.id, e)}
                    className="p-2 text-slate-400 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-all border border-slate-200/60 hover:border-pink-200"
                    title="Quitar de favoritos"
                  >
                    <Heart size={16} className="fill-pink-500 text-pink-500" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
