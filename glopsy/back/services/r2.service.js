import crypto from 'node:crypto';

// Almacenamiento de imágenes en Cloudflare R2 (S3-compatible) con firma AWS SigV4.
// No usa SDK para mantener el backend liviano; solo requiere las variables R2_*.

const sha256hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

const config = () => ({
  accountId: process.env.R2_ACCOUNT_ID || '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  bucket: process.env.R2_BUCKET || '',
  publicUrl: (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, ''),
});

export const isR2Configured = () => {
  const c = config();
  return Boolean(c.accountId && c.accessKeyId && c.secretAccessKey && c.bucket && c.publicUrl);
};

const encodeKey = (key) => key.split('/').map(encodeURIComponent).join('/');

// Sube un buffer (ya en webp) y devuelve la URL pública servida por el CDN.
export const uploadProductImage = async (buffer, { contentType = 'image/webp' } = {}) => {
  const c = config();
  if (!c.accountId || !c.accessKeyId || !c.secretAccessKey || !c.bucket) {
    throw new Error('El almacenamiento de imágenes no está configurado.');
  }

  const host = `${c.accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const key = `products/${y}/${m}/${crypto.randomBytes(16).toString('hex')}.webp`;

  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex(buffer);
  const canonicalUri = `/${c.bucket}/${encodeKey(key)}`;
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `PUT\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256hex(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${c.secretAccessKey}`, dateStamp), region), service), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${c.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${host}${canonicalUri}`, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
    },
    body: buffer,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`No se pudo subir la imagen a R2 (${res.status}). ${detail}`.trim());
  }

  return c.publicUrl ? `${c.publicUrl}/${key}` : key;
};
