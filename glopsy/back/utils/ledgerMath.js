// ==========================================
// Matemática contable pura (sin DB) del ledger.
// Ver services/ledger.service.js para las operaciones persistentes.
// ==========================================

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const toCents = (n) => Math.round(Number(n) * 100);
export const fromCents = (c) => c / 100;

// Reparte un total (en centavos) proporcionalmente a los pesos, sin perder centavos.
export const distribute = (totalCents, weights) => {
  if (!Array.isArray(weights) || weights.length === 0) return [];
  const total = Math.trunc(totalCents);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const floors = raw.map((r) => Math.floor(r));
  const remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder; k++) floors[order[k % order.length].i]++;
  return floors;
};

// Suma días hábiles (salta sábados, domingos y festivos indicados).
export const addBusinessDays = (dateInput, days, holidays = []) => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) throw new Error('Fecha inválida.');
  const festivos = new Set(holidays.map((h) => new Date(h).toISOString().slice(0, 10)));
  let added = 0;
  while (added < Math.max(0, Math.trunc(days))) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    const key = d.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !festivos.has(key)) added++;
  }
  return d;
};

export const assertBalanced = (postings) => {
  const debits = round2(postings.reduce((a, p) => a + Number(p.debit || 0), 0));
  const credits = round2(postings.reduce((a, p) => a + Number(p.credit || 0), 0));
  if (debits !== credits) {
    throw new Error(`Asientos descuadrados: débitos ${debits} != créditos ${credits}.`);
  }
  return true;
};

// Venta: el proveedor asume el fee del procesador y la comisión de la plataforma.
// Débito  processor         = bruto - fee (lo que entra a la cuenta central)
// Crédito provider_deferred = neto por proveedor (bruto - comisión - fee - retención)
// Crédito commission        = comisión de glopsy
// Crédito withholding       = retenciones
export const buildSalePostings = ({ providers, processorFee = 0, withholding = 0 }) => {
  if (!Array.isArray(providers) || providers.length === 0) {
    throw new Error('Se requiere al menos un proveedor.');
  }
  const grossC = providers.map((p) => toCents(p.gross));
  const commissionC = providers.map((p) => toCents(p.commission));
  const totalGrossC = grossC.reduce((a, b) => a + b, 0);
  const totalCommissionC = commissionC.reduce((a, b) => a + b, 0);
  const feeC = toCents(processorFee);
  const withholdingC = toCents(withholding);
  const feeShares = distribute(feeC, grossC);
  const withShares = distribute(withholdingC, grossC);

  const postings = [
    { key: 'processor', providerRef: null, debit: fromCents(totalGrossC - feeC), credit: 0 },
  ];
  providers.forEach((p, i) => {
    const netC = grossC[i] - commissionC[i] - feeShares[i] - withShares[i];
    postings.push({ key: 'provider_deferred', providerRef: p.providerRef, debit: 0, credit: fromCents(netC) });
  });
  postings.push({ key: 'commission', providerRef: null, debit: 0, credit: fromCents(totalCommissionC) });
  if (withholdingC > 0) {
    postings.push({ key: 'withholding', providerRef: null, debit: 0, credit: fromCents(withholdingC) });
  }
  assertBalanced(postings);
  return postings;
};

export const buildReleasePostings = (entries) =>
  entries.flatMap((e) => [
    { key: 'provider_deferred', providerRef: e.providerRef, debit: round2(e.amount), credit: 0 },
    { key: 'provider_available', providerRef: e.providerRef, debit: 0, credit: round2(e.amount) },
  ]);

export const buildRefundPostings = ({ providerRef, amount, fromBucket = 'provider_available' }) => [
  { key: fromBucket, providerRef, debit: round2(amount), credit: 0 },
  { key: 'processor', providerRef: null, debit: 0, credit: round2(amount) },
];

export const buildPayoutPostings = ({ providerRef, amount }) => [
  { key: 'provider_available', providerRef, debit: round2(amount), credit: 0 },
  { key: 'payout_pending', providerRef: null, debit: 0, credit: round2(amount) },
];

export const buildPayoutPaidPostings = ({ amount }) => [
  { key: 'payout_pending', providerRef: null, debit: round2(amount), credit: 0 },
  { key: 'bank', providerRef: null, debit: 0, credit: round2(amount) },
];
