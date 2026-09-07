import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Loader2, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { getRootOrigin, getRootDomain } from '../../utils/storeHost';

export default function Vender() {
  const navigate = useNavigate();
  const { tienda, tiendaLoading, refreshTienda } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!tiendaLoading && tienda) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white flex items-center justify-center">
            <Store size={26} />
          </div>
          <h1 className="text-xl font-extrabold text-slate-800">Ya tienes una tienda</h1>
          <p className="text-sm text-slate-500">
            {tienda.name} está lista. Administra tus productos, pagos y envíos desde el panel.
          </p>
          <button
            type="button"
            onClick={() => navigate('/market')}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold px-5 py-2.5 hover:opacity-90 transition-opacity"
          >
            Ir a Mi tienda
          </button>
        </div>
      </div>
    );
  }

  const create = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/tienda', { name: name.trim(), slug: slug.trim().toLowerCase() });
      await refreshTienda();
      navigate('/market', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible crear la tienda. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full bg-white border border-fuchsia-100 rounded-3xl shadow-xl p-6 sm:p-8 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white flex items-center justify-center">
            <Store size={26} />
          </div>
          <h1 className="text-xl font-extrabold text-slate-800">Crea tu tienda en Glopsy</h1>
          <p className="text-sm text-slate-500">
            Tu tienda tendrá su propia dirección y catálogo separado: nadie más vende en tu espacio.
          </p>
        </div>

        <form onSubmit={create} className="space-y-4">
          <div>
            <label htmlFor="store-name" className="block text-xs font-bold text-slate-600 mb-1.5">
              Nombre de tu tienda
            </label>
            <input
              id="store-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Moda Linda Store"
              maxLength={100}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label htmlFor="store-slug" className="block text-xs font-bold text-slate-600 mb-1.5">
              Dirección de tu tienda (subdominio)
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 focus-within:border-fuchsia-400 focus-within:ring-2 focus-within:ring-fuchsia-100">
              <Globe size={15} className="text-slate-400 shrink-0" />
              <input
                id="store-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="mi-tienda"
                maxLength={63}
                pattern="[a-z0-9-]+"
                required
                className="w-full py-2.5 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>
            {slug && <p className="mt-1 text-[11px] text-slate-400">Tu vitrina quedará en: {slug}.{getRootDomain()}</p>}
          </div>

          {error && (
            <p className="text-[11px] font-semibold text-pink-600 bg-pink-50 border border-pink-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !name.trim() || !slug.trim()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-bold py-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? 'Creando tienda…' : 'Crear tienda'}
          </button>
          <a
            href={getRootOrigin()}
            className="block text-center text-xs font-semibold text-slate-400 hover:text-fuchsia-600"
          >
            ← Volver a Glopsy
          </a>
        </form>
      </div>
    </div>
  );
}
