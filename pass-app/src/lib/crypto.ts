import { gcm } from '@noble/ciphers/aes.js';
import * as ExpoCrypto from 'expo-crypto';
import { NativeModules } from 'react-native';
import { fromByteArray, toByteArray } from 'base64-js';
import { deriveKeyAsync } from './pbkdf2';
import { Argon2Params } from '../types';
import { t } from '../i18n';

export const LEGACY_ITERATIONS = 200000;
export const DEFAULT_ITERATIONS = 600000;
export const ARGON2_PARAMS: Argon2Params = { m: 65536, t: 3, p: 1 };
const ARGON2_HASH_LEN = 32;

let _argon2: ((password: string, salt: string, options: any) => Promise<{ rawHash: string }>) | null | undefined;

async function getArgon2(): Promise<((password: string, salt: string, options: any) => Promise<{ rawHash: string }>) | null> {
  if (_argon2 !== undefined) return _argon2;
  const fn = NativeModules.RNArgon2?.argon2 ?? null;
  _argon2 = fn;
  return fn;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function canUseArgon2(): Promise<boolean> {
  try {
    const fn = await getArgon2();
    if (!fn) return false;
    await fn('test-pin', 'c2FsdC1wcm9iYTM2', { memory: 8192, iterations: 1, parallelism: 1, hashLength: 8, mode: 'argon2id' });
    return true;
  } catch {
    return false;
  }
}

export interface PinKeyOptions {
  kdf?: 'argon2id' | 'pbkdf2';
  iterations?: number;
  params?: Argon2Params;
}

export async function derivePinKey(pin: string, saltB64: string, opts: PinKeyOptions = {}, onProgress?: (pct: number) => void): Promise<Uint8Array> {
  if (opts.kdf === 'argon2id') {
    const fn = await getArgon2();
    if (!fn) throw new Error(t('crypto.noArgon2'));
    const params = opts.params || ARGON2_PARAMS;
    const res = await fn(pin, saltB64, {
      memory: params.m,
      iterations: params.t,
      parallelism: params.p,
      hashLength: ARGON2_HASH_LEN,
      mode: 'argon2id',
    });
    return hexToBytes(res.rawHash);
  }
  return deriveKey(pin, saltB64, onProgress, opts.iterations ?? LEGACY_ITERATIONS);
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64(buf: Uint8Array): string {
  return fromByteArray(buf);
}

export function unb64(str: string): Uint8Array {
  return toByteArray(str);
}

export function randomBytes(n: number): Uint8Array {
  return ExpoCrypto.getRandomValues(new Uint8Array(n));
}

export function randomSalt(): string {
  return b64(randomBytes(16));
}

export function uid(): string {
  const buf = randomBytes(6);
  let s = '';
  for (let i = 0; i < 6; i++) s += buf[i].toString(16).padStart(2, '0');
  return s;
}

export async function deriveKey(pin: string, saltB64: string, onProgress?: (pct: number) => void, iterations = DEFAULT_ITERATIONS): Promise<Uint8Array> {
  return deriveKeyAsync(pin, saltB64, onProgress, iterations);
}

export function encrypt(obj: unknown, key: Uint8Array): { iv: string; data: string } {
  const iv = randomBytes(12);
  const ct = gcm(key, iv).encrypt(enc.encode(JSON.stringify(obj)));
  return { iv: b64(iv), data: b64(ct) };
}

export function decrypt(payload: { iv: string; data: string }, key: Uint8Array): unknown | null {
  try {
    const pt = gcm(key, unb64(payload.iv)).decrypt(unb64(payload.data));
    return JSON.parse(dec.decode(pt));
  } catch (e) {
    return null;
  }
}

export function encryptBytes(bytes: Uint8Array, key: Uint8Array): { iv: string; data: string } {
  const iv = randomBytes(12);
  const ct = gcm(key, iv).encrypt(bytes);
  return { iv: b64(iv), data: b64(ct) };
}

export function decryptBytes(payload: { iv: string; data: string }, key: Uint8Array): Uint8Array | null {
  try {
    return gcm(key, unb64(payload.iv)).decrypt(unb64(payload.data));
  } catch (e) {
    return null;
  }
}

export function wrapKey(masterKey: Uint8Array, pinKey: Uint8Array): { iv: string; data: string } {
  return encryptBytes(masterKey, pinKey);
}

export function unwrapKey(wrapped: { iv: string; data: string }, pinKey: Uint8Array): Uint8Array | null {
  return decryptBytes(wrapped, pinKey);
}

export function exportKey(key: Uint8Array): string {
  return b64(key);
}

export function importKey(keyB64: string): Uint8Array {
  return unb64(keyB64);
}

export function generatePassword(len: number): string {
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const symbols = '!@#$%^&*()-_=+[]{};:,.<>?';
  const all = lower + upper + digits + symbols;
  const buf = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += all[buf[i] % all.length];
  const sets = [lower, upper, digits, symbols];
  let seed = '';
  sets.forEach((s) => {
    seed += s[buf[buf.length - 1 - s.length] % s.length];
  });
  const result = (seed + out.slice(seed.length)).split('');
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result.join('');
}

export function isWeakPin(pin: string): boolean {
  const p = String(pin || '');
  if (!/^\d{4,12}$/.test(p)) return true;
  if (p.split('').every((c) => c === p[0])) return true;
  if ('0123456789'.includes(p) || '9876543210'.includes(p)) return true;
  const asc = p.split('').every((c, i) => i === 0 || Number(c) === (Number(p[i - 1]) + 1) % 10);
  const desc = p.split('').every((c, i) => i === 0 || Number(c) === (Number(p[i - 1]) + 9) % 10);
  if (p.length > 2 && (asc || desc)) return true;
  const common = ['123123', '121212', '112233', '123321', '2580', '0852', '13579', '159753', '777777', '888888', '999999', '666666'];
  if (common.includes(p)) return true;
  if (/^(\d)\1(\d)\2(\d)\3/.test(p)) return true;
  return false;
}
