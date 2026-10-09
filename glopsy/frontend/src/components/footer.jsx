import { Link } from 'react-router-dom';
import { FileText, ShieldCheck, Truck, Mail, Cookie } from 'lucide-react';
import { PROVIDER } from '../utils/termsContent';
import { openCookieConsent } from '../utils/cookieConsent';
export default function Footer() {
  return (
    <footer className="bg-black text-white w-screen relative left-1/2 -translate-x-1/2 -mb-2 sm:-mb-3">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-center md:text-left">
            <p className="font-extrabold text-white text-xs tracking-tight">
              Glopsy<span className="text-white/40">®</span>
            </p>
            <p className="text-[10px] text-white/50 mt-0.5">
              {PROVIDER.legalName} · NIT {PROVIDER.nit} · Domicilio {PROVIDER.country}
            </p>
            <p className="text-[10px] text-white/50 mt-0.5">Todos los derechos reservados</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] text-white/60">
            <Link
              to="/terminos"
              className="flex items-center gap-1 hover:text-white transition-colors text-sky-400"
            >
              <FileText size={12} />
              Términos y Condiciones
            </Link>
            <Link
              to="/privacidad"
              className="flex items-center gap-1 hover:text-white transition-colors text-sky-400"
            >
              <ShieldCheck size={12} />
              Política de Privacidad
            </Link>
            <span className="flex items-center gap-1 text-white/50">
              <ShieldCheck size={12} className="text-white/40" />
              Compras seguras
            </span>
            <button
              type="button"
              onClick={openCookieConsent}
              className="flex items-center gap-1 hover:text-white transition-colors text-sky-400 cursor-pointer"
            >
              <Cookie size={12} />
              Cookies
            </button>
            <span className="flex items-center gap-1 text-white/50">
              <Truck size={12} className="text-white/40" />
              Envíos nacionales
            </span>
            <a
              href="mailto:contacto@glopsy.shop"
              className="flex items-center gap-1 hover:text-white transition-colors text-white/50"
            >
              <Mail size={12} className="text-white/40" />
              contacto@glopsy.shop
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
