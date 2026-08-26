import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Truck, RotateCcw, FileWarning, CreditCard, Lock, Scale, ScrollText, CircleHelp } from 'lucide-react';
import { useSEO } from '../../utils/seo';

const SECTIONS = [
  {
    icon: ScrollText,
    title: '1. Naturaleza del servicio',
    body: [
      'Glopsy es una plataforma tecnológica de intermediación que facilita el comercio bajo el modelo de dropshipping. Glopsy NO fabrica, almacena, ni posee físicamente los productos publicados.',
      'Los vendedores independientes ("Vendedores") son los responsables directos de la calidad, autenticidad, disponibilidad, estado y entrega de los productos que publican.',
      'Al utilizar Glopsy, aceptas que la plataforma actúa únicamente como un servicio de intermediación y conectividad entre compradores y vendedores.',
    ],
  },
  {
    icon: FileWarning,
    title: '2. Limitación de responsabilidad',
    body: [
      'En virtud de lo dispuesto en el artículo 16 de la Ley 1480 de 2011 (Estatuto del Consumidor) y demás normas concordantes, la responsabilidad sobre los bienes ofertados corresponde directamente al Vendedor.',
      'Glopsy no responde por vicios ocultos, defectos de calidad, incumplimiento en la entrega, diferencias en el producto recibido, ni por cualquier daño derivado de la relación entre el Comprador y el Vendedor.',
      'Glopsy se limita a prestar el servicio de conectividad, gestión de pagos a través de pasarelas de pago autorizadas y coordinación logística. No es parte de la relación contractual de compraventa entre Comprador y Vendedor.',
    ],
  },
  {
    icon: Truck,
    title: '3. Envíos y entrega',
    body: [
      'El envío de los productos es coordinado directamente entre el Vendedor y el Comprador a través de transportadoras y mensajerías de terceros.',
      'Los tiempos de entrega, costos de envío y cobertura geográfica son responsabilidad exclusiva del Vendedor y de las empresas de mensajería contratadas.',
      'Glopsy no asume responsabilidad alguna por retrasos, pérdidas o daños ocasionados durante el transporte, salvo disposición legal que expresamente lo establezca.',
    ],
  },
  {
    icon: RotateCcw,
    title: '4. Devoluciones y garantías',
    body: [
      'Las garantías legales previstas en la Ley 1480 de 2011 serán atendidas por el Vendedor responsable del producto.',
      'Las políticas de devolución, cambio o reembolso de cada tienda son independientes y deben ser aceptadas por el Comprador al momento de realizar la compra.',
      'Glopsy solo facilitará la gestión de solicitudes entre las partes y no decide sobre la procedencia de las mismas.',
    ],
  },
  {
    icon: CreditCard,
    title: '5. Pagos y transacciones',
    body: [
      'Los pagos se procesan a través de pasarelas de pago autorizadas por las autoridades colombianas (como Mercado Pago) bajo sus propios términos.',
      'Glopsy no almacena, procesa ni tiene acceso a los datos de tarjetas de crédito, débito ni credenciales bancarias de los usuarios.',
      'La liberación de fondos al Vendedor está sujeta a la confirmación del pedido por parte de la plataforma y a las políticas de la pasarela de pago.',
    ],
  },
  {
    icon: Lock,
    title: '6. Protección de datos personales',
    body: [
      'El tratamiento de datos personales se rige por la Ley 1581 de 2012 y el Decreto 1377 de 2013.',
      'Al registrarte, autorizas el tratamiento de tus datos personales de conformidad con nuestra Política de Privacidad para la prestación del servicio.',
      'Los datos compartidos con Vendedores y transportadoras son exclusivamente los necesarios para procesar y entregar tu pedido.',
    ],
  },
  {
    icon: Scale,
    title: '7. Ley aplicable y jurisdicción',
    body: [
      'Estos términos se rigen por las leyes de la República de Colombia.',
      'Cualquier controversia será sometida a la jurisdicción ordinaria de Colombia, de acuerdo con las normas de competencia aplicables.',
      'En todo caso se dará aplicación a los mecanismos de protección al consumidor consagrados en la Ley 1480 de 2011.',
    ],
  },
  {
    icon: CircleHelp,
    title: '8. Contacto',
    body: [
      'Si tienes inquietudes sobre estos términos, escríbenos al correo de soporte indicado en la aplicación.',
    ],
  },
];

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
          Última actualización: 24 de agosto de 2026
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
