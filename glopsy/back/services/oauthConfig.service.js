// Credenciales globales de OAuth de la plataforma (TikTok Login Kit, etc.).
// Se leen de `plataforma_oauth` y, si no hay, se usa el respaldo del entorno.
// El client_secret se guarda cifrado.

import { pool } from '../db.js';
import { encryptSecret, decryptSecret, maskSecret, isEncryptedSecret } from '../utils/crypto.js';

const ENV_FALLBACK = {
  tiktok: () => ({
    clientId: process.env.TIKTOK_CLIENT_KEY || null,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET || null,
    redirectUri: process.env.TIKTOK_REDIRECT_URI || null,
    scopes: null,
    enabled: true,
    source: 'env',
  }),
};

// Config completa (con el secreto en claro) para usar en el flujo OAuth.
export const getOAuthConfig = async (provider) => {
  const { rows } = await pool.query(
    'SELECT * FROM plataforma_oauth WHERE provider = $1 LIMIT 1',
    [provider]
  );
  const r = rows[0];
  if (r?.client_id && r?.client_secret) {
    return {
      clientId: r.client_id,
      clientSecret: decryptSecret(r.client_secret),
      redirectUri: r.redirect_uri || null,
      scopes: r.scopes || null,
      enabled: r.enabled !== false,
      source: 'db',
    };
  }
  return ENV_FALLBACK[provider]?.() || { clientId: null, clientSecret: null, redirectUri: null, enabled: false, source: 'none' };
};

// Estado para el panel (sin exponer el secreto).
export const getOAuthStatus = async (provider) => {
  const cfg = await getOAuthConfig(provider);
  return {
    provider,
    configured: Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri),
    client_id: cfg.clientId || '',
    client_secret: cfg.clientSecret ? maskSecret(cfg.clientSecret) : '',
    redirect_uri: cfg.redirectUri || '',
    scopes: cfg.scopes || '',
    enabled: cfg.enabled !== false,
    source: cfg.source,
  };
};

export const isOAuthConfigured = async (provider) => (await getOAuthStatus(provider)).configured;

// Guarda/actualiza la configuración. Si `clientSecret` viene vacío o enmascarado
// (sin cambios), se conserva el secreto existente.
export const saveOAuthConfig = async (provider, { clientId, clientSecret, redirectUri, scopes, enabled } = {}) => {
  const { rows: existingRows } = await pool.query(
    'SELECT client_secret FROM plataforma_oauth WHERE provider = $1 LIMIT 1',
    [provider]
  );
  const existingSecret = existingRows[0]?.client_secret || null;

  let secret = existingSecret;
  const incoming = clientSecret === undefined || clientSecret === null ? '' : String(clientSecret).trim();
  const looksMasked = incoming.includes('•') || incoming.includes('*');
  if (incoming && !looksMasked && !isEncryptedSecret(incoming)) {
    secret = encryptSecret(incoming);
  }

  const clean = (v) => (v === undefined || v === null ? null : String(v).trim() || null);

  await pool.query(
    `INSERT INTO plataforma_oauth (provider, client_id, client_secret, redirect_uri, scopes, enabled, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (provider) DO UPDATE
       SET client_id = COALESCE(EXCLUDED.client_id, plataforma_oauth.client_id),
           client_secret = COALESCE(EXCLUDED.client_secret, plataforma_oauth.client_secret),
           redirect_uri = COALESCE(EXCLUDED.redirect_uri, plataforma_oauth.redirect_uri),
           scopes = COALESCE(EXCLUDED.scopes, plataforma_oauth.scopes),
           enabled = EXCLUDED.enabled,
           updated_at = now()`,
    [provider, clean(clientId), secret, clean(redirectUri), clean(scopes), enabled !== false]
  );

  return getOAuthStatus(provider);
};
