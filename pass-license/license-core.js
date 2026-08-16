/**
 * Pass — generador de códigos de activación (núcleo).
 * Implementación pura de SHA-256 + HMAC + Base32 (sin dependencias).
 * Expone la API en `globalThis.LicenseCore` (navegador y Node ESM/CJS).
 */
(function (factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.LicenseCore = api;
  } else if (typeof self !== 'undefined') {
    self.LicenseCore = api;
  } else if (typeof window !== 'undefined') {
    window.LicenseCore = api;
  }
})(function () {
  'use strict';

  var LICENSE_SECRET = 'pass:v1:license:7f3c9a';
  // 32 caracteres sin ambiguos (0/O/1/I/L)
  var BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  /* ---------- SHA-256 puro ---------- */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256(message) {
    var bytes = typeof message === 'string' ? stringToBytes(message) : message;
    var l = bytes.length;
    var bitLen = l * 8;
    var withOne = new Uint8Array(l + 1);
    withOne.set(bytes);
    withOne[l] = 0x80;
    var rem = withOne.length % 64;
    var padLen = rem > 56 ? withOne.length + (64 - rem) + 8 : withOne.length + (56 - rem) + 8;
    var padded = new Uint8Array(padLen);
    padded.set(withOne);
    var dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);
    dv.setUint32(padded.length - 4, bitLen >>> 0, false);

    var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    var h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    var w = new Int32Array(64);

    for (var i = 0; i < padded.length; i += 64) {
      for (var t = 0; t < 16; t++) {
        w[t] = dv.getInt32(i + t * 4, false);
      }
      for (t = 16; t < 64; t++) {
        var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + K[t] + w[t]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }

    var out = new Uint8Array(32);
    var odv = new DataView(out.buffer);
    [h0, h1, h2, h3, h4, h5, h6, h7].forEach(function (v, idx) {
      odv.setUint32(idx * 4, v >>> 0, false);
    });
    return out;
  }

  function stringToBytes(str) {
    var enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
    if (enc) return enc.encode(str);
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code < 0x80) out.push(code);
      else if (code < 0x800) { out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f)); }
      else { out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f)); }
    }
    return new Uint8Array(out);
  }

  /* ---------- HMAC-SHA256 ---------- */
  function hmacSha256(key, message) {
    var blockSize = 64;
    var k = typeof key === 'string' ? stringToBytes(key) : key;
    if (k.length > blockSize) k = sha256(k);
    var ipad = new Uint8Array(blockSize);
    var opad = new Uint8Array(blockSize);
    for (var i = 0; i < blockSize; i++) {
      ipad[i] = (k[i] || 0) ^ 0x36;
      opad[i] = (k[i] || 0) ^ 0x5c;
    }
    var inner = stringToBytes(message);
    var innerPadded = new Uint8Array(ipad.length + inner.length);
    innerPadded.set(ipad);
    innerPadded.set(inner, ipad.length);
    var innerHash = sha256(innerPadded);
    var outerPadded = new Uint8Array(opad.length + innerHash.length);
    outerPadded.set(opad);
    outerPadded.set(innerHash, opad.length);
    return sha256(outerPadded);
  }

  /* ---------- Base32 ---------- */
  function encodeBase32(bytes) {
    var bits = 0, value = 0, out = '';
    for (var i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) {
        out += BASE32.charAt((value >>> (bits - 5)) & 31);
        bits -= 5;
      }
      value &= (1 << bits) - 1;
    }
    if (bits > 0) out += BASE32.charAt((value << (5 - bits)) & 31);
    return out;
  }

  /* ---------- API pública ---------- */
  function normalizeCode(input) {
    return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function formatCode(code) {
    var clean = normalizeCode(code);
    var groups = clean.match(/.{1,4}/g) || [];
    return groups.join('-');
  }

  function generateCode(deviceId) {
    var mac = hmacSha256(LICENSE_SECRET, 'pass-license:' + String(deviceId).trim());
    return encodeBase32(mac.slice(0, 10));
  }

  function verifyCode(deviceId, code) {
    var expected = generateCode(deviceId);
    var actual = normalizeCode(code);
    if (expected.length !== actual.length) return false;
    var diff = 0;
    for (var i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
    }
    return diff === 0;
  }

  return {
    LICENSE_SECRET: LICENSE_SECRET,
    generateCode: generateCode,
    verifyCode: verifyCode,
    formatCode: formatCode,
    normalizeCode: normalizeCode
  };
});
