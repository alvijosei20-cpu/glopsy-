let cached = null;

export function getDeviceId() {
  if (cached) return cached;
  try {
    let id = localStorage.getItem('glopsy_device_id');
    if (!id) {
      id = crypto.randomUUID
        ? crypto.randomUUID()
        : 'd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
      localStorage.setItem('glopsy_device_id', id);
    }
    cached = id;
    return id;
  } catch {
    return 'd-' + Date.now().toString(36);
  }
}
