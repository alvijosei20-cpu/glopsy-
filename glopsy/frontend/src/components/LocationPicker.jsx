import { useEffect, useMemo, useState } from 'react';
import {
  MapPin, ChevronDown, Navigation, X, Search, Check, Loader2, Info,
} from 'lucide-react';
import {
  getSupportedCities, requestGeolocation, reverseCity, saveCity, useUserCity,
} from '../utils/location';

const cityLabel = (r) => r.ciudad_nombre || '';
const deptLabel = (r) => r.departamento_nombre || '';

export default function LocationPicker({ className = '' }) {
  const city = useUserCity();
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle | locating | reverse | denied | unsupported | nosupport
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setStatus('idle');
    setError('');
    if (!loaded) {
      getSupportedCities().then((rows) => {
        setSupported(rows);
        setLoaded(true);
      });
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return supported;
    return supported.filter(
      (r) => (cityLabel(r) + ' ' + deptLabel(r)).toLowerCase().includes(q)
    );
  }, [supported, query]);

  const pick = (r) => {
    saveCity({ city: r.ciudad_nombre, departamento: r.departamento_nombre, source: 'manual' });
    setOpen(false);
  };

  const detect = async () => {
    setStatus('locating');
    setError('');
    try {
      const { lat, lon } = await requestGeolocation();
      setStatus('reverse');
      const u = await reverseCity(lat, lon);
      if (u && u.match) {
        saveCity({ city: u.match.ciudad_nombre, departamento: u.match.departamento_nombre, source: 'geo' });
        setOpen(false);
        return;
      }
      if (u && u.reversedCity) {
        setStatus('nosupport');
        setError(`No encontramos cobertura de envío en ${u.reversedCity}. Elige la ciudad más cercana:`);
        return;
      }
      throw new Error('sin resultado');
    } catch (err) {
      const code = err && (err.code || err.message);
      if (code === 1 || code === 'PERMISSION_DENIED') {
        setStatus('denied');
        setError('No se pudo acceder a tu ubicación. Actívala en Safari: el icono "Aa" → Ajustes del sitio web → Ubicación → Permitir.');
      } else if (code === 'unsupported') {
        setStatus('unsupported');
        setError('Este navegador no soporta geolocalización. Elige tu ciudad manualmente.');
      } else if (code === 2 || code === 'POSITION_UNAVAILABLE') {
        setStatus('denied');
        setError('Ubicación no disponible ahora. Elige tu ciudad manualmente.');
      } else {
        setStatus('idle');
        setError('No fue posible detectar tu ciudad. Elige una manualmente.');
      }
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium transition-colors ${className || ''}`}
        title="Cambiar ciudad de envío"
      >
        <MapPin size={15} className="text-fuchsia-600 shrink-0" />
        <span className="truncate max-w-[9rem] sm:max-w-none">
          Enviar a <b>{city}</b>
        </span>
        <ChevronDown size={13} className="opacity-60 shrink-0" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 max-h-[88dvh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-fuchsia-50 text-fuchsia-600">
                  <MapPin size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">¿Dónde te enviamos?</h3>
                  <p className="text-[11px] text-slate-500">Elige la ciudad de envío</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 overflow-y-auto flex-1">
              {/* Detectar por ubicación (requiere gesto → funciona en iOS) */}
              <button
                type="button"
                onClick={detect}
                disabled={status === 'locating' || status === 'reverse'}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white text-xs font-bold px-4 py-3 transition-all shadow-md shadow-fuchsia-600/20 disabled:opacity-70"
              >
                {status === 'locating' || status === 'reverse' ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    {status === 'reverse' ? 'Buscando tu ciudad…' : 'Solicitando ubicación…'}
                  </>
                ) : (
                  <>
                    <Navigation size={15} />
                    Usar mi ubicación
                  </>
                )}
              </button>
              <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1 leading-relaxed">
                <Info size={11} className="shrink-0" />
                iOS pedirá permiso al pulsar este botón.
              </p>

              {(status === 'denied' || status === 'unsupported' || status === 'nosupport') && error && (
                <p className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2 text-[11px] font-medium leading-relaxed">
                  {error}
                </p>
              )}
              {status === 'idle' && error && (
                <p className="mt-3 bg-pink-50 border border-pink-200 text-pink-700 rounded-xl px-3 py-2 text-[11px] font-semibold">
                  {error}
                </p>
              )}

              <div className="mt-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  O elige manualmente
                </p>
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar ciudad (Bogotá, Medellín…)"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100"
                  />
                </div>

                {!loaded ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-slate-400 text-xs">
                    <Loader2 size={14} className="animate-spin" /> Cargando ciudades…
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No encontramos ciudades con ese nombre.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-1 max-h-64 overflow-y-auto pr-1">
                    {filtered.map((r) => {
                      const active = cityLabel(r) === city;
                      return (
                        <button
                          key={r.ciudad_id}
                          type="button"
                          onClick={() => pick(r)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                            active
                              ? 'border-fuchsia-300 bg-fuchsia-50'
                              : 'border-slate-100 bg-white hover:border-fuchsia-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block text-xs font-bold text-slate-800 truncate">
                              {r.ciudad_nombre}
                            </span>
                            <span className="block text-[10px] text-slate-400 truncate">
                              {r.departamento_nombre}
                            </span>
                          </span>
                          {active && <Check size={15} className="text-fuchsia-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
