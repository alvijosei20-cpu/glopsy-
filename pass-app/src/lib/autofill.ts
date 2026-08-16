import { NativeModules, Platform } from 'react-native';

export interface FillContext {
  webDomain: string;
  packageName: string;
}

const M = NativeModules.PassAutofill as {
  getFillContext?: () => Promise<FillContext | null>;
  completeFill?: (username: string, password: string) => Promise<boolean>;
  cancelFill?: () => Promise<void>;
  finishActivity?: () => Promise<void>;
  openSystemSettings?: () => Promise<boolean>;
} | null;

export const isAutofillSupported = Platform.OS === 'android' && !!M;

export function autofillStatus(): 'ok' | 'not-android' | 'not-built' {
  if (Platform.OS !== 'android') return 'not-android';
  return M ? 'ok' : 'not-built';
}

export async function getFillContext(): Promise<FillContext | null> {
  try {
    if (!M?.getFillContext) return null;
    const ctx = await M.getFillContext();
    return ctx && (ctx.webDomain || ctx.packageName) ? ctx : null;
  } catch {
    return null;
  }
}

export async function completeFill(username: string, password: string): Promise<boolean> {
  try {
    if (!M?.completeFill) return false;
    return (await M.completeFill(username, password)) === true;
  } catch {
    return false;
  }
}

export async function cancelFill(): Promise<void> {
  try {
    await M?.cancelFill?.();
  } catch {}
}

export async function finishAutofill(): Promise<void> {
  try {
    await M?.finishActivity?.();
  } catch {}
}

export async function openAutofillSettings(): Promise<boolean> {
  try {
    if (!M?.openSystemSettings) return false;
    return (await M.openSystemSettings()) === true;
  } catch {
    return false;
  }
}
