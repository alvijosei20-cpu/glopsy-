import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getBiometricRegistrationOptionsService, saveBiometricCredentialService } from '../services/auth.service.js';
import { pool } from '../db.js';
import { redisClient } from '../services/redis.service.js';

beforeEach(async () => {
  await pool.query('UPDATE users SET webauthn_credential = NULL WHERE id = 1');
});

test('getBiometricRegistrationOptionsService genera opciones y guarda challenge en redis', async () => {
  const userId = 1;
  const options = await getBiometricRegistrationOptionsService(userId);
  assert.ok(options);
  assert.ok(options.challenge);

  const challengeInRedis = await redisClient.get(`webauthn:reg:${userId}`);
  assert.equal(challengeInRedis, options.challenge);
});

test('saveBiometricCredentialService guarda la credencial correctamente en la base de datos', async () => {
  const userId = 1;
  const mockCredential = {
    id: 'test_credential_id_base64',
    publicKey: 'test_public_key_base64',
    counter: 0,
    transports: ['internal']
  };

  const res = await saveBiometricCredentialService(userId, mockCredential);
  assert.equal(res.success, true);

  const { rows } = await pool.query('SELECT webauthn_credential FROM users WHERE id = $1', [userId]);
  assert.ok(rows[0].webauthn_credential);
  
  const saved = typeof rows[0].webauthn_credential === 'string' 
    ? JSON.parse(rows[0].webauthn_credential) 
    : rows[0].webauthn_credential;
    
  assert.equal(saved.id, 'test_credential_id_base64');
  assert.equal(saved.publicKey, 'test_public_key_base64');
});

test('saveBiometricCredentialService rechaza si el usuario ya posee una huella', async () => {
  const userId = 1;
  const mockCredential = {
    id: 'test_credential_id_base64_2',
    publicKey: 'test_public_key_base64_2',
    counter: 0,
    transports: ['internal']
  };

  // Primer registro exitoso
  await saveBiometricCredentialService(userId, mockCredential);

  // Segundo registro debe fallar con "Ya posees una huella"
  await assert.rejects(
    async () => {
      await saveBiometricCredentialService(userId, mockCredential);
    },
    /Ya posees una huella/
  );
});

after(async () => {
  await pool.end();
  await redisClient.quit();
});
