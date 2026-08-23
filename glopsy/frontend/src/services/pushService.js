import api from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function getVapidKey() {
  const { data } = await api.get('/push/vapid-key');
  return data.publicKey;
}

export async function savePushSubscription(subscription) {
  await api.post('/auth/push-subscription', subscription);
}

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return null;
  }
  if (Notification.permission !== 'granted') return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      try { await savePushSubscription(existing); } catch {}
      return existing;
    }
    const publicKey = await getVapidKey();
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    try { await savePushSubscription(subscription); } catch {}
    return subscription;
  } catch (err) {
    console.warn('[push] Error al suscribirse:', err.message);
    return null;
  }
}
