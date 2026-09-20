// ==========================================
// Credenciales globales de pasarelas (cuenta de la plataforma).
// Se leen de checkout_integrations (tienda principal) con respaldo en env.
// ==========================================

import { pool } from '../db.js';
import { decryptSecret } from '../utils/crypto.js';
import { setBoldCredentials } from './bold.service.js';

export const loadBoldCredentials = async () => {
  const { rows } = await pool.query(
    `SELECT access_token, webhook_secret
     FROM checkout_integrations
     WHERE provider = 'bold'
     ORDER BY (mode = 'produccion') DESC, updated_at DESC NULLS LAST
     LIMIT 1`
  );
  const r = rows[0];
  if (!r?.access_token) return null;
  const creds = {
    apiKey: decryptSecret(r.access_token),
    secretKey: r.webhook_secret ? decryptSecret(r.webhook_secret) : '',
  };
  setBoldCredentials(creds);
  return creds;
};
