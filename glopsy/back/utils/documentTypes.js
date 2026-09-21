// Tipos de documento del titular de la cuenta, según el país donde opera la tienda.
// Fuente de verdad del backend; el frontend mantiene un espejo en
// frontend/src/utils/documentTypes.js (mantener en sincronía).
export const DOCUMENT_TYPES_BY_COUNTRY = {
  CO: [
    { code: 'CC', label: 'Cédula de ciudadanía' },
    { code: 'CE', label: 'Cédula de extranjería' },
    { code: 'NIT', label: 'NIT' },
    { code: 'PA', label: 'Pasaporte' },
    { code: 'TI', label: 'Tarjeta de identidad' },
    { code: 'PPT', label: 'Permiso por Protección Temporal (PPT)' },
  ],
  VE: [
    { code: 'V', label: 'Cédula de identidad (V)' },
    { code: 'E', label: 'Cédula de extranjero (E)' },
    { code: 'J', label: 'RIF persona jurídica (J)' },
    { code: 'P', label: 'Pasaporte (P)' },
    { code: 'G', label: 'RIF gubernamental (G)' },
  ],
};

export const DEFAULT_DOCUMENT_TYPES = [
  { code: 'ID', label: 'Documento de identidad' },
  { code: 'PA', label: 'Pasaporte' },
  { code: 'NIT', label: 'Identificación tributaria' },
];

export const getDocumentTypesForCountry = (iso) => {
  const key = String(iso || '').trim().toUpperCase();
  return DOCUMENT_TYPES_BY_COUNTRY[key] || DEFAULT_DOCUMENT_TYPES;
};

export const isValidDocumentType = (iso, code) => {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return false;
  return getDocumentTypesForCountry(iso).some((d) => d.code === clean);
};
