import { NativeModules, Platform } from 'react-native';

const M = NativeModules.PassDeviceBinding as {
  getDeviceId?: () => Promise<string>;
  sign?: (data: string) => Promise<string>;
} | null;

export const deviceBindingAvailable = Platform.OS === 'android' && !!M;

export async function getDeviceId(): Promise<string | null> {
  try {
    if (!M?.getDeviceId) return null;
    const id = await M.getDeviceId();
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

export async function signWithDeviceKey(data: string): Promise<string | null> {
  try {
    if (!M?.sign) return null;
    const sig = await M.sign(data);
    return typeof sig === 'string' && sig.length > 0 ? sig : null;
  } catch {
    return null;
  }
}
