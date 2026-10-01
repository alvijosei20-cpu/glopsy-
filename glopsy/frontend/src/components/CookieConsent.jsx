import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { getCookieConsent, setCookieConsent, OPEN_CONSENT_EVENT } from '../utils/cookieConsent';

// Banner de consentimiento de cookies (Ley 1581 de 2012 y RGPD). Bloquea las
// cookies analíticas/publicitarias hasta que el usuario decide.
export default function CookieConsent() {
  const [visible, setVisible] = useState(() => !getCookieConsent());

  useEffect(() => {
    const open = () => setVisible(true);
    window.addEventListener(OPEN_CONSENT_EVENT, open);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, open);
  }, []);

  if (!visible) return null;

  const decide = (analytics) => {
    setCookieConsent({ analytics, marketing: analytics });
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9998] p-3 sm:p-4">
      <div className="mx-auto max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-600 to-pink-600 flex items-center justify-center shrink-0">
            <Cookie size={18} />
          </div>
          <p className="text-xs sm:text-[13px] leading-relaxed text-zinc-300">
            Usamos cookies necesarias para el funcionamiento del sitio y, con tu permiso, cookies
            analíticas y de marketing para mejorar tu experiencia. Puedes leer más en nuestra{' '}
            <Link to="/privacidad" className="underline text-fuchsia-400 hover:text-fuchsia-300">
              Política de Privacidad
            </Link>
            .
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => decide(false)}
            className="px-4 py-2 rounded-xl border border-zinc-700 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 text-xs font-bold text-white hover:from-fuchsia-500 hover:to-pink-500 transition-all cursor-pointer"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
