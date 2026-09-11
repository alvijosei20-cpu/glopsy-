import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Loader2, PackageX } from 'lucide-react';
import api from '../services/api';
import { useStorefront } from './StorefrontContext';
import { useUserCity } from '../utils/location';
import { formatMoney } from '../utils/money';

const productImg = (p) => {
  try {
    if (Array.isArray(p.images) && p.images[0]?.src) return p.images[0].src;
    if (typeof p.images === 'string' && p.images.trim()) {
      const parsed = JSON.parse(p.images);
      if (Array.isArray(parsed) && parsed[0]?.src) return parsed[0].src;
      if (Array.isArray(parsed) && typeof parsed[0] === 'string') return parsed[0];
      if (typeof parsed === 'string') return parsed;
    }
  } catch {}
  return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60';
};

export default function StorefrontHome() {
  const { slug, store } = useStorefront();
  const ciudad = useUserCity();
  const [q, setQ] = useState('');
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (reset = false) => {
    try {
      setLoading(true);
      setError('');
      const next = reset ? 0 : offset;
      const { data } = await api.get(`/storefront/${slug}/products`, {
        params: { limit: 30, offset: next, q: q.trim() || undefined, ciudad: ciudad || undefined },
      });
      setProducts((prev) => (reset ? (data.products || []) : [...prev, ...(data.products || [])]));
      setTotal(data.total || 0);
      setOffset(next + (data.products || []).length);
    } catch {
      setError('No fue posible cargar los productos de esta tienda.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (slug) load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, ciudad]);

  const submit = (e) => {
    e.preventDefault();
    load(true);
  };

  return (
    <div className="bg-gradient-to-b from-fuchsia-50/60 to-white min-h-[70vh]">
      <section className="max-w-6xl mx-auto px-4 py-8 sm:py-12 text-center">
        <h1 className="text-2xl sm:text-4xl font-black text-slate-800">
          {store?.name || 'Tienda'}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Productos de esta tienda · envíos y pagos seguros a través de Glopsy
        </p>

        <form onSubmit={submit} className="mt-6 max-w-md mx-auto flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar en esta tienda…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-fuchsia-200 bg-white text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Buscar
          </button>
        </form>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-12">
        {loading && products.length === 0 ? (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-16">
            <Loader2 size={16} className="animate-spin text-fuchsia-600" />
            Cargando productos…
          </div>
        ) : error ? (
          <p className="text-center text-sm text-pink-600 py-16">{error}</p>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-slate-400 py-16">
            <PackageX size={36} />
            <p className="text-sm">Esta tienda aún no tiene productos que coincidan.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {products.map((p) => (
                <Link
                  key={p.public_id}
                  to={`/product/${p.public_id}`}
                  className="group bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="aspect-square bg-slate-50 overflow-hidden">
                    <img
                      src={productImg(p)}
                      alt={p.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-slate-500 line-clamp-2 min-h-[2rem]">{p.name}</p>
                    <p className="mt-1.5 font-extrabold text-slate-800 text-sm">{formatMoney(p.price, { currency: store?.moneda, locale: store?.locale })}</p>
                    {p.review_count > 0 && (
                      <p className="mt-0.5 text-[10px] text-amber-500 font-semibold">
                        ★ {Number(p.avg_rating).toFixed(1)} ({p.review_count})
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {products.length < total && (
              <div className="text-center mt-8">
                <button
                  type="button"
                  onClick={() => load(false)}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl border border-fuchsia-300 text-fuchsia-700 text-sm font-bold hover:bg-fuchsia-50 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Cargando…' : 'Cargar más productos'}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
