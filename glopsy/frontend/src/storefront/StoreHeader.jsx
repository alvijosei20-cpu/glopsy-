import { Link } from 'react-router-dom';
import { Store, ShoppingCart, ArrowLeft } from 'lucide-react';
import { getRootOrigin } from '../utils/storeHost';

export default function StoreHeader({ store }) {
  const img = store?.imageUrl || '';
  return (
    <header className="sf-surface sticky top-0 z-40 backdrop-blur shadow-sm border-b" style={{ background: 'var(--sf-surface)' }}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          {img ? (
            <img src={img} alt="" className="w-9 h-9 rounded-xl object-cover" />
          ) : (
            <span className="w-9 h-9 rounded-xl sf-gradient text-white flex items-center justify-center shrink-0">
              <Store size={17} />
            </span>
          )}
          <span className="font-extrabold sf-text truncate">{store?.name || 'Tienda'}</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <Link
            to="/cart"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold sf-text hover:opacity-80 transition-opacity"
          >
            <ShoppingCart size={18} />
            Carrito
          </Link>
          <a
            href={getRootOrigin()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold sf-muted hover:opacity-80 transition-opacity"
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
