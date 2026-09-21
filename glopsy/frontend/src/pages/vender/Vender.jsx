import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Loader2, Globe, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { getRootOrigin, getRootDomain } from '../../utils/storeHost';
import { requestGeolocation } from '../../utils/location';
import { TERMS_VERSION, TERMS_SECTIONS } from '../../utils/termsContent';

// Subdominios reservados por la plataforma (no se pueden usar como tienda).
const RESERVED_SLUGS = new Set([
  'app', 'www', 'api', 'tienda', 'admin', 'panel', 'market', 'marketing',
  'listpr', 'catalogo', 'glopsy', 'glopsybot', 'auth', 'cart', 'checkout',
  'profile', 'favorites', 'terminos', 'privacidad', 'compras', 'consultar-pedido',
  'deep-link', 'product', 'products', 'home', 'search', 'banners', 'notifications',
  'webhooks', 'webhook', 'geo', 'stats', 'returns', 'login', 'register', 'vender',
  'publish', 'pago', 'pagos', 'mi-tienda', 'micuenta', 'ayuda', 'faq', 'blog',
  'legal', 'mail', 'smtp', 'support',
]);

export default function Vender() {
  const navigate = useNavigate();
  const { user, tienda, tiendaLoading, refreshTienda } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [gaId, setGaId] = useState('');
  const [paises, setPaises] = useState([]);
  const [paisId, setPaisId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [bancos, setBancos] = useState([]);
  const [bancosError, setBancosError] = useState('');
  const [bank, setBank] = useState({
    banco_codigo: '', tipo_cuenta: '', numero_cuenta: '', titular_cuenta: user?.name || '', titular_documento: '',
  });

  useEffect(() => {
    let alive = true;
    api
      .get('/geo/paises')
      .then(({ data }) => {
        if (!alive) return;
        const list = Array.isArray(data?.paises) ? data.paises : [];
        setPaises(list);
        const co = list.find((p) => p.codigo_iso === 'CO') || list[0];
        if (co) setPaisId(String(co.id));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!paisId) {
      setBancos([]);
      return;
    }
    let alive = true;
    setBancosError('');
    api
      .get('/geo/bancos', { params: { pais_id: paisId } })
      .then(({ data }) => {
        if (alive) setBancos(data?.bancos || []);
      })
      .catch(() => {
        if (alive) {
          setBancos([]);
          setBancosError('No pudimos cargar los bancos de ese país. Reintenta o cambia de país.');
        }
      });
    return () => {
      alive = false;
    };
  }, [paisId]);

  // Al cambiar de país, el banco de otro país deja de ser válido: se limpia.
  useEffect(() => {
    setBank((b) => (b.banco_codigo ? { ...b, banco_codigo: '', numero_cuenta: '' } : b));
  }, [paisId]);

  // Si el nombre del usuario carga después, se prellena el titular.
  useEffect(() => {
    if (!user?.name) return;
    setBank((b) => (b.titular_cuenta ? b : { ...b, titular_cuenta: user.name }));
  }, [user?.name]);

  const selectedPais = paises.find((p) => String(p.id) === String(paisId)) || null;
  const raiz = selectedPais?.dominio_raiz || getRootDomain();
  const slugNorm = slug.trim().toLowerCase();
  const slugReservado = RESERVED_SLUGS.has(slugNorm);
  const slugFormatoOk = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slugNorm) && slugNorm.length >= 2;

  if (!tiendaLoading && !user?.can_sell && !tienda) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-3 bg-white border border-fuchsia-100 rounded-3xl shadow-xl p-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
            <Store size={26} />
          </div>
          <h1 className="text-lg font-extrabold text-slate-800">Solo vendedores autorizados</h1>
          <p className="text-sm text-slate-500">
            La apertura de tiendas la aprueba el administrador de la plataforma. Si quieres
            vender, contacta al administrador para habilitar tu cuenta.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold px-5 py-2.5 hover:opacity-90 transition-opacity"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

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

  // Valida el formulario y abre el modal de Términos y Condiciones.
  const create = (e) => {
    e.preventDefault();
    if (busy) return;
    if (slugReservado) {
      setError(`El subdominio "${slug}" está reservado. Elige otro.`);
      return;
    }
    if (!slugFormatoOk) {
      setError('El subdominio debe tener 2 a 63 caracteres, solo minúsculas, números y guiones, y no empezar/terminar con guion.');
      return;
    }
    if (!bank.banco_codigo || !bank.tipo_cuenta || !bank.numero_cuenta || !bank.titular_cuenta) {
      setError('Completa tu cuenta bancaria: banco, tipo, número y titular.');
      return;
    }
    const esBinance = bank.banco_codigo === 'BINANCE_PAY';
    const cuentaValida = esBinance
      ? /^[A-Za-z0-9._@-]{4,60}$/.test(bank.numero_cuenta)
      : /^\d{4,40}$/.test(bank.numero_cuenta);
    if (!cuentaValida) {
      setError(esBinance
        ? 'Ingresa tu Binance Pay ID o correo (4 a 60 caracteres).'
        : 'El número de cuenta debe tener entre 4 y 40 dígitos.');
      return;
    }
    setError('');
    setShowTerms(true);
  };

  // Reúne la metadata de aceptación (coordenadas best-effort + navegador).
  const collectTermsMetadata = async () => {
    let coords = { latitude: null, longitude: null };
    try {
      const geo = await Promise.race([
        requestGeolocation(),
        new Promise((resolve) => setTimeout(() => resolve(null), 6000)),
      ]);
      if (geo) coords = { latitude: geo.lat, longitude: geo.lon };
    } catch {
      // Permiso denegado o no soportado: la aceptación se registra sin coordenadas.
    }
    let screen = null;
    let timezone = null;
    try {
      screen = `${window.screen.width}x${window.screen.height}`;
    } catch {}
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {}
    return {
      accepted: true,
      version: TERMS_VERSION,
      ...coords,
      timezone,
      language: typeof navigator !== 'undefined' ? navigator.language || null : null,
      platform: typeof navigator !== 'undefined' ? navigator.platform || null : null,
      screen,
      referrer: typeof document !== 'undefined' ? document.referrer || null : null,
    };
  };

  // Acepta los términos y crea la tienda (llamado desde el botón del modal).
  const confirmCreate = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const terms = await collectTermsMetadata();
      await api.post('/tienda', {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        ga_id: gaId.trim() || null,
        pais_id: paisId ? Number(paisId) : undefined,
        terms,
      });
      // La tienda ya existe: se registra la cuenta donde recibirá sus pagos.
      await api.put('/tienda/payout-account', bank);
      setShowTerms(false);
      await refreshTienda();
      navigate('/market/config', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible crear la tienda. Intenta de nuevo.');
      setShowTerms(false);
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
                pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
                minLength={2}
                required
                className="w-full py-2.5 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>
            {slug && slugReservado && (
              <p className="mt-1 text-[11px] font-semibold text-pink-600">
                "{slug}" está reservado por la plataforma. Elige otro, por ejemplo "{slug}-tienda".
              </p>
            )}
            {slug && !slugReservado && !slugFormatoOk && (
              <p className="mt-1 text-[11px] font-semibold text-pink-600">
                Usa 2–63 caracteres, minúsculas/números/guiones, sin empezar ni terminar en guion.
              </p>
            )}
            {slug && slugReservado === false && slugFormatoOk && (
              <p className="mt-1 text-[11px] text-slate-400">Tu vitrina quedará en: {slugNorm}.{raiz}</p>
            )}
          </div>

          <div>
            <label htmlFor="store-pais" className="block text-xs font-bold text-slate-600 mb-1.5">
              País donde vas a operar
            </label>
            <select
              id="store-pais"
              value={paisId}
              onChange={(e) => setPaisId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100"
            >
              {paises.length === 0 && <option value="">Cargando…</option>}
              {paises.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.moneda})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Define la moneda de tu catálogo y tu zona de envíos. No se puede cambiar en cualquier momento.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
            <p className="text-xs font-bold text-slate-700">Cuenta bancaria donde recibirás tus ventas</p>

            <div>
              <label htmlFor="bank-name" className="block text-xs font-bold text-slate-600 mb-1.5">Banco</label>
              <select
                id="bank-name"
                value={bank.banco_codigo}
                onChange={(e) => setBank({ ...bank, banco_codigo: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100"
              >
                <option value="">{bancos.length ? 'Selecciona tu banco' : 'Cargando bancos…'}</option>
                {bancos.map((b) => (
                  <option key={b.codigo} value={b.codigo}>{b.nombre}</option>
                ))}
              </select>
              {bancosError && <p className="mt-1 text-[11px] font-semibold text-pink-600">{bancosError}</p>}
              {!bancosError && bancos.length === 0 && paisId && (
                <p className="mt-1 text-[11px] text-slate-400">No hay bancos configurados para este país.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="bank-type" className="block text-xs font-bold text-slate-600 mb-1.5">Tipo de cuenta</label>
                <select
                  id="bank-type"
                  value={bank.tipo_cuenta}
                  onChange={(e) => setBank({ ...bank, tipo_cuenta: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100"
                >
                  <option value="">Selecciona</option>
                  <option value="ahorro">Ahorros</option>
                  <option value="corriente">Corriente</option>
                </select>
              </div>
              <div>
                <label htmlFor="bank-number" className="block text-xs font-bold text-slate-600 mb-1.5">
                  {bank.banco_codigo === 'BINANCE_PAY' ? 'Binance Pay ID o correo' : 'Número de cuenta'}
                </label>
                <input
                  id="bank-number"
                  inputMode={bank.banco_codigo === 'BINANCE_PAY' ? 'text' : 'numeric'}
                  value={bank.numero_cuenta}
                  onChange={(e) => setBank({ ...bank, numero_cuenta: bank.banco_codigo === 'BINANCE_PAY' ? e.target.value.trim() : e.target.value.replace(/\D/g, '') })}
                  placeholder={bank.banco_codigo === 'BINANCE_PAY' ? 'Ej. 123456789 o correo' : 'Solo dígitos'}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="bank-holder" className="block text-xs font-bold text-slate-600 mb-1.5">Titular de la cuenta</label>
              <input
                id="bank-holder"
                value={bank.titular_cuenta}
                onChange={(e) => setBank({ ...bank, titular_cuenta: e.target.value })}
                placeholder="Nombre o razón social"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 placeholder:text-slate-400"
              />
            </div>

            <div>
              <label htmlFor="bank-doc" className="block text-xs font-bold text-slate-600 mb-1.5">Documento del titular (opcional)</label>
              <input
                id="bank-doc"
                value={bank.titular_documento}
                onChange={(e) => setBank({ ...bank, titular_documento: e.target.value })}
                placeholder="NIT o cédula"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 placeholder:text-slate-400"
              />
            </div>

            <p className="text-[11px] text-slate-400">
              Verificamos que el banco exista en el catálogo del país seleccionado. Esta cuenta recibirá la liquidación diaria de tus ventas.
            </p>
          </div>

          <div>
            <label htmlFor="store-ga" className="block text-xs font-bold text-slate-600 mb-1.5">
              Google Analytics de tu tienda (opcional)
            </label>
            <input
              id="store-ga"
              value={gaId}
              onChange={(e) => setGaId(e.target.value.trim())}
              placeholder="G-XXXXXXXXXX"
              maxLength={40}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 placeholder:text-slate-400"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Lo puedes cambiar después desde el panel de tu tienda.
            </p>
          </div>

          {error && (
            <p className="text-[11px] font-semibold text-pink-600 bg-pink-50 border border-pink-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !name.trim() || !slugFormatoOk || slugReservado || !!bancosError || !bank.banco_codigo || !bank.tipo_cuenta || !bank.numero_cuenta || !bank.titular_cuenta}
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

      {showTerms && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !busy && setShowTerms(false)}
          />
          <div className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-fuchsia-100 flex flex-col overflow-hidden">
            <div className="flex items-start gap-3 p-5 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-extrabold text-slate-800">Términos, Condiciones y Contrato de Mandato</h2>
                <p className="text-[11px] text-slate-500">
                  Debes aceptarlos para crear tu tienda. Versión {TERMS_VERSION}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !busy && setShowTerms(false)}
                disabled={busy}
                aria-label="Cerrar"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {TERMS_SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="text-xs font-bold text-slate-800 mb-1">{section.title}</h3>
                  <div className="space-y-1.5">
                    {section.body.map((paragraph, i) => (
                      <p key={i} className="text-[11px] text-slate-500 leading-relaxed">{paragraph}</p>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-slate-400">
                Al aceptar, se registrará tu usuario, fecha y hora, dirección IP, navegador,
                dispositivo y coordenadas (si las autorizas) como constancia de la aceptación.
              </p>
            </div>

            <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <a
                href="/terminos"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-fuchsia-600 hover:underline"
              >
                Ver términos completos
              </a>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowTerms(false)}
                  disabled={busy}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmCreate}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-bold px-5 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  {busy ? 'Creando tienda…' : 'Acepto y crear tienda'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
