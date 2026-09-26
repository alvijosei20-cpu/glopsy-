// ==========================================
// Credenciales globales de pasarelas (cuenta de la plataforma).
// Se leen de checkout_integrations (tienda principal) con respaldo en env.
// ==========================================

import { pool } from '../db.js';
import { decryptSecret } from '../utils/crypto.js';
import { setBoldCredentials } from './bold.service.js';

// Bold: public_key (checkout.js de la pasarela), access_token = llave de la
// API (dispersión/disputas/saldos) y webhook_secret = cliente (firma).
// Las URLs de la API (disputas, dispersión, saldos) vienen de env.
export const loadBoldCredentials = async () => {
  const { rows } = await pool.query(
    `SELECT public_key, access_token, webhook_secret, mode
     FROM checkout_integrations
     WHERE provider = 'bold'
     ORDER BY (mode = 'produccion') DESC, updated_at DESC NULLS LAST
     LIMIT 1`
  );
  const r = rows[0];
  if (!r?.public_key || !r?.access_token) return null;
  const creds = {
    publicKey: r.public_key,
    privateKey: decryptSecret(r.access_token),
    customerId: r.webhook_secret ? decryptSecret(r.webhook_secret) : '',
    apiKey: decryptSecret(r.access_token),
    test: r.mode !== 'produccion',
    sdkUrl: process.env.BOLD_SDK_URL || 'https://checkout.bold.co/checkout.js',
    disputesUrl: process.env.BOLD_DISPUTES_URL || '',
    payoutUrl: process.env.BOLD_PAYOUT_URL || '',
    balanceUrl: process.env.BOLD_BALANCE_URL || '',
  };
  setBoldCredentials(creds);
  return creds;
};