import 'dotenv/config';
import { pool } from '../db.js';
import { encryptSecret, isEncryptedSecret } from '../utils/crypto.js';

const migrate = async () => {
  const { rows: webhookRows } = await pool.query(
    `SELECT checkout_integration_id, webhook_secret FROM webhook WHERE webhook_secret IS NOT NULL`
  );

  let count = 0;
  for (const row of webhookRows) {
    if (!row.checkout_integration_id || !row.webhook_secret) continue;
    const { rows: existing } = await pool.query(
      `SELECT webhook_secret FROM checkout_integrations WHERE id = $1 LIMIT 1`,
      [row.checkout_integration_id]
    );
    if (!existing[0]) continue;
    if (existing[0].webhook_secret && isEncryptedSecret(existing[0].webhook_secret)) continue;

    await pool.query(
      `UPDATE checkout_integrations SET webhook_secret = $1, updated_at = NOW() WHERE id = $2`,
      [encryptSecret(row.webhook_secret), row.checkout_integration_id]
    );
    count += 1;
  }

  console.log(count === 0
    ? 'No había webhook_secret por migrar.'
    : `Webhook secrets migrados a checkout_integrations (cifrados): ${count}`);
  process.exit(0);
};

migrate().catch((err) => {
  console.error('Error al migrar webhook_secret:', err.message);
  process.exit(1);
});
