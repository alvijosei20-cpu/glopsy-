import crypto from 'node:crypto';

const PREFIX = 'v1:';

const getKey = () => {
  const raw = process.env.APP_ENC_KEY;
  if (!raw || String(raw).trim() === '') {
    throw new Error('APP_ENC_KEY no está configurada en el entorno. Agrega una clave maestra al .env');
  }
  return crypto.createHash('sha256').update(String(raw)).digest();
};

export const isEncryptedSecret = (value) =>
  Boolean(value) && typeof value === 'string' && value.startsWith(PREFIX);

export const encryptSecret = (plain) => {
  if (plain === undefined || plain === null || String(plain) === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
};

export const decryptSecret = (stored) => {
  if (!stored) return null;
  const value = String(stored);
  if (!isEncryptedSecret(value)) return value;
  const [, ivB64, tagB64, dataB64] = value.split(':');
  if (!ivB64 || !tagB64 || !dataB64) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch (err) {
    console.error('No fue posible descifrar el secreto:', err.message);
    return null;
  }
};

export const maskSecret = (value) => {
  if (!value) return '';
  const s = String(value);
  if (s.length <= 8) return '••••';
  return `${s.slice(0, 4)}••••${s.slice(-4)}`;
};

export default { encryptSecret, decryptSecret, maskSecret, isEncryptedSecret };
