import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  verifyBoldSignature,
  buildPaymentLinkPayload,
  buildPaymentIntentPayload,
  buildPaymentAttemptPayload,
} from './bold.service.js';

const firmar = (body, secret) =>
  crypto.createHmac('sha256', secret)
    .update(Buffer.from(body, 'utf8').toString('base64'))
    .digest('hex');

test('verifyBoldSignature acepta la firma correcta', () => {
  const body = JSON.stringify({ type: 'SALE_APPROVED', data: { payment_id: 'ABC123' } });
  const secret = 'secreto-super';
  assert.equal(verifyBoldSignature(Buffer.from(body), firmar(body, secret), secret), true);
});

test('verifyBoldSignature rechaza firma inválida o ausente', () => {
  const body = JSON.stringify({ type: 'SALE_APPROVED' });
  assert.equal(verifyBoldSignature(Buffer.from(body), 'deadbeef', 'secreto'), false);
  assert.equal(verifyBoldSignature(Buffer.from(body), undefined, 'secreto'), false);
});

test('verifyBoldSignature con llave vacía (modo pruebas)', () => {
  const body = JSON.stringify({ type: 'SALE_REJECTED' });
  assert.equal(verifyBoldSignature(Buffer.from(body), firmar(body, ''), ''), true);
});

test('buildPaymentLinkPayload arma monto cerrado con impuestos', () => {
  const p = buildPaymentLinkPayload({
    amount: 119000,
    currency: 'COP',
    reference: '100123',
    description: 'Compra glopsy',
    payerEmail: 'cliente@correo.com',
    taxes: [{ type: 'VAT', base: 100000, value: 19000 }],
  });
  assert.equal(p.amount_type, 'CLOSE');
  assert.equal(p.amount.total_amount, 119000);
  assert.equal(p.amount.tip_amount, 0);
  assert.deepEqual(p.amount.taxes, [{ type: 'VAT', base: 100000, value: 19000 }]);
  assert.equal(p.reference, '100123');
  assert.equal(p.payer_email, 'cliente@correo.com');
});

test('buildPaymentLinkPayload omite opcionales vacíos', () => {
  const p = buildPaymentLinkPayload({ amount: 50000, reference: '1' });
  assert.equal(p.amount.currency, 'COP');
  assert.equal('taxes' in p.amount, false);
  assert.equal('description' in p, false);
  assert.equal('payment_methods' in p, false);
});

test('buildPaymentIntentPayload arma la intención transparente', () => {
  const p = buildPaymentIntentPayload({
    referenceId: 100123,
    amount: 119000,
    taxes: [{ type: 'VAT', base: 100000, value: 19000 }],
    description: 'Compra glopsy',
    callbackUrl: 'https://glopsy.shop/checkout/retorno',
    customer: { name: 'Juan', email: 'juan@correo.com' },
  });
  assert.equal(p.reference_id, '100123');
  assert.equal(p.amount.total_amount, 119000);
  assert.equal(p.amount.tip_amount, 0);
  assert.deepEqual(p.amount.taxes, [{ type: 'VAT', base: 100000, value: 19000 }]);
  assert.equal(p.callback_url, 'https://glopsy.shop/checkout/retorno');
  assert.equal(p.customer.email, 'juan@correo.com');
});

test('buildPaymentAttemptPayload arma el intento con tarjeta', () => {
  const p = buildPaymentAttemptPayload({
    referenceId: '100123',
    payer: { person_type: 'NATURAL_PERSON', name: 'Laura', document_type: 'CEDULA', document_number: '1012345678' },
    paymentMethod: { name: 'CREDIT_CARD', card_number: '4111111111111111', cvc: '123', installments: 1 },
    deviceFingerprint: { device_type: 'DESKTOP', language: 'es-CO' },
  });
  assert.equal(p.reference_id, '100123');
  assert.equal(p.payment_method.name, 'CREDIT_CARD');
  assert.equal(p.payer.document_type, 'CEDULA');
  assert.equal(p.device_fingerprint.device_type, 'DESKTOP');
});
