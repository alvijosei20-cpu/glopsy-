import 'dotenv/config';
import { pool } from '../db.js';
import { encryptSecret, isEncryptedSecret } from '../utils/crypto.js';

const migrate = async () => {
  const updated = [];

  const { rows: checkoutRows } = await pool.query(
    `SELECT id, access_token FROM checkout_integrations`
  );
  for (const row of checkoutRows) {
    if (!isEncryptedSecret(row.access_token)) {
      await pool.query(`UPDATE checkout_integrations SET access_token = $1, updated_at = NOW() WHERE id = $2`, [
        encryptSecret(row.access_token),
        row.id,
      ]);
      updated.push(`checkout_integrations#${row.id}`);
    }
  }

  const { rows: integRows } = await pool.query(
    `SELECT id, api_key FROM tienda_integraciones`
  );
  for (const row of integRows) {
    if (!isEncryptedSecret(row.api_key)) {
      await pool.query(`UPDATE tienda_integraciones SET api_key = $1, updated_at = NOW() WHERE id = $2`, [
        encryptSecret(row.api_key),
        row.id,
      ]);
      updated.push(`tienda_integraciones#${row.id}`);
    }
  }

  console.log(updated.length === 0
    ? 'No había credenciales en texto plano por cifrar.'
    : `Credenciales cifradas: ${updated.join(', ')}`);
  process.exit(0);
};

migrate().catch((err) => {
  console.error('Error al cifrar credenciales existentes:', err.message);
  process.exit(1);
});
