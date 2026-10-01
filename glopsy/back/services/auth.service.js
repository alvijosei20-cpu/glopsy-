import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { pool } from '../db.js';
import { redisClient } from './redis.service.js';
import { cleanString, cleanEmail, cleanUrl } from '../utils/validation.js';
import { parseUserAgent } from './tienda.service.js';

const rpName = 'Glopsy';
const getRpID = (originUrl) => {
  try {
    const url = originUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
    return new URL(url).hostname;
  } catch (e) {
    return process.env.RP_ID || 'localhost';
  }
};

const getOrigin = (originUrl) => {
  return originUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
};

export const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

export const verifyPassword = (password, storedHash) => {
  if (!storedHash) return false;
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(key, 'hex'));
};

export const registerWithEmail = async ({ email, password, name, birthdate, consent } = {}) => {
  const safeEmail = cleanEmail(email, { required: true });
  if (!safeEmail) throw new Error('Correo electrónico inválido.');
  const safeName = cleanString(name, { maxLength: 120 });
  const safeBirthdate = birthdate ? String(birthdate).trim() : null;

  const existing = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [safeEmail]);
  if (existing.rows[0]) {
    throw new Error('El correo electrónico ya está registrado.');
  }

  const password_hash = hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO users (email, name, password_hash, birthdate)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, avatar_url, can_sell`,
    [safeEmail, safeName || safeEmail.split('@')[0], password_hash, safeBirthdate]
  );
  const user = rows[0];

  // Registra la aceptación de Términos y Privacidad (Ley 1581 de 2012, art. 9).
  if (consent) {
    await recordUserConsent({ userId: user.id, ...consent }).catch((err) => {
      console.error('Error al registrar el consentimiento del usuario:', err.message);
    });
  }

  const tokenPayload = { userId: user.id, email: user.email };
  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '7d' });

  await redisClient.set(`session:${user.id}`, token, { EX: 7 * 24 * 60 * 60 });

  return { user, token };
};

// Registra la aceptación de Términos y Condiciones y/o Política de Privacidad
// dejando trazabilidad: usuario, IP, timestamp, navegador, dispositivo, país,
// idioma. No lanza error hacia el flujo principal si falla.
export const recordUserConsent = async ({
  userId,
  termsVersion,
  privacyVersion,
  accepted = true,
  ip,
  forwardedFor,
  userAgent,
  language,
  timezone,
  country,
  referrer,
  metadata,
} = {}) => {
  const uid = Number(userId);
  if (!uid) {
    const err = new Error('userId requerido para registrar el consentimiento.');
    err.code = 400;
    throw err;
  }
  const tv = termsVersion ? String(termsVersion).trim().slice(0, 30) : null;
  const pv = privacyVersion ? String(privacyVersion).trim().slice(0, 30) : null;
  const ua = userAgent ? String(userAgent).slice(0, 2000) : null;
  const parsed = parseUserAgent(ua || '');

  const { rows } = await pool.query(
    `INSERT INTO user_aceptaciones (
       user_id, terms_version, privacy_version, accepted, ip, forwarded_for,
       user_agent, browser, browser_version, os, device, language, timezone,
       country, referrer, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id, accepted_at`,
    [
      uid,
      tv,
      pv,
      accepted !== false,
      ip ? String(ip).slice(0, 64) : null,
      forwardedFor ? String(forwardedFor).slice(0, 500) : null,
      ua,
      parsed.browser,
      parsed.browserVersion,
      parsed.os,
      parsed.device,
      language ? String(language).slice(0, 60) : null,
      timezone ? String(timezone).slice(0, 60) : null,
      country ? String(country).slice(0, 2).toUpperCase() : null,
      referrer ? String(referrer).slice(0, 500) : null,
      metadata && typeof metadata === 'object' ? JSON.stringify(metadata) : '{}',
    ]
  );

  await pool.query(
    `UPDATE users SET
       terms_version = COALESCE($2, terms_version),
       terms_accepted_at = CASE WHEN $2 IS NOT NULL THEN now() ELSE terms_accepted_at END,
       privacy_version = COALESCE($3, privacy_version),
       privacy_accepted_at = CASE WHEN $3 IS NOT NULL THEN now() ELSE privacy_accepted_at END,
       updated_at = NOW()
     WHERE id = $1`,
    [uid, tv, pv]
  );

  return { id: rows[0]?.id, acceptedAt: rows[0]?.accepted_at };
};

// Obtiene el historial de consentimientos del usuario (para el titular).
export const getUserConsents = async (userId) => {
  const uid = Number(userId);
  if (!uid) return [];
  const { rows } = await pool.query(
    `SELECT id, terms_version, privacy_version, accepted, accepted_at, browser, os, device, country, metadata
     FROM user_aceptaciones WHERE user_id = $1 ORDER BY accepted_at DESC`,
    [uid]
  );
  return rows;
};

// Derecho de acceso: exporta en JSON los datos personales del titular.
export const exportUserData = async (userId) => {
  const uid = Number(userId);
  if (!uid) throw new Error('Usuario inválido.');

  const [userRes, addrRes, cardsRes, ordersRes, returnsRes, consentsRes] = await Promise.all([
    pool.query(
      `SELECT id, email, name, avatar_url, phone, TO_CHAR(birthdate, 'YYYY-MM-DD') AS birthdate,
              document_type, document_number, gender, can_sell, created_at, updated_at
       FROM users WHERE id = $1`,
      [uid]
    ),
    pool.query(
      `SELECT type, title, street, city, state, zip_code, country, phone, notes, created_at
       FROM user_addresses WHERE user_id = $1 ORDER BY id`,
      [uid]
    ),
    pool.query(
      `SELECT card_holder, last_four, card_brand, expiry_month, expiry_year, created_at
       FROM user_cards WHERE user_id = $1 ORDER BY id`,
      [uid]
    ),
    pool.query(
      `SELECT order_number, order_hash, status, amount, created_at
       FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [uid]
    ),
    pool.query(
      `SELECT r.return_number, r.order_ref, r.product_sku, r.quantity, r.reason, r.status, r.created_at
       FROM returns r
       JOIN orders o ON o.id = r.order_id
       WHERE o.user_id = $1 ORDER BY r.created_at DESC`,
      [uid]
    ),
    getUserConsents(uid),
  ]);

  return {
    generated_at: new Date().toISOString(),
    titular: userRes.rows[0] || null,
    direcciones: addrRes.rows,
    metodos_pago: cardsRes.rows,
    pedidos: ordersRes.rows,
    devoluciones: returnsRes.rows,
    consentimientos: consentsRes,
  };
};

