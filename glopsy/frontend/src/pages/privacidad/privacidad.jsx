import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Database, Target, FileCheck2, UserCheck, Mail, Share2, Cookie, Lock, Clock, Users, Globe, FileWarning } from 'lucide-react';
import { useSEO } from '../../utils/seo';

const SECTIONS = [
  {
    icon: ShieldCheck,
    title: '1. Responsable del tratamiento',
    body: [
      'El responsable del tratamiento de los datos personales recopilados a través de Glopsy® es Nodux Technology, sociedad identificada como operadora de la plataforma.',
      'Para efectos de esta Política, los términos "nosotros", "nuestro" y "Glopsy" se refieren al responsable del tratamiento.',
      'El tratamiento de tus datos se realiza en el territorio de la República de Colombia y se rige por la Ley 1581 de 2012, el Decreto 1377 de 2013, el Decreto 886 de 2014 y las demás normas que los modifiquen, reglamenten o sustituyan, así como por las directrices impartidas por la Superintendencia de Industria y Comercio (SIC).',
    ],
  },
  {
    icon: Database,
    title: '2. Datos personales que recopilamos',
    body: [
      'Datos de identificación y contacto: nombre, documento de identificación, correo electrónico, número de teléfono y dirección de envío.',
      'Datos de ubicación: ciudad y región desde la cual navegas o realizas pedidos, obtenidos con tu autorización para calcular envíos y tiempos de entrega.',
      'Datos de transacción: historial de compras, pedidos, devoluciones, preferencias de pago y datos de la tienda de los vendedores.',
      'Datos técnicos y de navegación: dirección IP, tipo de dispositivo, sistema operativo, navegador y páginas visitadas, obtenidos a través de tecnologías de seguimiento.',
      'Datos biométricos: verificación de identidad mediante huella dactilar u otro mecanismo biométrico cuando el dispositivo lo permita, únicamente con tu consentimiento previo y expreso.',
    ],
  },
  {
    icon: Target,
    title: '3. Finalidad del tratamiento',
    body: [
      'Crear, gestionar y operar tu cuenta de usuario en Glopsy, así como autenticarte de forma segura.',
      'Procesar tus pedidos y compras, gestionar pagos a través de pasarelas autorizadas, coordinar la entrega y atender devoluciones o garantías.',
      'Comunicarnos contigo para informarte sobre el estado de tus compras, envíos y cambios relevantes del servicio.',
      'Mejorar la experiencia de compra, personalizar contenido, prevenir el fraude y cumplir obligaciones legales, fiscales y de seguridad.',
      'Enviarte comunicaciones comerciales y promocionales únicamente cuando hayas otorgado tu consentimiento previo, expreso e informado. Podrás revocarlo en cualquier momento.',
    ],
  },
  {
    icon: FileCheck2,
    title: '4. Base legal y consentimiento',
    body: [
      'El tratamiento de tus datos personales se fundamenta en tu consentimiento previo, expreso e informado, conforme al artículo 9 de la Ley 1581 de 2012.',
      'Al registrarte y aceptar esta Política de Privacidad, otorgas tu autorización para el tratamiento de tus datos con las finalidades aquí descritas.',
      'Podrás revocar tu autorización o solicitar la supresión de tus datos en cualquier momento, sin carácter retroactivo, a través del canal indicado en esta Política.',
      'Cuando la autorización sea revocada o los datos se supriman, conservaremos la información únicamente en la medida en que la ley nos lo exija.',
    ],
  },
  {
    icon: UserCheck,
    title: '5. Derechos de los titulares',
    body: [
      'En virtud del artículo 8 de la Ley 1581 de 2012, tienes derecho a: conocer, actualizar y rectificar tus datos personales frente a Glopsy.',
      'Solicitar prueba de la autorización otorgada y que se te informe cuáles datos han sido tratados y bajo qué finalidad.',
      'Solicitar la supresión de tus datos cuando su tratamiento no cumpla con la ley o se haya revocado la autorización.',
      'Presentar reclamos ante el responsable por el uso indebido de tus datos y, de ser el caso, revocar la autorización.',
      'Acceder en forma gratuita a tus datos personales que hayan sido objeto de tratamiento.',
    ],
  },
  {
    icon: Mail,
    title: '6. Cómo ejercer tus derechos',
    body: [
      'Para ejercer tus derechos como titular podrás contactarnos al correo electrónico soporte@glopsy.com indicando tu nombre, documento de identificación, el derecho que deseas ejercer y los motivos de tu solicitud.',
      'Toda solicitud será respondida en un término máximo de quince (15) días hábiles, contados desde la fecha de su recibo. Cuando no sea posible atenderla en dicho término, se te informará el motivo de la demora y la fecha en que se dará respuesta, la cual no podrá superar los ocho (8) días hábiles adicionales.',
      'En caso de que consideres que tus derechos han sido vulnerados, podrás interponer una queja ante la Superintendencia de Industria y Comercio (SIC), autoridad nacional encargada de la protección de datos personales en Colombia.',
    ],
  },
  {
    icon: Share2,
    title: '7. Transferencia y destinación de datos a terceros',
    body: [
      'Los datos personales podrán ser compartidos con Vendedores independientes, empresas de transporte y mensajería, y pasarelas de pago autorizadas, exclusivamente en la medida necesaria para procesar, pagar y entregar tus pedidos.',
      'Glopsy no vende, alquila ni comercializa tus datos personales con terceros con fines no relacionados con la prestación del servicio.',
      'Las transferencias internacionales de datos se realizarán únicamente cuando sean necesarias para el servicio y bajo los mecanismos de protección exigidos por el Decreto 1377 de 2013, garantizando niveles adecuados de seguridad.',
    ],
  },
  {
    icon: Cookie,
    title: '8. Cookies y tecnologías de seguimiento',
    body: [
      'Utilizamos cookies y tecnologías similares para recordar tus preferencias, mantener tu sesión activa y medir el rendimiento de la plataforma.',
      'Puedes configurar tu navegador para rechazar o eliminar cookies en cualquier momento; sin embargo, algunas funciones de la plataforma podrían no operar correctamente.',
      'Las cookies de terceros (por ejemplo, de análisis o publicidad) se encuentran sujetas a sus propias políticas de privacidad.',
    ],
  },
  {
    icon: Users,
    title: '9. Datos de menores de edad',
    body: [
      'La plataforma está dirigida a mayores de dieciocho (18) años. No recopilamos a sabiendas datos personales de menores de edad.',
      'De conformidad con la Ley 1581 de 2012 y su reglamentación, el tratamiento de datos de menores de edad requiere la autorización previa de sus representantes legales, y se limita a los datos que garanticen la protección del menor.',
      'Si tienes conocimiento de que un menor ha proporcionado datos personales sin autorización, contáctanos para proceder a su eliminación.',
    ],
  },
  {
    icon: Lock,
    title: '10. Seguridad de la información',
    body: [
      'Hemos adoptado medidas técnicas, humanas y administrativas razonables para proteger tus datos personales contra pérdida, uso indebido, acceso no autorizado y divulgación, conforme a la Ley 1581 de 2012.',
      'Las transacciones se procesan a través de pasarelas de pago autorizadas que cumplen los estándares de seguridad exigidos. Glopsy no almacena los datos de tu tarjeta de crédito o débito.',
      'En caso de una vulneración de la seguridad que comprometa tus datos, te informaremos de manera oportuna y reportaremos el incidente ante la Superintendencia de Industria y Comercio, de conformidad con la normativa aplicable.',
    ],
  },
  {
    icon: Clock,
    title: '11. Conservación de los datos',
    body: [
      'Conservamos tus datos personales únicamente durante el tiempo necesario para cumplir las finalidades descritas, atender obligaciones legales, fiscales y contables, y resolver controversias.',
      'Una vez cumplidas las finalidades, los datos serán suprimidos o anonimizados de manera segura, salvo que la ley exija su conservación.',
    ],
  },
  {
    icon: Globe,
    title: '12. Cambios a esta Política',
    body: [
      'Podremos actualizar esta Política de Privacidad en cualquier momento. Los cambios entrarán en vigor al momento de su publicación en la plataforma.',
      'Cuando se realicen cambios sustanciales, te informaremos a través de la aplicación o por el correo electrónico registrado antes de que entren en vigencia.',
      'El uso continuado de la plataforma después de la publicación de los cambios constituirá la aceptación de la Política actualizada.',
    ],
  },
  {
    icon: FileWarning,
    title: '13. Contacto y autoridad de control',
    body: [
      'Si tienes inquietudes, solicitudes o reclamos relacionados con el tratamiento de tus datos personales, escríbenos a soporte@glopsy.com.',
      'La autoridad de control en materia de protección de datos personales en Colombia es la Superintendencia de Industria y Comercio (SIC), a la cual podrás acudir en caso de no obtener respuesta satisfactoria.',
    ],
  },
];

export default function Privacidad() {
  useSEO({
    title: 'Política de Privacidad',
    description:
      'Política de privacidad de Glopsy, conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013. Conoce cómo tratamos tus datos personales y cómo ejercer tus derechos.',
    path: '/privacidad',
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
            Política de Privacidad
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
          Última actualización: 27 de agosto de 2026
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-8 max-w-2xl">
          Esta política regula el tratamiento de los datos personales de los usuarios de la plataforma
          Glopsy®, operada por Nodux Technology, en cumplimiento de la Ley 1581 de 2012 y el Decreto
          1377 de 2013.
        </p>

        <div className="rounded-2xl border border-fuchsia-200/70 dark:border-fuchsia-900/40 bg-fuchsia-50 dark:bg-fuchsia-950/30 p-4 mb-8 text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex gap-2.5">
          <FileWarning size={16} className="text-fuchsia-600 shrink-0 mt-0.5" />
          <p>
            <b>Advertencia:</b> Al registrarte y utilizar Glopsy, otorgas tu autorización previa, expresa e
            informada para el tratamiento de tus datos personales conforme a esta Política. Tienes derecho a
            conocer, actualizar, rectificar y suprimir tus datos, así como a revocar tu autorización.
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
