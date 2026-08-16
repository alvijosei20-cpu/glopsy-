import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode } from '../types';
import { serverNow } from './clock';

const THEME_KEY = 'pass.theme';
const LAST_USER_KEY = 'pass.lastUser';
const LOCK_PREFIX = 'pass.lock.';
const BIOMETRIC_KEY = 'pass.biometric';

// Seguridad: 3 intentos fallidos y bloqueo de 10 minutos.
export const MAX_ATTEMPTS = 3;
export const LOCK_DURATION = 10 * 60 * 1000; // 10 min en ms

export async function getTheme(): Promise<ThemeMode> {
  try {
    const t = await AsyncStorage.getItem(THEME_KEY);
    return t === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export async function setTheme(t: ThemeMode): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_KEY, t);
  } catch {}
}

export async function rememberLastUser(username: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_USER_KEY, username);
  } catch {}
}

export async function lastUser(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

export async function forgetLastUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_USER_KEY);
  } catch {}
}

export async function getBiometricEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(BIOMETRIC_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function setBiometricEnabled(v: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(BIOMETRIC_KEY, v ? '1' : '0');
  } catch {}
}

interface LockState {
  attempts: number;
  until: number;
  level: number;
}

async function getLock(username: string): Promise<LockState> {
  try {
    const raw = await AsyncStorage.getItem(LOCK_PREFIX + username);
    const l = raw ? JSON.parse(raw) : null;
    if (l && l.until && l.until > serverNow()) return l;
    if (l) return { attempts: 0, until: 0, level: l.level || 0 };
  } catch {}
  return { attempts: 0, until: 0, level: 0 };
}

async function setLock(username: string, lock: LockState): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCK_PREFIX + username, JSON.stringify(lock));
  } catch {}
}

export async function clearLock(username: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOCK_PREFIX + username);
  } catch {}
}

export async function lockRemaining(username: string): Promise<number> {
  const l = await getLock(username);
  const rem = l.until - serverNow();
  return rem > 0 ? rem : 0;
}

export async function registerFailedAttempt(username: string): Promise<number> {
  const l = await getLock(username);
  l.attempts = (l.attempts || 0) + 1;
  if (l.attempts >= MAX_ATTEMPTS) {
    // Bloqueo fijo de LOCK_DURATION (10 min), sin crecimiento exponencial.
    l.until = serverNow() + LOCK_DURATION;
    l.attempts = 0;
    await setLock(username, l);
    return lockRemaining(username);
  }
  await setLock(username, l);
  return -l.attempts; // negativo = intentos restantes
}

export function formatLockTime(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s >= 60) return Math.round(s / 60) + ' min';
  return s + ' s';
}
