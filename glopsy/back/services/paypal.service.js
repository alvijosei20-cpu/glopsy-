// Integración con PayPal (Orders v2) para cobrar en USD (Venezuela).
// Modo 'produccion' usa api-m.paypal.com; cualquier otro usa el sandbox.
// Credenciales por tienda: public_key = client_id, access_token = secret.
const PAYPAL_LIVE = 'https://api-m.paypal.com';
const PAYPAL_SANDBOX = 'https://api-m.sandbox.paypal.com';

const tokenCache = new Map(); // clientId -> { token, expiresAt }

const baseUrl = (mode) => (String(mode).toLowerCase() === 'produccion' ? PAYPAL_LIVE : PAYPAL_SANDBOX);

export const getPaypalAccessToken = async (clientId, secret, mode) => {
  const cacheKey = `${mode}:${clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30000) return cached.token;

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${baseUrl(mode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || 'No se pudo autenticar con PayPal.');
  }
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  });
  return data.access_token;
};

// Crea una orden de PayPal. amount en USD (número).
export const createPaypalOrder = async ({ clientId, secret, mode, amount, currency = 'USD', referenceId, description }) => {
  const token = await getPaypalAccessToken(clientId, secret, mode);
  const value = (Math.round(Number(amount) * 100) / 100).toFixed(2);
  const res = await fetch(`${baseUrl(mode)}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: referenceId || undefined,
        description: description ? String(description).slice(0, 127) : undefined,
        amount: { currency_code: currency, value },
      }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || 'No se pudo crear la orden de PayPal.');
  return data;
};

export const capturePaypalOrder = async ({ clientId, secret, mode, orderId }) => {
  const token = await getPaypalAccessToken(clientId, secret, mode);
  const res = await fetch(`${baseUrl(mode)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || 'No se pudo capturar el pago de PayPal.');
  return data;
};

export const isPaypalCompleted = (order) =>
  order?.status === 'COMPLETED' || order?.status === 'APPROVED';
