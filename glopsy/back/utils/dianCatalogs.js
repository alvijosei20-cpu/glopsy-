// ==========================================
// Catálogos oficiales DIAN para factura electrónica
// Fuente: Anexo Técnico FE v1.9 (catálogos de tipo de
// documento, identificación, tributos, medios de pago, etc.)
// ==========================================

export const TIPOS_DOCUMENTO = {
  '01': 'Factura electrónica de venta',
  '02': 'Factura electrónica de venta con exportación',
  '03': 'Factura electrónica de venta con mandato',
};

export const TIPOS_IDENTIFICACION = {
  11: 'Registro civil',
  12: 'Tarjeta de identidad',
  13: 'Cédula de ciudadanía',
  21: 'Tarjeta de extranjería',
  22: 'Cédula de extranjería',
  31: 'NIT',
  41: 'Pasaporte',
  42: 'Documento de identificación extranjero',
  47: 'PEP',
  48: 'PPT',
  50: 'NIT otro país',
  91: 'NUIP',
};

// Régimen (RUT): responsable / no responsable de IVA
export const REGIMENES = {
  48: 'Responsable de IVA',
  49: 'No responsable de IVA',
};

// Responsabilidad fiscal (RUT)
export const RESPONSABILIDADES = {
  'O-13': 'Gran contribuyente',
  'O-15': 'Autorretenedor',
  'O-23': 'Agente de retención IVA',
  'O-47': 'Régimen simple de tributación',
  'R-99-PN': 'No responsable',
};

export const FORMAS_PAGO = {
  1: 'Contado',
  2: 'Crédito',
};

// Medio de pago (cbc:PaymentMeansCode / catálogo DIAN de FE)
export const MEDIOS_PAGO = {
  10: 'Efectivo',
  20: 'Cheque',
  42: 'Consignación bancaria',
  45: 'Transferencia crédito bancario',
  46: 'Transferencia débito interbancario',
  47: 'Transferencia débito/crédito',
  48: 'Tarjeta crédito',
  49: 'Tarjeta débito',
};

export const TIPOS_IMPUESTO = {
  '01': 'IVA',
  '04': 'INC',
};

// UN/ECE Recommendation 20 + "WSD" (estándar). Lista abierta: se valida
// contra este set pero se documenta que la DIAN acepta todo el estándar.
export const UNIDADES_MEDIDA = {
  94: 'Unidad',
  WSD: 'Estándar',
};

export const TIPOS_IDENTIFICACION_PERSONA_NATURAL = ['11', '12', '13', '21', '22', '41', '42', '47', '48', '91'];
export const TIPOS_IDENTIFICACION_NIT = ['31', '50'];

export const isNit = (tipoIdentificacion) => TIPOS_IDENTIFICACION_NIT.includes(String(tipoIdentificacion));

export const codigoValido = (catalogo, codigo) =>
  codigo !== undefined && codigo !== null && Object.prototype.hasOwnProperty.call(catalogo, String(codigo));

export const descripcionCodigo = (catalogo, codigo) =>
  codigoValido(catalogo, codigo) ? catalogo[String(codigo)] : null;

// Código de consumidor final usado por la DIAN como adquiriente por defecto.
export const CONSUMIDOR_FINAL = {
  TipoIdentificacion: '13',
  NumeroIdentificacion: '222222222222',
  NombreCompleto: 'CONSUMIDOR FINAL',
  RegimenFiscal: '49',
  ResponsabilidadFiscal: 'R-99-PN',
};
