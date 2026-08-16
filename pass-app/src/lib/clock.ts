// Reloj sincronizado con WorldTimeAPI (epoch UNIX en ms).
// Evita que el usuario manipule la hora del dispositivo para saltarse
// los bloqueos por intentos fallidos. Si no hay red, usa la hora local.

let offset = 0; // serverMs - localMs
let synced = false;

export async function syncClock(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch('https://worldtimeapi.org/api/ip', { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const data = await res.json();
    if (typeof data?.unixtime === 'number') {
      offset = data.unixtime * 1000 - Date.now();
      synced = true;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Tiempo actual en ms (epoch), sincronizado si fue posible. */
export function serverNow(): number {
  return Date.now() + offset;
}

export function isClockSynced(): boolean {
  return synced;
}

/** Fuerza el siguiente serverNow() a usar la hora local. */
export function resetClockOffset(): void {
  offset = 0;
  synced = false;
}
