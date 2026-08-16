import { NativeModules, Platform } from 'react-native';

const M = NativeModules.PassSecurity as { setSecureFlag?: (enabled: boolean, cb?: (ok: boolean) => void) => void } | null;

let count = 0;
let applied = false;

/**
 * Activa/desactiva FLAG_SECURE por refcount. Varias pantallas sensibles
 * pueden estar montadas a la vez (p.ej. Vault bajo un modal de ItemDetail):
 * solo se desactiva cuando la última pantalla sensible pierde el foco.
 * Dejar FLAG_SECURE activo en login/registro/autofill bloquearía el overlay
 * de gestores de contraseñas externos.
 */
export function secureScreen(enabled: boolean): void {
  if (Platform.OS !== 'android' || !M?.setSecureFlag) return;
  count = Math.max(0, count + (enabled ? 1 : -1));
  const next = count > 0;
  if (next === applied) return;
  applied = next;
  M.setSecureFlag(next);
}