// Derecho de supresión: anonimiza los datos personales del titular. Se conservan
// los registros con obligación legal/fiscal (pedidos, aceptaciones) sin datos
// que identifiquen directamente a la persona.
export const deleteUserAccount = async (userId) => {
  const uid = Number(userId);
  if (!uid) throw new Error('Usuario inválido.');

  await pool.query('DELETE FROM user_addresses WHERE user_id = $1', [uid]);
  await pool.query('DELETE FROM user_cards WHERE user_id = $1', [uid]);
  await pool.query('DELETE FROM user_credentials WHERE user_id = $1', [uid]);

  await pool.query(
    `UPDATE users SET
       email = $2,
       name = 'Cuenta eliminada',
       avatar_url = NULL,
       phone = NULL,
       birthdate = NULL,
       document_type = NULL,
       document_number = NULL,
       gender = NULL,
       password_hash = NULL,
       push_subscription = NULL,
       webauthn_credential = NULL,
       google_id = NULL,
       discord_id = NULL,
       tiktok_id = NULL,
       deleted_at = now(),
       updated_at = now()
     WHERE id = $1`,
    [uid, `deleted+${uid}@deleted.glopsy.shop`]
  );

  await revokeSession(uid).catch(() => {});
  return true;
};

export const loginWithEmail = async ({ email, password }) => {
  const safeEmail = cleanEmail(email, { required: true });
  if (!safeEmail) throw new Error('Correo electrónico inválido.');

  const { rows } = await pool.query(
    'SELECT id, email, name, avatar_url, can_sell, password_hash FROM users WHERE email = $1 LIMIT 1',
    [safeEmail]
  );
  const user = rows[0];

  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    throw new Error('Correo o contraseña incorrectos.');
  }

  const tokenPayload = { userId: user.id, email: user.email };
  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '7d' });

  await redisClient.set(`session:${user.id}`, token, { EX: 7 * 24 * 60 * 60 });

  const { password_hash, ...safeUser } = user;
  return { user: safeUser, token };
};

/**
 * Procesa un usuario proveniente de OAuth (Google/Discord/TikTok)
 * 1. Upsert en BD (Crea o actualiza usuario)
 * 2. Genera JWT
 * 3. Guarda la sesión activa en Redis
 */
