// Reglas de campos que dependen del país donde opera la tienda: tipos de
// documento, formato del número de documento y del teléfono.
// Espejo de glopsy/back/utils/countryFields.js (mantener en sincronía).

const CO_DOCS = [
  { code: 'CC', label: 'Cédula de ciudadanía', pattern: /^\d{6,12}$/, hint: '6 a 12 dígitos' },
  { code: 'CE', label: 'Cédula de extranjería', pattern: /^\d{6,12}$/, hint: '6 a 12 dígitos' },
  { code: 'NIT', label: 'NIT', pattern: /^\d{9,15}$/, hint: '9 a 15 dígitos (sin guion)' },
  { code: 'PA', label: 'Pasaporte', pattern: /^[A-Za-z0-9]{6,20}$/, hint: '6 a 20 caracteres' },
  { code: 'TI', label: 'Tarjeta de identidad', pattern: /^\d{6,12}$/, hint: '6 a 12 dígitos' },
  { code: 'PPT', label: 'Permiso por Protección Temporal (PPT)', pattern: /^[A-Za-z0-9]{6,20}$/, hint: '6 a 20 caracteres' },
];

const VE_DOCS = [
  { code: 'V', label: 'Cédula de identidad (V)', pattern: /^\d{6,9}$/, hint: '6 a 9 dígitos' },
  { code: 'E', label: 'Cédula de extranjero (E)', pattern: /^\d{6,9}$/, hint: '6 a 9 dígitos' },
  { code: 'J', label: 'RIF persona jurídica (J)', pattern: /^\d{8,10}$/, hint: '8 a 10 dígitos' },
  { code: 'P', label: 'Pasaporte (P)', pattern: /^[A-Za-z0-9]{6,20}$/, hint: '6 a 20 caracteres' },
  { code: 'G', label: 'RIF gubernamental (G)', pattern: /^\d{8,10}$/, hint: '8 a 10 dígitos' },
];

const DEFAULT_DOCS = [
  { code: 'ID', label: 'Documento de identidad', pattern: /^[A-Za-z0-9-]{4,40}$/, hint: '4 a 40 caracteres' },
  { code: 'PA', label: 'Pasaporte', pattern: /^[A-Za-z0-9]{6,20}$/, hint: '6 a 20 caracteres' },
  { code: 'NIT', label: 'Identificación tributaria', pattern: /^[A-Za-z0-9-]{4,40}$/, hint: '4 a 40 caracteres' },
];

export const COUNTRY_FIELDS = {
  CO: {
    documentTypes: CO_DOCS,
    phone: { dialCode: '+57', min: 10, max: 10, example: '3001234567', hint: '10 dígitos' },
  },
  VE: {
    documentTypes: VE_DOCS,
    phone: { dialCode: '+58', min: 10, max: 11, example: '4121234567', hint: '10 a 11 dígitos' },
  },
};

export const DEFAULT_COUNTRY_FIELDS = {
  documentTypes: DEFAULT_DOCS,
  phone: { dialCode: '+', min: 7, max: 15, example: '123456789', hint: '7 a 15 dígitos' },
};

export const getCountryFields = (iso) =>
  COUNTRY_FIELDS[String(iso || '').trim().toUpperCase()] || DEFAULT_COUNTRY_FIELDS;

export const getDocumentTypesForCountry = (iso) => getCountryFields(iso).documentTypes;

export const getDocumentType = (iso, code) =>
  getDocumentTypesForCountry(iso).find((d) => d.code === String(code || '').trim().toUpperCase()) || null;

export const isValidDocumentType = (iso, code) => Boolean(getDocumentType(iso, code));

export const isValidDocumentNumber = (iso, code, value) => {
  const doc = getDocumentType(iso, code);
  if (!doc) return false;
  return doc.pattern.test(String(value || '').trim());
};

export const getPhoneConfigForCountry = (iso) => getCountryFields(iso).phone;

export const isValidPhoneForCountry = (iso, value) => {
  const digits = String(value || '').replace(/\D/g, '');
  const cfg = getPhoneConfigForCountry(iso);
  return digits.length >= cfg.min && digits.length <= cfg.max;
};

export const normalizePhone = (iso, value) => {
  if (!isValidPhoneForCountry(iso, value)) return null;
  const digits = String(value || '').replace(/\D/g, '');
  return `${getPhoneConfigForCountry(iso).dialCode}${digits}`;
};

export const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
