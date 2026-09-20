import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Loader2, PackageX, Star, Tag, Sparkles, Clock } from 'lucide-react';
import api from '../services/api';
import { formatMoney } from '../utils/money';

export const productImg = (p) => {
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

const money = (p, store) => formatMoney(p.price, { currency: store?.moneda, locale: store?.locale });

export function ProductCard({ p, store }) {
  return (
    <Link
      to={`/product/${p.public_id}`}
      className="sf-surface group rounded-2xl overflow-hidden sf-shadow hover:-translate-y-0.5 transition-transform"
    >
      <div className="aspect-square sf-soft overflow-hidden">
        <img src={productImg(p)} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
      </div>
      <div className="p-3">
        <p className="text-xs sf-muted line-clamp-2 min-h-[2rem]">{p.name}</p>
        <p className="mt-1.5 font-extrabold text-sm sf-text">{money(p, store)}</p>
        {p.review_count > 0 && (
          <p className="mt-0.5 text-[10px] text-amber-500 font-semibold">
            ★ {Number(p.avg_rating).toFixed(1)} ({p.review_count})
          </p>
        )}
      </div>
    </Link>
  );
}

function SearchBar({ value, onChange, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2 w-full max-w-xl">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 sf-muted" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar productos…"
          className="sf-input w-full pl-9 pr-3 py-2.5 text-sm"
        />
      </div>
      <button type="submit" className="sf-btn px-4 py-2.5 text-sm">Buscar</button>
    </form>
  );
}

function SectionTitle({ icon, children }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-extrabold sf-text mb-3">
      {icon} {children}
    </h2>
  );
}

function Empty({ children }) {
  return (
    <div className="flex flex-col items-center gap-2 sf-muted py-10">
      <PackageX size={32} />
      <p className="text-sm">{children}</p>
    </div>
  );
}

