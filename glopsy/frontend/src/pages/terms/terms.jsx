import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Truck, RotateCcw, FileWarning, CreditCard, Lock, Scale, ScrollText, CircleHelp, FileSignature } from 'lucide-react';
import { useSEO } from '../../utils/seo';
import { TERMS_SECTIONS } from '../../utils/termsContent';

const ICONS = [ScrollText, FileSignature, FileWarning, Truck, RotateCcw, CreditCard, Lock, Scale, CircleHelp];

const SECTIONS = TERMS_SECTIONS.map((section, i) => ({ ...section, icon: ICONS[i] || ScrollText }));

export default function Terms() {
  useSEO({
    title: 'Términos y Condiciones',
    description:
      'Términos y condiciones de Glopsy, marketplace de dropshipping en Colombia. Glopsy actúa como intermediario tecnológico y no es responsable por los productos ofrecidos por vendedores independientes.',
    path: '/terminos',
  });

  return (
    <div className="min-h-screen bg-white dark:bg-black text-slate-800 dark:text-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-fuchsia-600 dark:hover:text-fuchsia-400 transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Volver al inicio
        </Link>

        <div className="flex items-start gap-3 mb-2">
          <ShieldCheck size={28} className="text-fuchsia-600 shrink-0 mt-1" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Términos y Condiciones
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
          Última actualización: 20 de septiembre de 2026
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-8 max-w-2xl">
          Este documento regula el uso de la plataforma Glopsy, operada por Nodux Technology. Al acceder o usar
          Glopsy® aceptas los siguientes términos en su totalidad.
        </p>

        <div className="rounded-2xl border border-fuchsia-200/70 dark:border-fuchsia-900/40 bg-fuchsia-50 dark:bg-fuchsia-950/30 p-4 mb-8 text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex gap-2.5">
          <FileWarning size={16} className="text-fuchsia-600 shrink-0 mt-0.5" />
          <p>
            <b>Advertencia:</b> Glopsy es un servicio de intermediación. Los productos que compras son vendidos y
            enviados por terceros (dropshipping). Glopsy no es parte de la relación de compraventa y no asume
            responsabilidad por los productos, su calidad, entrega o garantía.
          </p>
        </div>

        <div className="space-y-5">
          {SECTIONS.map((s) => (
            <section
              key={s.title}
              className="rounded-2xl bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 p-5 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white flex items-center justify-center shadow-md shrink-0">
                  <s.icon size={16} />
                </div>
                <h2 className="font-bold text-sm text-slate-900 dark:text-white">{s.title}</h2>
              </div>
              <div className="space-y-2 ml-10">
                {s.body.map((p, i) => (
                  <p key={i} className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed mt-8 text-center">
          Nodux Technology · Glopsy® Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
