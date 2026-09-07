import { Link } from 'react-router-dom';
import { Store, ShoppingCart, ArrowLeft } from 'lucide-react';
import { getRootOrigin } from '../utils/storeHost';

export default function StoreHeader({ store }) {
  const img = store?.imageUrl || '';
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-fuchsia-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          {img ? (
            <img src={img} alt="" className="w-9 h-9 rounded-xl object-cover" />
          ) : (
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white flex items-center justify-center shrink-0">
              <Store size={17} />
            </span>
          )}
          <span className="font-extrabold text-slate-800 truncate">{store?.name || 'Tienda'}</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <Link
            to="/cart"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-fuchsia-50 hover:text-fuchsia-700 transition-colors"
          >
            <ShoppingCart size={18} />
            Carrito
          </Link>
          <a
            href={getRootOrigin()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-fuchsia-700 transition-colors"
            title="Volver al marketplace Glopsy"
          >
            <ArrowLeft size={15} />
            Glopsy
          </a>
        </div>
      </div>
    </header>
  );
}