// ------------------------------------------------------------------
// Plantilla 1 (predeterminada): Dashboard
// ------------------------------------------------------------------
export function DashboardTemplate({ store, slug, ciudad }) {
  const [q, setQ] = useState('');
  const [data, setData] = useState({ latest: [], promotions: [], discounts: [] });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/storefront/${slug}/home`, {
        params: { q: q.trim() || undefined, ciudad: ciudad || undefined },
      });
      setData({ latest: res.latest || [], promotions: res.promotions || [], discounts: res.discounts || [] });
    } catch {
      setData({ latest: [], promotions: [], discounts: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (slug) load(); /* eslint-disable-next-line */ }, [slug, ciudad]);

  return (
    <div className="sf-root">
      <section className="sf-gradient-soft text-white">
        <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14 flex flex-col items-center text-center gap-4">
          {store?.imageUrl ? (
            <img src={store.imageUrl} alt="" className="w-20 h-20 rounded-3xl object-cover border-4 border-white/40" />
          ) : (
            <div className="w-20 h-20 rounded-3xl bg-white/20 flex items-center justify-center text-3xl font-black">
              {(store?.name || 'T').charAt(0)}
            </div>
          )}
          <h1 className="text-2xl sm:text-4xl font-black">{store?.name || 'Tienda'}</h1>
          <p className="text-sm text-white/80">Productos de esta tienda · pagos y envíos seguros con Glopsy</p>
          <SearchBar value={q} onChange={setQ} onSubmit={(e) => { e.preventDefault(); load(); }} />
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {loading ? (
          <div className="flex items-center justify-center gap-2 sf-muted py-16">
            <Loader2 size={16} className="animate-spin" /> Cargando tienda…
          </div>
        ) : (
          <>
            {data.promotions.length > 0 && (
              <section>
                <SectionTitle icon={<Sparkles size={18} className="sf-accent-text" />}>Promociones</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.promotions.map((o) => (
                    <div key={o.id} className="sf-surface rounded-2xl p-4">
                      <p className="font-bold sf-text">{o.titulo}</p>
                      {o.descripcion && <p className="text-xs sf-muted mt-1 line-clamp-2">{o.descripcion}</p>}
                      <span className="sf-chip inline-block mt-2 px-2.5 py-0.5 text-[11px] font-bold">
                        {o.tipo === 'porcentaje' ? `${o.valor}% OFF` : `$${o.valor} OFF`}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data.discounts.length > 0 && (
              <section>
                <SectionTitle icon={<Tag size={18} className="sf-accent-text" />}>Descuentos</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                  {data.discounts.map((p) => <ProductCard key={p.public_id} p={p} store={store} />)}
                </div>
              </section>
            )}

            <section>
              <SectionTitle icon={<Clock size={18} className="sf-accent-text" />}>Últimos publicados</SectionTitle>
              {data.latest.length === 0 ? (
                <Empty>Esta tienda aún no tiene productos publicados.</Empty>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                  {data.latest.map((p) => <ProductCard key={p.public_id} p={p} store={store} />)}
                </div>
              )}
              <div className="text-center mt-6">
                <Link to="/products" className="sf-btn inline-block px-5 py-2.5 text-sm">Ver todos los productos</Link>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Plantilla 2: Catálogo (lista total)
// ------------------------------------------------------------------
export function CatalogTemplate({ store, slug, ciudad }) {
  const [q, setQ] = useState('');
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async (reset = false) => {
    setLoading(true);
    try {
      const next = reset ? 0 : offset;
      const { data } = await api.get(`/storefront/${slug}/products`, {
        params: { limit: 30, offset: next, q: q.trim() || undefined, ciudad: ciudad || undefined },
      });
      setProducts((prev) => (reset ? (data.products || []) : [...prev, ...(data.products || [])]));
      setTotal(data.total || 0);
      setOffset(next + (data.products || []).length);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (slug) load(true); /* eslint-disable-next-line */ }, [slug, ciudad]);

  return (
    <div className="sf-root">
      <section className="sf-soft border-b sf-border">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            {store?.imageUrl && <img src={store.imageUrl} alt="" className="w-11 h-11 rounded-xl object-cover" />}
            <div>
              <h1 className="text-xl font-extrabold sf-text">{store?.name || 'Tienda'}</h1>
              <p className="text-xs sf-muted">{total} productos</p>
            </div>
          </div>
          <div className="sm:ml-auto w-full sm:w-auto">
            <SearchBar value={q} onChange={setQ} onSubmit={(e) => { e.preventDefault(); load(true); }} />
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading && products.length === 0 ? (
          <div className="flex items-center justify-center gap-2 sf-muted py-16">
            <Loader2 size={16} className="animate-spin" /> Cargando productos…
          </div>
        ) : products.length === 0 ? (
          <Empty>No hay productos que coincidan.</Empty>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {products.map((p) => <ProductCard key={p.public_id} p={p} store={store} />)}
            </div>
            {products.length < total && (
              <div className="text-center mt-8">
                <button type="button" onClick={() => load(false)} disabled={loading} className="sf-btn px-5 py-2.5 text-sm disabled:opacity-50">
                  {loading ? 'Cargando…' : 'Cargar más'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Plantilla 3: Boutique (portada + destacados)
// ------------------------------------------------------------------
export function BoutiqueTemplate({ store, slug, ciudad }) {
  const [q, setQ] = useState('');
  const [data, setData] = useState({ latest: [], promotions: [], discounts: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api.get(`/storefront/${slug}/home`, { params: { ciudad: ciudad || undefined } })
      .then(({ data: res }) => setData({ latest: res.latest || [], promotions: res.promotions || [], discounts: res.discounts || [] }))
      .catch(() => setData({ latest: [], promotions: [], discounts: [] }))
      .finally(() => setLoading(false));
  }, [slug, ciudad]);

  const featured = [...data.discounts, ...data.latest].slice(0, 4);

  return (
    <div className="sf-root">
      <section className="relative min-h-[280px] sm:min-h-[380px] flex items-center justify-center overflow-hidden">
        {store?.storefrontBanner ? (
          <img src={store.storefrontBanner} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 sf-gradient-soft" />
        )}
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative text-center text-white px-4 flex flex-col items-center gap-4">
          {store?.imageUrl ? (
            <img src={store.imageUrl} alt="" className="w-20 h-20 rounded-full object-cover border-4 border-white/60" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-black">
              {(store?.name || 'T').charAt(0)}
            </div>
          )}
          <h1 className="text-3xl sm:text-5xl font-black">{store?.name || 'Tienda'}</h1>
          <p className="text-sm text-white/85 max-w-md">Descubre nuestra colección</p>
          <Link to="/products" className="sf-btn px-6 py-3 text-sm">Ver catálogo completo</Link>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {loading ? (
          <div className="flex items-center justify-center gap-2 sf-muted py-16">
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </div>
        ) : (
          <>
            {featured.length > 0 && (
              <section>
                <SectionTitle icon={<Star size={18} className="sf-accent-text" />}>Destacados</SectionTitle>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
                  {featured.map((p) => <ProductCard key={p.public_id} p={p} store={store} />)}
                </div>
              </section>
            )}
            <section>
              <SectionTitle icon={<Clock size={18} className="sf-accent-text" />}>Novedades</SectionTitle>
              {data.latest.length === 0 ? <Empty>Pronto publicaremos productos.</Empty> : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                  {data.latest.map((p) => <ProductCard key={p.public_id} p={p} store={store} />)}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