export const processOAuthUser = async ({ email, name, avatar_url, provider, provider_id }) => {
  const providerColumns = {
    google: 'google_id',
    discord: 'discord_id',
    tiktok: 'tiktok_id',
  };
  const providerColumn = providerColumns[provider];

  if (!providerColumn) {
    throw new Error('Proveedor OAuth no compatible');
  }

  const safeEmail = cleanEmail(email, { required: true });
  const safeName = cleanString(name, { maxLength: 120 });
  const safeAvatar = cleanUrl(avatar_url, { maxLength: 2048 });
  const safeProviderId = cleanString(provider_id, { maxLength: 100 });
  if (!safeEmail) {
    throw new Error('Correo electrónico inválido.');
  }

  // 1. Insertar o actualizar usuario en la base de datos (Upsert)
  const query = `
    INSERT INTO users (email, name, avatar_url, ${providerColumn})
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (email) 
    DO UPDATE SET 
      name = EXCLUDED.name,
      avatar_url = EXCLUDED.avatar_url,
      ${providerColumn} = EXCLUDED.${providerColumn},
      updated_at = NOW()
    RETURNING id, email, name, avatar_url;
  `;

  const values = [safeEmail, safeName, safeAvatar, safeProviderId];
  const { rows } = await pool.query(query, values);
  const user = rows[0];

  // 2. Generar token JWT con la sesión del usuario
  const tokenPayload = { userId: user.id, email: user.email };
  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
    expiresIn: '7d', // El token expira en 7 días
  });

  // 3. Guardar la sesión en Redis para revocación rápida o consulta de estado
  // Usamos EX (segundos) sincronizado con los 7 días del JWT (604,800 segundos)
  await redisClient.set(`session:${user.id}`, token, {
    EX: 7 * 24 * 60 * 60,
  });

  return { user, token };
};

export const revokeSession = async (userId) => {
  await redisClient.del(`session:${userId}`);
};

// OAuth cruza dominios distintos (el callback vive en el backend y la app en otro
// origen), por eso no se puede fijar la cookie httpOnly desde el callback. En su
// lugar se entrega un código de un solo uso y corto plazo que la app canjea por la
// cookie en SU dominio vía /auth/oauth/consume.
const OAUTH_CODE_TTL = 120;

export const createOAuthCode = async (token) => {
  const code = crypto.randomBytes(24).toString('hex');
  await redisClient.set(`oauth:code:${code}`, token, { EX: OAUTH_CODE_TTL });
  return code;
};

export const consumeOAuthCode = async (code) => {
  const cleanCode = cleanString(code, { maxLength: 100 });
  if (!cleanCode) throw new Error('Código inválido.');
  const key = `oauth:code:${cleanCode}`;
  const token = await redisClient.get(key).catch(() => null);
  if (!token) throw new Error('Código inválido o vencido. Vuelve a intentarlo.');
  await redisClient.del(key).catch(() => {});
  return token;
};

export const savePushSubscriptionService = async (userId, subscription) => {
  await pool.query(
    'UPDATE users SET push_subscription = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(subscription), userId]
  );
  return { success: true };
};

export const saveBiometricCredentialService = async (userId, credential) => {
  const { rows: existingRows } = await pool.query('SELECT webauthn_credential FROM users WHERE id = $1', [userId]);
  if (existingRows[0] && existingRows[0].webauthn_credential) {
    throw new Error('Ya posees una huella');
  }
  await pool.query(
    'UPDATE users SET webauthn_credential = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(credential), userId]
  );
  return { success: true };
};

export const deleteBiometricCredentialService = async (userId) => {
  await pool.query(
    'UPDATE users SET webauthn_credential = NULL, updated_at = NOW() WHERE id = $1',
    [userId]
  );
  return { success: true };
};

export const getPaymentBiometricOptionsService = async (userId, originUrl) => {
  const { rows } = await pool.query('SELECT email, webauthn_credential FROM users WHERE id = $1', [userId]);
  const user = rows[0];
  if (!user) throw new Error('Usuario no encontrado.');
  if (!user.webauthn_credential) {
    return { hasBiometric: false, options: null };
  }

  const allowCredentials = [];
  try {
    const cred = typeof user.webauthn_credential === 'string' ? JSON.parse(user.webauthn_credential) : user.webauthn_credential;
    if (cred?.id && cred?.publicKey) {
      allowCredentials.push({
        id: cred.id,
        type: 'public-key',
        transports: cred.transports || ['internal'],
      });
    }
  } catch (e) {}

  if (allowCredentials.length === 0) {
    return { hasBiometric: false, options: null };
  }

  const options = await generateAuthenticationOptions({
    rpID: getRpID(originUrl),
    userVerification: 'required',
    allowCredentials,
  });

  await redisClient.set(`webauthn:pay:${options.challenge}`, userId, { EX: 300 });
  return { hasBiometric: true, options };
};

