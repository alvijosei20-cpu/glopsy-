import { useEffect, useState } from 'react';
import { Globe, X } from 'lucide-react';
import api from '../services/api';

const DISMISS_KEY = 'country_notice_dismissed';

const countryName = (iso) => {
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(iso) || iso;
  } catch {
    return iso;
  }
};

// Aviso para visitantes cuyo país no está entre los países donde opera Glopsy.
// El país se deduce en el edge (CF-IPCountry) vía /api/geo/visitor-country.
export default function CountryNotice() {
  const [country, setCountry] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (dismissed) return;
    let alive = true;
    api
      .get('/geo/visitor-country')
      .then(({ data }) => {
        if (!alive || !data?.ok || !data.detected) return;
        const supported = Array.isArray(data.supported) ? data.supported : [];
        if (supported.length > 0 && !supported.includes(data.detected)) {
          setCountry(countryName(data.detected));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [dismissed]);

  if (dismissed || !country) return null;

  const close = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, 'true');
    } catch {}
    setDismissed(true);
  };

  return (
    <div className="w-full bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3 text-xs sm:text-sm">
        <Globe size={18} className="shrink-0" />
        <p className="flex-1 leading-snug">
          Aún no operamos en <strong>{country}</strong>. Por ahora Glopsy solo compra y
          envía dentro de Colombia y Venezuela.
        </p>
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar aviso"
          className="shrink-0 p-1 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
