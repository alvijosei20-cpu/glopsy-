import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanString,
  cleanText,
  cleanNullableString,
  isEmail,
  cleanEmail,
  cleanPhone,
  isColombianMobile,
  toInt,
  toNumber,
  cleanBoolean,
  cleanUrl,
  isValidDateString,
  cleanDate,
  sanitizeArray,
  sanitizeObject,
  isAllowedEnum,
} from './validation.js';

test('cleanString trims y elimina control chars', () => {
  assert.equal(cleanString('  hola  \n\t'), 'hola');
  assert.equal(cleanString('a\x00b'), 'ab');
});

test('cleanString elimina script/style y atributos on*', () => {
  assert.equal(cleanString('<script>alert(1)</script>hola'), 'hola');
  assert.equal(cleanString('<b onclick="x()">hola</b>'), '<b>hola</b>');
  assert.equal(cleanString('javascript:alert(1)'), 'alert(1)');
});

test('cleanString limita longitud', () => {
  assert.equal(cleanString('abcdefgh', { maxLength: 3 }), 'abc');
});

test('cleanText permite saltos de línea', () => {
  assert.equal(cleanText('linea1\nlinea2'), 'linea1\nlinea2');
});

test('cleanNullableString convierte vacío a null', () => {
  assert.equal(cleanNullableString('  '), null);
  assert.equal(cleanNullableString('x'), 'x');
});

test('isEmail / cleanEmail', () => {
  assert.equal(isEmail('a@b.co'), true);
  assert.equal(isEmail('a@b'), false);
  assert.equal(cleanEmail('  A@B.CO '), 'a@b.co');
  assert.equal(cleanEmail('nope'), null);
});

test('cleanPhone e isColombianMobile', () => {
  assert.equal(cleanPhone(' 300 123-4567 '), '300 123-4567');
  assert.equal(isColombianMobile('3001234567'), true);
  assert.equal(isColombianMobile('2001234567'), false);
});

test('toInt / toNumber', () => {
  assert.equal(toInt('12'), 12);
  assert.equal(toInt('abc'), null);
  assert.equal(toInt('12', { min: 20 }), null);
  assert.equal(toInt('', { fallback: 0 }), 0);
  assert.equal(toNumber('12.5'), 12.5);
  assert.equal(toNumber('-5', { min: 0 }), null);
});

test('cleanBoolean', () => {
  assert.equal(cleanBoolean('true'), true);
  assert.equal(cleanBoolean(false), false);
  assert.equal(cleanBoolean('maybe', false), false);
});

test('cleanUrl solo http/https', () => {
  assert.equal(cleanUrl('https://x.com/a.png'), 'https://x.com/a.png');
  assert.equal(cleanUrl('javascript:alert(1)'), null);
  assert.equal(cleanUrl('ftp://x.com'), null);
});

test('isValidDateString / cleanDate', () => {
  assert.equal(isValidDateString('2024-02-29'), true);
  assert.equal(isValidDateString('2023-02-29'), false);
  assert.equal(cleanDate('2024-02-29'), '2024-02-29');
  assert.equal(cleanDate('nope', { fallback: null }), null);
});

test('sanitizeArray', () => {
  assert.deepEqual(sanitizeArray(['a', '', 0, 'b'], (v) => String(v)), ['a', '0', 'b']);
});

test('sanitizeObject recorre strings', () => {
  const out = sanitizeObject({ a: '<script>x</script>hola', n: 5, arr: [{ s: 'y' }] });
  assert.equal(out.a, 'hola');
  assert.equal(out.n, 5);
  assert.equal(out.arr[0].s, 'y');
});

test('isAllowedEnum', () => {
  assert.equal(isAllowedEnum('prueba', ['prueba', 'produccion']), true);
  assert.equal(isAllowedEnum('x', ['prueba']), false);
});
