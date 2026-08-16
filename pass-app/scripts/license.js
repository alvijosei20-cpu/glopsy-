#!/usr/bin/env node
/**
 * Genera un código de activación para un Device ID de Pass.
 * Uso: node scripts/license.js <DEVICE_ID>
 * El Device ID lo muestra la app en la pantalla de registro.
 */
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';

const LICENSE_SECRET = 'pass:v1:license:7f3c9a';
const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32, sin ambiguos

function encodeBase32(bytes) {
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
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function generateCode(deviceId) {
  const enc = new TextEncoder();
  const mac = hmac(sha256, enc.encode(LICENSE_SECRET), enc.encode(`pass-license:${deviceId}`));
  return encodeBase32(mac.slice(0, 10));
}

const id = (process.argv[2] || '').trim();
if (!id) {
  console.error('Uso: node scripts/license.js <DEVICE_ID>');
  process.exit(1);
}

const code = generateCode(id);
const pretty = (code.match(/.{1,4}/g) || []).join('-');
console.log(`Device ID: ${id}`);
console.log(`Código de activación: ${pretty}`);
