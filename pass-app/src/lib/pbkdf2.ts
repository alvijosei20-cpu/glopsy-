// PBKDF2-HMAC-SHA256 plano y monomórfico (optimizado para intérpretes como
// Hermes). Sin closures ni despacho dinámico: solo bucles y Uint32Array.
// Produce EXACTAMENTE el mismo resultado que WebCrypto PBKDF2.

import { toByteArray } from 'base64-js';

const DK_LEN = 32;

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const ROTR = (x: number, n: number) => (x >>> n) | (x << (32 - n));

class Sha256 {
  h: Uint32Array;
  buf: Uint8Array;
  buflen: number;
  len: number;
  w: Uint32Array;

  constructor(copyFrom?: Sha256) {
    if (copyFrom) {
      this.h = copyFrom.h.slice();
      this.buf = copyFrom.buf.slice();
      this.buflen = copyFrom.buflen;
      this.len = copyFrom.len;
      this.w = new Uint32Array(64);
      return;
    }
    this.h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    this.buf = new Uint8Array(64);
    this.buflen = 0;
    this.len = 0;
    this.w = new Uint32Array(64);
  }

  update(data: Uint8Array, off = 0, length = data.length): this {
    const buf = this.buf;
    let blen = this.buflen;
    this.len += length;
    const end = off + length;
    let i = off;
    if (blen > 0) {
      while (i < end && blen < 64) buf[blen++] = data[i++];
      if (blen === 64) {
        this.compress(buf, 0);
        blen = 0;
      }
    }
    while (i + 64 <= end) {
      this.compress(data, i);
      i += 64;
    }
    while (i < end) buf[blen++] = data[i++];
    this.buflen = blen;
    return this;
  }

  clone(): Sha256 {
    return new Sha256(this);
  }

  digest(): Uint8Array {
    const buf = this.buf;
    let blen = this.buflen;
    const bits = this.len * 8;
    buf[blen++] = 0x80;
    if (blen > 56) {
      while (blen < 64) buf[blen++] = 0;
      this.compress(buf, 0);
      blen = 0;
    }
    while (blen < 56) buf[blen++] = 0;
    const hi = Math.floor(bits / 0x100000000) >>> 0;
    const lo = bits >>> 0;
    buf[56] = (hi >>> 24) & 0xff;
    buf[57] = (hi >>> 16) & 0xff;
    buf[58] = (hi >>> 8) & 0xff;
    buf[59] = hi & 0xff;
    buf[60] = (lo >>> 24) & 0xff;
    buf[61] = (lo >>> 16) & 0xff;
    buf[62] = (lo >>> 8) & 0xff;
    buf[63] = lo & 0xff;
    this.compress(buf, 0);
    const out = new Uint8Array(32);
    for (let i = 0; i < 8; i++) {
      const v = this.h[i];
      out[i * 4] = (v >>> 24) & 0xff;
      out[i * 4 + 1] = (v >>> 16) & 0xff;
      out[i * 4 + 2] = (v >>> 8) & 0xff;
      out[i * 4 + 3] = v & 0xff;
    }
    return out;
  }

  compress(block: Uint8Array, off: number) {
    const w = this.w;
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      w[i] = (block[j] << 24) | (block[j + 1] << 16) | (block[j + 2] << 8) | block[j + 3];
    }
    for (let i = 16; i < 64; i++) {
      const x15 = w[i - 15];
      const x2 = w[i - 2];
      const s0 = ROTR(x15, 7) ^ ROTR(x15, 18) ^ (x15 >>> 3);
      const s1 = ROTR(x2, 17) ^ ROTR(x2, 19) ^ (x2 >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = this.h[0], b = this.h[1], cc = this.h[2], d = this.h[3];
    let e = this.h[4], f = this.h[5], g = this.h[6], h = this.h[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ROTR(e, 6) ^ ROTR(e, 11) ^ ROTR(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = ROTR(a, 2) ^ ROTR(a, 13) ^ ROTR(a, 22);
      const maj = (a & b) ^ (a & cc) ^ (b & cc);
      const t2 = (S0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = cc;
      cc = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    this.h[0] = (this.h[0] + a) | 0;
    this.h[1] = (this.h[1] + b) | 0;
    this.h[2] = (this.h[2] + cc) | 0;
    this.h[3] = (this.h[3] + d) | 0;
    this.h[4] = (this.h[4] + e) | 0;
    this.h[5] = (this.h[5] + f) | 0;
    this.h[6] = (this.h[6] + g) | 0;
    this.h[7] = (this.h[7] + h) | 0;
  }
}

interface HmacState {
  inner: Sha256;
  outer: Sha256;
}

function hmacInit(password: Uint8Array): HmacState {
  let key = password;
  if (key.length > 64) key = new Sha256().update(key).digest();
  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const kb = i < key.length ? key[i] : 0;
    ipad[i] = kb ^ 0x36;
    opad[i] = kb ^ 0x5c;
  }
  return { inner: new Sha256().update(ipad), outer: new Sha256().update(opad) };
}

function hmacOnce(st: HmacState, msg: Uint8Array): Uint8Array {
  const innerHash = st.inner.clone().update(msg).digest();
  return st.outer.clone().update(innerHash).digest();
}

export async function deriveKeyAsync(
  pin: string,
  saltB64: string,
  onProgress?: (pct: number) => void,
  iterations = 600000
): Promise<Uint8Array> {
  const salt = toByteArray(saltB64);
  const password = new TextEncoder().encode(String(pin));
  const st = hmacInit(password);

  const blocks = Math.ceil(DK_LEN / 32);
  const dk = new Uint8Array(DK_LEN);
  const blockNum = new Uint8Array(4);
  const saltBlock = new Uint8Array(salt.length + 4);
  saltBlock.set(salt);
  const total = iterations * blocks;
  let done = 0;
  const YIELD_EVERY = 20000;

  for (let block = 1; block <= blocks; block++) {
    blockNum[0] = (block >>> 24) & 0xff;
    blockNum[1] = (block >>> 16) & 0xff;
    blockNum[2] = (block >>> 8) & 0xff;
    blockNum[3] = block & 0xff;
    saltBlock.set(blockNum, salt.length);

    let U = hmacOnce(st, saltBlock);
    const T = U.slice();
    done++;
    for (let i = 1; i < iterations; i++) {
      U = hmacOnce(st, U);
      for (let j = 0; j < 32; j++) T[j] ^= U[j];
      done++;
      if (done % YIELD_EVERY === 0) {
        onProgress?.(Math.round((done / total) * 100));
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    const outLen = Math.min(32, DK_LEN - (block - 1) * 32);
    dk.set(T.subarray(0, outLen), (block - 1) * 32);
  }
  onProgress?.(100);
  return dk;
}
