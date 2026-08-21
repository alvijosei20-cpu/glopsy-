import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptSecret, decryptSecret, maskSecret, isEncryptedSecret } from './crypto.js';

test('encryptSecret/decryptSecret roundtrip', () => {
  const plain = 'APP_USR-1234567890-abcdef';
  const stored = encryptSecret(plain);
  assert.ok(isEncryptedSecret(stored), 'debe quedar cifrado con prefijo v1:');
  assert.notEqual(stored, plain);
  assert.equal(decryptSecret(stored), plain);
});

test('cifrado genera IV distinto (no determinista)', () => {
  const a = encryptSecret('secreto');
  const b = encryptSecret('secreto');
  assert.notEqual(a, b);
  assert.equal(decryptSecret(a), decryptSecret(b));
});

test('decryptSecret pasa texto plano legacy sin cifrar', () => {
  assert.equal(decryptSecret('token-legacy-plano'), 'token-legacy-plano');
  assert.equal(decryptSecret(''), null);
  assert.equal(decryptSecret(null), null);
});

test('maskSecret oculta el secreto', () => {
  assert.equal(maskSecret('APP_USR-1234567890-abcdef'), 'APP_••••cdef');
  assert.equal(maskSecret('abc'), '••••');
  assert.equal(maskSecret(''), '');
  assert.equal(maskSecret(null), '');
});
