// Fuente única de los Términos y Condiciones y del Contrato de Mandato.
// Se usa en la página /terminos y en el modal de aceptación al crear tienda.
// Al cambiar el contenido, actualizar TERMS_VERSION (queda registrada en la DB).
export const TERMS_VERSION = '2026-10-01';
export const PRIVACY_VERSION = '2026-10-01';

// Identificación del proveedor (Ley 1480 de 2011, art. 50; Decreto 1074 de 2015,
// art. 2.2.2.53.1). Glopsy es operado por Nodux Technology.
export const PROVIDER = {
  legalName: 'Nodux Technology',
  nit: '700351291',
  email: 'soporte@glopsy.com',
  country: 'Colombia',
};

export const TERMS_SECTIONS = [
  {
    title: '1. Naturaleza del servicio',
    body: [
      'Glopsy es una plataforma tecnológica de intermediación que facilita el comercio bajo el modelo de dropshipping. Glopsy NO fabrica, almacena, ni posee físicamente los productos publicados.',
      'Los vendedores independientes ("Vendedores") son los responsables directos de la calidad, autenticidad, disponibilidad, estado y entrega de los productos que publican.',
      'Al utilizar Glopsy, aceptas que la plataforma actúa únicamente como un servicio de intermediación y conectividad entre compradores y vendedores.',
    ],
  },
  {
    title: '2. Contrato de Mandato (Vendedores)',
    body: [
      'Al publicar un producto en Glopsy, el Vendedor otorga a Nodux Technology (operadora de Glopsy) un mandato comercial de carácter oneroso, regido por los artículos 1262 y siguientes del Código de Comercio colombiano, para que actúe en su nombre y por su cuenta en la publicación, promoción, gestión de pagos y coordinación logística de los bienes ofertados.',
      'El presente mandato no transfiere la propiedad de los productos, los cuales permanecen en cabeza del Vendedor, quien asume íntegramente los riesgos y responsabilidades derivados de su comercialización.',
      'Obligaciones del mandatario (Glopsy): publicar la información suministrada por el Vendedor, procesar los pagos a través de pasarelas autorizadas, coordinar la logística de entrega, rendir cuentas de las ventas realizadas y transferir los recaudos conforme a las políticas de la plataforma, sin modificar unilateralmente los precios autorizados.',
      'Obligaciones del mandante (Vendedor): garantizar la veracidad, legalidad y calidad de la información y de los productos publicados; cumplir el Estatuto del Consumidor (Ley 1480 de 2011); atender las garantías, devoluciones y reclamaciones; acreditar registro mercantil y RUT cuando la actividad lo exija; y dar cumplimiento a la Ley 1581 de 2012 en el tratamiento de datos personales.',
      'El Vendedor declara que el producto que publica es lícito, no se encuentra prohibido por la normativa colombiana y no vulnera derechos de propiedad intelectual de terceros.',
      'El mandato podrá darse por terminado por mutuo acuerdo o por revocatoria de cualquiera de las partes, sin perjuicio de los pedidos que se encuentren en curso al momento de la terminación.',
      'Este contrato de mandato se rige por la legislación de la República de Colombia, incluida la Ley 527 de 1999 sobre comercio electrónico, el Decreto 1074 de 2015 y las normas que las modifiquen o sustituyan.',
    ],
  },
  {
    title: '3. Limitación de responsabilidad',
    body: [
      'En virtud de lo dispuesto en el artículo 16 de la Ley 1480 de 2011 (Estatuto del Consumidor) y demás normas concordantes, la responsabilidad sobre los bienes ofertados corresponde directamente al Vendedor.',
      'Glopsy no responde por vicios ocultos, defectos de calidad, incumplimiento en la entrega, diferencias en el producto recibido, ni por cualquier daño derivado de la relación entre el Comprador y el Vendedor.',
      'Glopsy se limita a prestar el servicio de conectividad, gestión de pagos a través de pasarelas de pago autorizadas y coordinación logística. No es parte de la relación contractual de compraventa entre Comprador y Vendedor.',
    ],
  },
  {
    title: '4. Envíos y entrega',
    body: [
      'El envío de los productos es coordinado directamente entre el Vendedor y el Comprador a través de transportadoras y mensajerías de terceros.',
      'Los tiempos de entrega, costos de envío y cobertura geográfica son responsabilidad exclusiva del Vendedor y de las empresas de mensajería contratadas.',
      'Glopsy no asume responsabilidad alguna por retrasos, pérdidas o daños ocasionados durante el transporte, salvo disposición legal que expresamente lo establezca.',
    ],
  },
  {
    title: '5. Devoluciones, garantías y derecho de retracto',
    body: [
      'Las garantías legales previstas en la Ley 1480 de 2011 serán atendidas por el Vendedor responsable del producto.',
      'Derecho de retracto (artículo 47 de la Ley 1480 de 2011): en las ventas realizadas por medios electrónicos, el Comprador podrá retractarse de la compra dentro de los cinco (5) días hábiles siguientes a la entrega del producto, sin necesidad de justificar su decisión, siempre que el bien se encuentre en las mismas condiciones en que lo recibió.',
      'Para ejercer el retracto, el Comprador deberá solicitarlo desde la sección "Compras" de la plataforma, indicando el pedido y los productos, dentro del término legal. Glopsy y el Vendedor coordinarán la devolución del bien y el reembolso de la totalidad del dinero pagado por el Comprador.',
      'En los casos de retracto, los costos de transporte y demás gastos de logística que implique la devolución estarán a cargo del Comprador, conforme al parágrafo del artículo 47 de la Ley 1480 de 2011, salvo cuando el bien presente defectos o no corresponda a lo ofrecido.',
      'No procede el retracto en los eventos excluidos por la ley (por ejemplo, bienes perecederos, personalizados o abiertos por razones de higiene, entre otros).',
      'Las políticas de devolución, cambio o reembolso de cada tienda son independientes y deben ser aceptadas por el Comprador al momento de realizar la compra.',
      'Glopsy solo facilitará la gestión de solicitudes entre las partes y no decide sobre la procedencia de las mismas.',
    ],
  },
  {
    title: '6. Pagos y transacciones',
    body: [
      'Los pagos se procesan a través de pasarelas de pago autorizadas por las autoridades colombianas (como Mercado Pago) bajo sus propios términos.',
      'Glopsy no almacena, procesa ni tiene acceso a los datos de tarjetas de crédito, débito ni credenciales bancarias de los usuarios.',
      'La liberación de fondos al Vendedor está sujeta a la confirmación del pedido por parte de la plataforma y a las políticas de la pasarela de pago.',
    ],
  },
  {
    title: '7. Protección de datos personales',
    body: [
      'El tratamiento de datos personales se rige por la Ley 1581 de 2012 y el Decreto 1377 de 2013.',
      'Al registrarte, autorizas el tratamiento de tus datos personales de conformidad con nuestra Política de Privacidad para la prestación del servicio.',
      'Los datos compartidos con Vendedores y transportadoras son exclusivamente los necesarios para procesar y entregar tu pedido.',
    ],
  },
  {
    title: '8. Ley aplicable y jurisdicción',
    body: [
      'Estos términos se rigen por las leyes de la República de Colombia.',
      'Cualquier controversia será sometida a la jurisdicción ordinaria de Colombia, de acuerdo con las normas de competencia aplicables.',
      'En todo caso se dará aplicación a los mecanismos de protección al consumidor consagrados en la Ley 1480 de 2011.',
      'Operación internacional: Glopsy opera comercialmente en Colombia y Venezuela. Cuando el Comprador o el Vendedor se encuentre en Venezuela, se aplicará además la normativa venezolana aplicable, sin perjuicio de los derechos que esta plataforma reconoce a todos sus usuarios.',
      'Comercio electrónico (Venezuela): conforme a la Ley sobre Mensajes de Datos y Firmas Electrónicas (2001), los mensajes de datos y las firmas electrónicas utilizados en la plataforma tienen la misma validez y eficacia probatoria que los documentos y las firmas manuscritas.',
      'Protección al consumidor (Venezuela): los derechos de los usuarios en Venezuela se reconocen conforme a la Ley Orgánica de Precios Justos y demás normativa de protección al consumidor y al usuario, cuya autoridad de aplicación es la Superintendencia Nacional para la Defensa de los Derechos Socioeconómicos (SUNDDE). Se garantizan la exhibición del precio, así como las garantías, devoluciones y el derecho de retracto previstos en estos Términos.',
      'Datos personales (Venezuela): sin perjuicio de la Ley 1581 de 2012, los titulares en Venezuela podrán ejercer los derechos de acceso, rectificación, actualización y supresión de sus datos (habeas data) conforme al artículo 28 de la Constitución de la República Bolivariana de Venezuela, a través de los canales indicados en la Política de Privacidad.',
      'Transferencias internacionales: cuando el servicio implique el tratamiento o la transferencia de datos personales fuera de Colombia, se realizará únicamente cuando sea necesario para la prestación del servicio y bajo los mecanismos de protección y niveles de seguridad exigidos por la normativa aplicable, conforme a la Política de Privacidad.',
    ],
  },
  {
    title: '9. Identificación del proveedor y contacto',
    body: [
      'La plataforma Glopsy® es operada por Nodux Technology, identificada con NIT 700351291.',
      'Domicilio: Colombia. Canal de atención al cliente: correo electrónico soporte@glopsy.com y la sección de soporte dentro de la aplicación.',
      'Si tienes inquietudes sobre estos términos, escríbenos al correo de soporte indicado.',
    ],
  },
];
