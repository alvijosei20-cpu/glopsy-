import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'pass.session';

/**
 * Guarda la clave descifrada en SecureStore (Keystore del sistema) para que
 * abrir la app no obligue a repetir la derivación PBKDF2 (lenta en JS).
 */
export async function saveSession(user: string, keyB64: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ user, key: keyB64 }));
  } catch {}
}

export async function loadSession(): Promise<{ user: string; keyB64: string } | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.user || !s.key) return null;
    return { user: s.user, keyB64: s.key };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {}
}
