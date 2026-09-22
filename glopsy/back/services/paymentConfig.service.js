// ==========================================
// Credenciales globales de pasarelas (cuenta de la plataforma).
// Se leen de checkout_integrations (tienda principal) con respaldo en env.
// ==========================================

import { pool } from '../db.js';
import { decryptSecret } from '../utils/crypto.js';
import { setEpaycoCredentials } from './epayco.service.js';

// ePayco: public_key (checkout.js), access_token = P_KEY (firma del webhook)
// y webhook_secret = P_CUST_ID_CLIENTE.
export const loadEpaycoCredentials = async () => {
  const { rows } = await pool.query(
    `SELECT public_key, access_token, webhook_secret, mode
     FROM checkout_integrations
     WHERE provider = 'epayco'
     ORDER BY (mode = 'produccion') DESC, updated_at DESC NULLS LAST
     LIMIT 1`
  );
  const r = rows[0];
  if (!r?.public_key || !r?.access_token) return null;
  const creds = {
    publicKey: r.public_key,
    privateKey: decryptSecret(r.access_token),
    customerId: r.webhook_secret ? decryptSecret(r.webhook_secret) : '',
    test: r.mode !== 'produccion',
  };
  setEpaycoCredentials(creds);
  return creds;
};