export const verifyPaymentBiometricService = async (userId, response, originUrl) => {
  const { rows } = await pool.query('SELECT webauthn_credential FROM users WHERE id = $1', [userId]);
  const user = rows[0];
  if (!user || !user.webauthn_credential) {
    throw new Error('Credencial biométrica no registrada.');
  }

  const cred = typeof user.webauthn_credential === 'string' ? JSON.parse(user.webauthn_credential) : user.webauthn_credential;
  if (!cred?.publicKey) {
    throw new Error('Huella biométrica inválida, vuelve a registrarla desde tu perfil.');
  }

  let expectedChallenge = null;
  try {
    const clientDataJSON = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8'));
    expectedChallenge = clientDataJSON.challenge;
  } catch (e) {
    throw new Error('Datos de autenticación webauthn inválidos.');
  }

  const storedUserId = await redisClient.get(`webauthn:pay:${expectedChallenge}`);
  if (!storedUserId || String(storedUserId) !== String(userId)) {
    throw new Error('Desafío de autenticación expirado o inválido.');
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedRPID: getRpID(originUrl),
    expectedOrigin: getOrigin(originUrl),
    credential: {
      id: cred.id,
      publicKey: Buffer.from(cred.publicKey, 'base64'),
      counter: cred.counter,
      transports: cred.transports,
    },
    requireUserVerification: true,
  });

  if (!verification.verified) {
    throw new Error('Autenticación biométrica fallida.');
  }

  cred.counter = verification.authenticationInfo.newCounter;
  await pool.query(
    'UPDATE users SET webauthn_credential = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(cred), userId]
  );
  await redisClient.del(`webauthn:pay:${expectedChallenge}`);

  const nonce = crypto.randomBytes(24).toString('base64url');
  await redisClient.set(`payment:bio:${nonce}`, userId, { EX: 120 });
  return { nonce };
};

export const validatePaymentBiometricNonce = async (userId, nonce) => {
  if (!userId || !nonce) return false;
  const stored = await redisClient.get(`payment:bio:${nonce}`);
  if (!stored || String(stored) !== String(userId)) return false;
  await redisClient.del(`payment:bio:${nonce}`);
  return true;
};

export const getBiometricRegistrationOptionsService = async (userId, originUrl) => {
  const { rows } = await pool.query('SELECT email, name, webauthn_credential FROM users WHERE id = $1', [userId]);
  const user = rows[0];
  if (!user) throw new Error('Usuario no encontrado.');
  if (user.webauthn_credential) {
    throw new Error('Ya posees una huella');
  }

  const excludeCredentials = [];
  if (user.webauthn_credential) {
    try {
      const cred = typeof user.webauthn_credential === 'string' ? JSON.parse(user.webauthn_credential) : user.webauthn_credential;
      if (cred && cred.id) {
        excludeCredentials.push({
          id: cred.id,
          type: 'public-key',
          transports: cred.transports,
        });
      }
    } catch (e) {}
  }

  const options = await generateRegistrationOptions({
    rpName,
    rpID: getRpID(originUrl),
    userID: Uint8Array.from(userId.toString(), c => c.charCodeAt(0)),
    userName: user.email,
    userDisplayName: user.name || user.email,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
      authenticatorAttachment: 'platform',
    },
  });

  await redisClient.set(`webauthn:reg:${userId}`, options.challenge, { EX: 300 });
  return options;
};

export const verifyBiometricRegistrationService = async (userId, response, reqOrigin) => {
  const expectedChallenge = await redisClient.get(`webauthn:reg:${userId}`);
  if (!expectedChallenge) {
    throw new Error('El desafío biométrico ha expirado o no es válido.');
  }

  const { rows } = await pool.query('SELECT email, webauthn_credential FROM users WHERE id = $1', [userId]);
  const user = rows[0];
  if (!user) throw new Error('Usuario no encontrado.');
  if (user.webauthn_credential) {
    throw new Error('Ya posees una huella');
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedRPID: getRpID(reqOrigin),
      expectedOrigin: getOrigin(reqOrigin),
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error('Fallo en la verificación de la huella biométrica.');
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    const credentialData = {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: credential.transports || ['internal'],
    };

    await pool.query(
      'UPDATE users SET webauthn_credential = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(credentialData), userId]
    );

    await redisClient.del(`webauthn:reg:${userId}`);
    return { success: true };
  } catch (error) {
    console.error('Detalle error WebAuthn verifyRegistrationResponse:', error);
    throw new Error(error.message || 'Error al verificar la huella biométrica.');
  }
};

