import crypto from 'crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

function signJwt(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const data = `${b64(header)}.${b64(claims)}`;
  const sig = crypto.createSign('RSA-SHA256').update(data).sign(privateKey);
  return `${data}.${sig.toString('base64url')}`;
}

async function getAccessToken() {
  const clientEmail = process.env.GA4_CLIENT_EMAIL;
  const privateKey = (process.env.GA4_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!clientEmail || !privateKey || !propertyId) return null;

  const assertion = signJwt(clientEmail, privateKey);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`GA token error HTTP ${res.status}`);
  const data = await res.json();
  return { token: data.access_token, propertyId };
}

export async function getActiveUsers() {
  const auth = await getAccessToken();
  if (!auth) return null;

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${auth.propertyId}:runRealtimeReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ metrics: [{ name: 'activeUsers' }] }),
    }
  );
  if (!res.ok) throw new Error(`GA realtime error HTTP ${res.status}`);
  const data = await res.json();
  const value = data?.rows?.[0]?.metricValues?.[0]?.value;
  return value === undefined ? null : Number(value);
}
