// Job diario del ledger: libera saldos vencidos (2 días hábiles post-entrega)
// y genera los lotes de pago (payouts) por proveedor y moneda.
//
// Uso: node --import=dotenv/config scripts/ledgerDaily.js
// Programar con cron una vez al día.

import 'dotenv/config';
import { pool } from '../db.js';
import { releaseEligibleOrders, createPayout } from '../services/ledger.service.js';

const DIAS_DIFERIDO = Number(process.env.LEDGER_HOLD_BUSINESS_DAYS || 2);

const run = async () => {
  const liberacion = await releaseEligibleOrders({ dias: DIAS_DIFERIDO });
  console.log(`Órdenes evaluadas: ${liberacion.evaluated}. Liberadas: ${liberacion.released.length}.`);

  const { rows: proveedores } = await pool.query(
    `SELECT provider_ref, moneda
     FROM ledger_account_balances
     WHERE bucket = 'provider_available'
     GROUP BY provider_ref, moneda
     HAVING COALESCE(SUM(balance), 0) > 0`
  );

  const pagos = [];
  for (const p of proveedores) {
    const res = await createPayout({ providerRef: p.provider_ref, moneda: p.moneda });
    if (res.created) pagos.push({ provider: p.provider_ref, moneda: p.moneda, total: res.total, payoutId: res.payoutId });
  }
  console.log(`Payouts creados: ${pagos.length}.`, pagos);
  process.exit(0);
};

run().catch((err) => {
  console.error('Error en el job diario del ledger:', err.message);
  process.exit(1);
});
