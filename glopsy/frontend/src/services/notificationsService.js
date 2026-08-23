import api from './api';
import { getDeviceId } from '../utils/device';

export async function fetchNotifications() {
  const { data } = await api.get('/notifications', {
    headers: { 'X-Device-Id': getDeviceId() },
  });
  return data.notifications || [];
}

export async function markNotificationRead(id) {
  await api.post(`/notifications/${id}/read`, null, {
    headers: { 'X-Device-Id': getDeviceId() },
  });
}

export async function markAllNotificationsRead() {
  await api.post('/notifications/read-all', null, {
    headers: { 'X-Device-Id': getDeviceId() },
  });
}

export async function clearAllNotifications() {
  await api.post('/notifications/clear', null, {
    headers: { 'X-Device-Id': getDeviceId() },
  });
}
