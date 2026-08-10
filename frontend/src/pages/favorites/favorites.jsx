import React, { useState, useEffect } from 'react';
import { Heart, ShoppingBag, ArrowLeft, Star, MapPin, Store as StoreIcon } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { SkeletonList } from '../../components/SkeletonLoader';

export default function Favorites() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const res = await api.get('/product/favorite-products');
        if (res.data.ok) {
          setProducts(res.data.products || []);
        }
      } catch (err) {
        console.error('Error al cargar productos favoritos:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, []);

  const handleRemoveFavorite = async (productId, e) => {
    e.stopPropagation();
    try {
      const res = await api.post('/product/favorite', { productId });
      if (res.data.ok && !res.data.favorited) {
        setProducts(prev => prev.filter(p => p.id !== productId));
      }
    } catch (err) {
      console.error('Error al quitar de favoritos:', err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="h-10 bg-slate-200 rounded-xl w-1/3 animate-pulse"></div>
        <SkeletonList count={4} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Heart className="text-pink-500 fill-pink-500" size={32} />
            Mis Productos Favoritos
          </h1>
          <p className="text-slate-600 mt-1">
            Gestiona y accede rápidamente a los productos que has guardado.
          </p>
        </div>
        <Link
          to="/listpr"
          className="flex items-center gap-2 text-sm font-medium text-fuchsia-600 hover:text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100 px-4 py-2 rounded-lg transition-colors"
        >
          <ArrowLeft size={16} />
          Seguir explorando
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-fuchsia-100 shadow-sm p-8">
          <div className="w-16 h-16 bg-fuchsia-50 text-fuchsia-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">No tienes favoritos guardados</h2>
          <p className="text-slate-600 max-w-md mx-auto mb-6">
            Explora nuestro catálogo de productos y haz clic en el ícono de corazón para guardarlos aquí.
          </p>
          <Link
            to="/listpr"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white px-6 py-3 rounded-xl font-medium shadow-md shadow-fuchsia-600/20 hover:from-fuchsia-500 hover:to-pink-500 transition-all"
          >
            <ShoppingBag size={18} />
            Ver Productos
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map(p => {
            const price = Number(p.suggested_price || p.base_price || 0);
            const image = p.images?.[0] || p.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80';

            return (
              <div
                key={p.id}
                onClick={() => navigate(`/product/${p.public_id || p.id}`)}
                className="bg-white rounded-2xl border border-fuchsia-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col cursor-pointer group"
              >
                <div className="relative aspect-square overflow-hidden bg-slate-100">
                  <img
                    src={image}
                    alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <button
                    onClick={(e) => handleRemoveFavorite(p.id, e)}
                    className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md text-pink-600 hover:bg-white transition-colors"
                    title="Quitar de favoritos"
                  >
                    <Heart size={18} className="fill-pink-500 text-pink-500" />
                  </button>
                  {p.categoria && (
                    <span className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full font-medium">
                      {p.categoria}
                    </span>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800 line-clamp-2 group-hover:text-fuchsia-600 transition-colors mb-1">
                      {p.name}
                    </h3>
                    <div className="text-xl font-bold text-slate-900 mb-2">
                      ${price.toLocaleString()} COP
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    {p.ciudad ? (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin size={12} className="text-fuchsia-500 shrink-0" />
                        {p.ciudad}
                      </span>
                    ) : (
                      <span>Glopsy Store</span>
                    )}
                    {p.rating && (
                      <span className="flex items-center gap-1 font-semibold text-amber-500">
                        <Star size={12} className="fill-amber-500" />
                        {p.rating}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
