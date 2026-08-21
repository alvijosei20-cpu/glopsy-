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

export const registerWithEmail = async ({ email, password, name }) => {
  const safeEmail = cleanEmail(email, { required: true });
  if (!safeEmail) throw new Error('Correo electrónico inválido.');
  const safeName = cleanString(name, { maxLength: 120 });

  const existing = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [safeEmail]);
  if (existing.rows[0]) {
    throw new Error('El correo electrónico ya está registrado.');
  }

  const password_hash = hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO users (email, name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, avatar_url`,
    [safeEmail, safeName || safeEmail.split('@')[0], password_hash]
  );
  const user = rows[0];

  const tokenPayload = { userId: user.id, email: user.email };
  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '7d' });

  await redisClient.set(`session:${user.id}`, token, { EX: 7 * 24 * 60 * 60 });

  return { user, token };
};

export const loginWithEmail = async ({ email, password }) => {
  const safeEmail = cleanEmail(email, { required: true });
  if (!safeEmail) throw new Error('Correo electrónico inválido.');

  const { rows } = await pool.query(
    'SELECT id, email, name, avatar_url, password_hash FROM users WHERE email = $1 LIMIT 1',
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
 * Procesa un usuario proveniente de OAuth (Google/Discord)
 * 1. Upsert en BD (Crea o actualiza usuario)
 * 2. Genera JWT
 * 3. Guarda la sesión activa en Redis
 */
export const processOAuthUser = async ({ email, name, avatar_url, provider, provider_id }) => {
  const providerColumns = {
    google: 'google_id',
    discord: 'discord_id',
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
