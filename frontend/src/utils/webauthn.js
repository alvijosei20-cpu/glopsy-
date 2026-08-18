import api from '../services/api';

export function bufferDecode(value) {
  if (!value) return value;
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return value;
  }
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bufferToBase64Url(buffer) {
  if (typeof buffer === 'string') return buffer;
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function buildAuthResponse(credential) {
  return {
    id: credential.id,
    rawId: credential.id,
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
      authenticatorData: bufferToBase64Url(credential.response.authenticatorData),
      signature: bufferToBase64Url(credential.response.signature),
      userHandle: credential.response.userHandle ? bufferToBase64Url(credential.response.userHandle) : null,
    },
  };
}

export async function assertWebAuthn(publicKeyOptions) {
  if (!window.PublicKeyCredential) {
    throw new Error('Tu navegador no soporta autenticación biométrica (WebAuthn).');
  }
  const publicKey = {
    ...publicKeyOptions,
    challenge: bufferDecode(publicKeyOptions.challenge),
    allowCredentials: (publicKeyOptions.allowCredentials || []).map(c => ({
      ...c,
      id: bufferDecode(c.id),
    })),
  };
  return navigator.credentials.get({ publicKey });
}

export async function requireBiometricPayment() {
  const token = localStorage.getItem('token');
  if (!token) return { needed: false, nonce: null };

  try {
    const resOptions = await api.post('/auth/biometric/pay-options');
    if (!resOptions.data.ok || !resOptions.data.hasBiometric) {
      return { needed: false, nonce: null };
    }
    const credential = await assertWebAuthn(resOptions.data.options);
    const authResponse = await buildAuthResponse(credential);
    const resVerify = await api.post('/auth/biometric/pay-verify', authResponse);
    if (resVerify.data.ok && resVerify.data.nonce) {
      return { needed: true, nonce: resVerify.data.nonce };
    }
    throw new Error('No se pudo validar la huella.');
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      return { needed: true, cancelled: true };
    }
    throw err;
  }
}
