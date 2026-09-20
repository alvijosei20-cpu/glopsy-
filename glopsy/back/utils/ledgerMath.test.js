import test from 'node:test';
import assert from 'node:assert/strict';
import {
  distribute,
  addBusinessDays,
  assertBalanced,
  buildSalePostings,
  buildReleasePostings,
  buildRefundPostings,
  buildPayoutPostings,
  buildPayoutPaidPostings,
} from './ledgerMath.js';

test('distribute reparte sin perder centavos', () => {
  const parts = distribute(100, [1, 1, 1]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 100);
  assert.deepEqual([...parts].sort((a, b) => a - b), [33, 33, 34]);
});

test('distribute con pesos cero devuelve ceros', () => {
  assert.deepEqual(distribute(500, [0, 0]), [0, 0]);
  assert.deepEqual(distribute(500, []), []);
});

test('addBusinessDays salta fines de semana', () => {
  // 2026-09-18 es viernes
  assert.equal(addBusinessDays('2026-09-18', 2).toISOString().slice(0, 10), '2026-09-22');
  assert.equal(addBusinessDays('2026-09-19', 1).toISOString().slice(0, 10), '2026-09-21');
});

test('addBusinessDays salta festivos', () => {
  assert.equal(
    addBusinessDays('2026-09-18', 2, ['2026-09-21']).toISOString().slice(0, 10),
    '2026-09-23'
  );
});

test('buildSalePostings cuadra y calcula el neto del proveedor', () => {
  const postings = buildSalePostings({
    providers: [{ providerRef: 'biz-1', gross: 100000, commission: 10000 }],
    processorFee: 3000,
  });
  assertBalanced(postings);
  const processor = postings.find((p) => p.key === 'processor');
  const proveedor = postings.find((p) => p.key === 'provider_deferred');
  const comision = postings.find((p) => p.key === 'commission');
  assert.equal(processor.debit, 97000);
  assert.equal(proveedor.credit, 87000);
  assert.equal(comision.credit, 10000);
});

test('buildSalePostings reparte el fee entre varios proveedores sin descuadrar', () => {
  const postings = buildSalePostings({
    providers: [
      { providerRef: 'a', gross: 60000, commission: 6000 },
      { providerRef: 'b', gross: 40000, commission: 4000 },
    ],
    processorFee: 1000,
    withholding: 500,
  });
  assertBalanced(postings);
  const nets = postings.filter((p) => p.key === 'provider_deferred').map((p) => p.credit);
  assert.equal(nets.reduce((a, b) => a + b, 0), 100000 - 10000 - 1000 - 500);
  assert.equal(nets[0], 53100);
  assert.equal(nets[1], 35400);
});

test('asientos de liberación, reembolso y payout cuadran', () => {
  assertBalanced(buildReleasePostings([{ providerRef: 'a', amount: 50000 }]));
  assertBalanced(buildRefundPostings({ providerRef: 'a', amount: 20000 }));
  assertBalanced(buildPayoutPostings({ providerRef: 'a', amount: 30000 }));
  assertBalanced(buildPayoutPaidPostings({ amount: 30000 }));
});

test('assertBalanced detecta descuadres', () => {
  assert.throws(() => assertBalanced([
    { key: 'processor', debit: 100, credit: 0 },
    { key: 'commission', debit: 0, credit: 90 },
  ]), /descuadrados/);
});
