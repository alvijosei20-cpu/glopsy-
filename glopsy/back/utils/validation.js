// ==========================================
// Validación y limpieza central de inputs
// ==========================================

const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

const stripDangerous = (input) => String(input)
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<\s*\/?\s*(script|style)\s*>/gi, '')
  .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  .replace(/<(img|iframe|object|embed|form|link|meta)\b[^>]*>/gi, '')
  .replace(/\bjavascript\s*:\s*/gi, '');

export const cleanString = (value, { maxLength = 255, trim = true, allowNewlines = false, allowTags = false } = {}) => {
  if (value === undefined || value === null) return value;
  let str = String(value);
  if (trim) str = str.trim();
  str = str.replace(CONTROL_CHARS, '');
  if (!allowTags) str = stripDangerous(str);
  if (!allowNewlines) str = str.replace(/[\r\n\t]+/g, ' ');
  if (str.length > maxLength) str = str.slice(0, maxLength);
  return str;
};

export const cleanText = (value, { maxLength = 5000, ...opts } = {}) =>
  cleanString(value, { maxLength, allowNewlines: true, ...opts });

export const cleanNullableString = (value, opts = {}) => {
  const cleaned = cleanString(value, opts);
  return cleaned === '' ? null : cleaned;
};

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());

export const cleanEmail = (value, { required = false } = {}) => {
  if (value === undefined || value === null) return required ? null : undefined;
  const str = cleanString(value, { maxLength: 254 }).toLowerCase();
  if (!str) return required ? null : '';
  return isEmail(str) ? str : null;
};

export const cleanPhone = (value, { maxLength = 20 } = {}) => {
  if (value === undefined || value === null) return value;
  return cleanString(value, { maxLength }).replace(/[^\d+\s()-]/g, '');
};

export const isColombianMobile = (value) => /^3\d{9}$/.test(String(value || '').replace(/[^\d]/g, ''));

export const toInt = (value, { min, max, fallback = null } = {}) => {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const int = Math.trunc(n);
  if (min !== undefined && int < min) return fallback;
  if (max !== undefined && int > max) return fallback;
  return int;
};

export const toNumber = (value, { min, max, fallback = null } = {}) => {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (min !== undefined && n < min) return fallback;
  if (max !== undefined && n > max) return fallback;
  return n;
};

export const cleanBoolean = (value, fallback = null) => {
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  if (value === false || value === 'false' || value === '0' || value === 0) return false;
  return fallback;
};

export const cleanUrl = (value, { maxLength = 2048, fallback = null } = {}) => {
  const str = cleanString(value, { maxLength });
  if (!str) return fallback;
  try {
    const url = new URL(str);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback;
    return url.toString().slice(0, maxLength);
  } catch {
    return fallback;
  }
};

export const isValidDateString = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!m) return false;
  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return dt.getUTCFullYear() === Number(y) && dt.getUTCMonth() === Number(mo) - 1 && dt.getUTCDate() === Number(d);
};

export const cleanDate = (value, { fallback = null } = {}) => {
  if (!value) return fallback;
  return isValidDateString(value) ? String(value).trim() : fallback;
};

export const sanitizeArray = (value, fn, { maxLength = 500 } = {}) => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxLength).map(fn).filter((v) => v !== null && v !== undefined && v !== '');
};

export const sanitizeObject = (value, { maxSize = 100 } = {}) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const out = {};
  for (const key of Object.keys(value).slice(0, maxSize)) {
    const val = value[key];
    if (typeof val === 'string') {
      out[key] = cleanText(val, { maxLength: 5000 });
    } else if (Array.isArray(val)) {
      out[key] = val.slice(0, 100).map((v) => sanitizeObject(v, { maxSize }));
    } else if (val && typeof val === 'object') {
      out[key] = sanitizeObject(val, { maxSize });
    } else {
      out[key] = val;
    }
  }
  return out;
};

export const isAllowedEnum = (value, allowed) => Array.isArray(allowed) && allowed.includes(value);
