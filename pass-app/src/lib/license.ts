import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';

// Secreto compartido para firmar códigos de licencia.
// Vive en el APK por diseño (validación offline); un atacante con el APK
// podría generar códigos, pero solo para su propio deviceId.
export const LICENSE_SECRET = 'pass:v1:license:7f3c9a';

const enc = new TextEncoder();
// 32 caracteres, sin ambiguos (0/O/1/I/L)
const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const LICENSE_LENGTH = 16; // caracteres base32 (80 bits)

export function normalizeLicenseCode(input: string): string {
  return (input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatLicenseCode(code: string): string {
  const clean = normalizeLicenseCode(code);
  const groups = clean.match(/.{1,4}/g) || [];
  return groups.join('-');
}

export function isValidLicenseFormat(code: string): boolean {
  return normalizeLicenseCode(code).length === LICENSE_LENGTH;
}

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1; // conserva solo los bits sobrantes (<5)
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

/** Genera un código de licencia válido solo para `deviceId`. */
export function generateLicenseCode(deviceId: string): string {
  const mac = hmac(sha256, enc.encode(LICENSE_SECRET), enc.encode(`pass-license:${deviceId}`));
  return encodeBase32(mac.slice(0, 10));
}

/** Verifica localmente que `code` sea válido para `deviceId` (comparación en tiempo constante). */
export function verifyLicenseCode(deviceId: string, code: string): boolean {
  const expected = generateLicenseCode(deviceId);
  const actual = normalizeLicenseCode(code);
  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  return diff === 0;
}
