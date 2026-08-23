import { randomUUID, createHash } from 'crypto';
import { redisClient } from './redis.service.js';

const INDEX_KEY = 'notify:index';
const metaKey = (id) => `notify:meta:${id}`;
const seenKey = (id) => `notify:seen:${id}`;

const TYPES = new Set(['aviso', 'link', 'app']);

export function normalize(data = {}) {
  const notif = {
    id: data.id || randomUUID(),
    type: TYPES.has(data.type) ? data.type : 'aviso',
    title: String(data.title || '').trim().slice(0, 160),
    message: String(data.message || '').trim().slice(0, 2000),
    url: data.url ? String(data.url).trim().slice(0, 1000) : null,
    external: Boolean(data.external),
    scheme: data.scheme ? String(data.scheme).trim().slice(0, 1000) : null,
    fallbackUrl: data.fallbackUrl ? String(data.fallbackUrl).trim().slice(0, 1000) : null,
    target: data.target === 'user' ? 'user' : 'global',
    userId: data.userId ? Number(data.userId) : null,
    active: data.active !== false,
    createdAt: Number(data.createdAt) || Date.now(),
    expiresAt: data.expiresAt ? Number(data.expiresAt) : null,
  };
  return notif;
}

export async function createNotification(data) {
  const notif = normalize(data);
  if (!notif.title) throw new Error('El título es obligatorio.');
  if (!notif.message) throw new Error('El mensaje es obligatorio.');
  if (notif.type === 'link' && !notif.url) throw new Error('La URL es obligatoria para notificaciones tipo link.');
  if (notif.type === 'app' && !notif.scheme) throw new Error('El esquema de la app es obligatorio.');
  if (notif.target === 'user' && !notif.userId) throw new Error('Debes seleccionar un usuario.');

  const multi = redisClient.multi();
  multi.set(metaKey(notif.id), JSON.stringify(notif));
  multi.zAdd(INDEX_KEY, { score: notif.createdAt, value: notif.id });
  if (notif.expiresAt) {
    const ttl = Math.max(1, Math.round((notif.expiresAt - Date.now()) / 1000));
    multi.pExpire(metaKey(notif.id), ttl * 1000);
  }
  await multi.exec();
  return notif;
}

export async function listAll() {
  const ids = await redisClient.zRange(INDEX_KEY, 0, -1, { REV: true });
  if (!ids.length) return [];
  const metas = await redisClient.mGet(ids.map(metaKey));
  const result = [];
  const toDelete = [];
  for (let i = 0; i < ids.length; i++) {
    if (!metas[i]) continue;
    let n;
    try { n = JSON.parse(metas[i]); } catch { toDelete.push(ids[i]); continue; }
    if (n.expiresAt && n.expiresAt < Date.now()) { toDelete.push(ids[i]); continue; }
    result.push(n);
  }
  if (toDelete.length) await deleteNotifications(toDelete);
  return result;
}

export async function listForClient({ clientKey, userId }) {
  const ids = await redisClient.zRange(INDEX_KEY, 0, -1, { REV: true });
  if (!ids.length) return [];
  const metas = await redisClient.mGet(ids.map(metaKey));
  const parsed = [];
  const toDelete = [];
  for (let i = 0; i < ids.length; i++) {
    if (!metas[i]) continue;
    let n;
    try { n = JSON.parse(metas[i]); } catch { toDelete.push(ids[i]); continue; }
    if (n.expiresAt && n.expiresAt < Date.now()) { toDelete.push(ids[i]); continue; }
    if (!n.active) continue;
    if (n.target === 'user' && (!userId || String(n.userId) !== String(userId))) continue;
    parsed.push({ id: ids[i], n });
  }
  const pipe = redisClient.multi();
  for (const { id } of parsed) pipe.sIsMember(seenKey(id), clientKey);
  const seenFlags = await pipe.exec();
  const result = parsed.map(({ id, n }, idx) => ({ ...n, read: Boolean(seenFlags[idx]) }));
  if (toDelete.length) await deleteNotifications(toDelete);
  return result;
}

export async function markRead(id, clientKey) {
  const exists = await redisClient.exists(metaKey(id));
  if (!exists) return false;
  await redisClient.sAdd(seenKey(id), clientKey);
  return true;
}

export async function getSeenCounts(notifs) {
  if (!notifs.length) return new Map();
  const pipe = redisClient.multi();
  for (const n of notifs) pipe.sCard(seenKey(n.id));
  const counts = await pipe.exec();
  const map = new Map();
  notifs.forEach((n, i) => map.set(n.id, Number(counts[i] || 0)));
  return map;
}

export async function updateNotification(id, patch) {
  const raw = await redisClient.get(metaKey(id));
  if (!raw) return null;
  const current = JSON.parse(raw);
  const merged = normalize({ ...current, ...patch, id: current.id, createdAt: current.createdAt });
  await redisClient.set(metaKey(id), JSON.stringify(merged));
  if (merged.expiresAt) {
    const ttl = Math.max(1, Math.round((merged.expiresAt - Date.now()) / 1000));
    await redisClient.pExpire(metaKey(id), ttl * 1000);
  }
  return merged;
}

export async function deleteNotifications(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  if (!list.length) return;
  const multi = redisClient.multi();
  for (const id of list) {
    multi.del(metaKey(id));
    multi.del(seenKey(id));
    multi.zRem(INDEX_KEY, id);
  }
  await multi.exec();
}

export function clientKeyFor(req) {
  if (req.auth?.userId != null) {
    return { key: `u:${req.auth.userId}`, userId: String(req.auth.userId) };
  }
  const device = req.headers['x-device-id'];
  if (device) return { key: `d:${String(device).slice(0, 64)}`, userId: null };
  const ip = req.ip || '0';
  const ua = req.get('user-agent') || '';
  return {
    key: 'd:' + createHash('sha256').update(ip + ua).digest('hex').slice(0, 32),
    userId: null,
  };
}