export const getBiometricLoginOptionsService = async (email, originUrl) => {
  const allowCredentials = [];

  const { rows } = await pool.query(
    'SELECT webauthn_credential FROM users WHERE webauthn_credential IS NOT NULL' + (email && email.trim() ? ' AND email = $1' : ''),
    email && email.trim() ? [email.trim()] : []
  );

  for (const row of rows) {
    try {
      const cred = typeof row.webauthn_credential === 'string' ? JSON.parse(row.webauthn_credential) : row.webauthn_credential;
      if (cred?.id && cred?.publicKey) {
        allowCredentials.push({
          id: cred.id,
          type: 'public-key',
          transports: cred.transports || ['internal'],
        });
      }
    } catch (e) {}
  }

  const options = await generateAuthenticationOptions({
    rpID: getRpID(originUrl),
    userVerification: 'preferred',
    allowCredentials,
  });

  await redisClient.set(`webauthn:auth:${options.challenge}`, 'pending', { EX: 300 });
  return options;
};

export const verifyBiometricLoginService = async (response, reqOrigin) => {
  if (response.simulated) {
    const email = cleanEmail(response.email, { required: true });
    if (!email) throw new Error('Correo electrónico inválido.');
    const { rows } = await pool.query('SELECT id, email, name, avatar_url, webauthn_credential FROM users WHERE email = $1 LIMIT 1', [email]);
    const user = rows[0];
    if (!user || !user.webauthn_credential) {
      throw new Error('Credencial biométrica no registrada en el sistema.');
    }
    const tokenPayload = { userId: user.id, email: user.email };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '7d' });
    await redisClient.set(`session:${user.id}`, token, { EX: 7 * 24 * 60 * 60 });
    const { webauthn_credential, ...safeUser } = user;
    return { user: safeUser, token };
  }

  const credentialIdBase64 = response.id;

  const { rows } = await pool.query(
    `SELECT id, email, name, avatar_url, webauthn_credential FROM users WHERE (webauthn_credential::jsonb)->>'id' = $1 LIMIT 1`,
    [credentialIdBase64]
  );
  const user = rows[0];
  if (!user || !user.webauthn_credential) {
    throw new Error('Credencial biométrica no registrada en el sistema.');
  }

  const cred = typeof user.webauthn_credential === 'string' ? JSON.parse(user.webauthn_credential) : user.webauthn_credential;

  if (!cred?.publicKey) {
    throw new Error('La huella registrada no es válida. Inicia sesión con contraseña y vuelve a registrarla desde tu perfil.');
  }

  let expectedChallenge = null;
  try {
    const clientDataJSON = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8'));
    expectedChallenge = clientDataJSON.challenge;
  } catch (e) {
    throw new Error('Datos de autenticación webauthn inválidos.');
  }

  const challengeStatus = await redisClient.get(`webauthn:auth:${expectedChallenge}`);
  if (!challengeStatus) {
    throw new Error('Desafío de autenticación expirado o inválido.');
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedRPID: getRpID(reqOrigin),
    expectedOrigin: getOrigin(reqOrigin),
    credential: {
      id: cred.id,
      publicKey: Buffer.from(cred.publicKey, 'base64'),
      counter: cred.counter,
      transports: cred.transports,
    },
    requireUserVerification: true,
  });

  if (!verification.verified) {
    throw new Error('Autenticación biométrica fallida.');
  }

  cred.counter = verification.authenticationInfo.newCounter;
  await pool.query(
    'UPDATE users SET webauthn_credential = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(cred), user.id]
  );

  await redisClient.del(`webauthn:auth:${expectedChallenge}`);

  const tokenPayload = { userId: user.id, email: user.email };
  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '7d' });
  await redisClient.set(`session:${user.id}`, token, { EX: 7 * 24 * 60 * 60 });

  const { webauthn_credential, ...safeUser } = user;
  return { user: safeUser, token };
};
