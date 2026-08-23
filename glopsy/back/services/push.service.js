import fs from 'fs';
import path from 'path';
import webpush from 'web-push';
import { pool } from '../db.js';

const VAPID_PATH = path.resolve('config/vapid.json');
let vapidKeys = null;

function loadVapidKeys() {
  if (vapidKeys) return vapidKeys;
  const envKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  };
  if (envKeys.publicKey && envKeys.privateKey) {
    vapidKeys = {
      publicKey: envKeys.publicKey,
      privateKey: envKeys.privateKey,
      subject: envKeys.subject || 'mailto:soporte@glopsy.com',
    };
    return vapidKeys;
  }
  try {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_PATH, 'utf8'));
  } catch {
    vapidKeys = webpush.generateVAPIDKeys();
    vapidKeys.subject = 'mailto:soporte@glopsy.com';
    try {
      fs.mkdirSync(path.dirname(VAPID_PATH), { recursive: true });
      fs.writeFileSync(VAPID_PATH, JSON.stringify(vapidKeys, null, 2));
    } catch {}
  }
  return vapidKeys;
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || loadVapidKeys().subject,
  loadVapidKeys().publicKey,
  loadVapidKeys().privateKey
);

export function getVapidPublicKey() {
  return loadVapidKeys().publicKey;
}

async function parseSubscription(sub) {
  if (!sub || !sub.endpoint) return null;
  return {
    endpoint: String(sub.endpoint),
    expirationTime: sub.expirationTime != null ? Number(sub.expirationTime) : null,
    keys: {
      p256dh: String(sub.keys?.p256dh || ''),
      auth: String(sub.keys?.auth || ''),
    },
  };
}

async function sendToSubscription(subscription, payload) {
  if (!subscription) return false;
  const parsed = await parseSubscription(subscription);
  if (!parsed) return false;
  try {
    await webpush.sendNotification(parsed, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
    return true;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) return false;
    console.warn('[push] Error enviando push:', err.message);
    return false;
  }
}

async function removeInvalidSubscription(subscription) {
  if (!subscription || !subscription.endpoint) return;
  try {
    await pool.query(
      `UPDATE users SET push_subscription = NULL WHERE push_subscription->>'endpoint' = $1`,
      [subscription.endpoint]
    );
  } catch {}
}

export async function sendPushToUser(userId, payload) {
  try {
    const { rows } = await pool.query('SELECT push_subscription FROM users WHERE id = $1', [userId]);
    const sub = rows[0]?.push_subscription;
    const ok = await sendToSubscription(sub, payload);
    if (!ok && sub) await removeInvalidSubscription(sub);
    return ok;
  } catch (err) {
    console.warn('[push] Error enviando push a usuario:', err.message);
    return false;
  }
}

export async function sendPushToAll(payload) {
  try {
    const { rows } = await pool.query(
      'SELECT push_subscription FROM users WHERE push_subscription IS NOT NULL'
    );
    const invalid = [];
    const results = await Promise.all(
      rows.map(async (r) => {
        const ok = await sendToSubscription(r.push_subscription, payload);
        if (!ok) invalid.push(r.push_subscription);
        return ok;
      })
    );
    await Promise.all(invalid.map(removeInvalidSubscription));
    return results.filter(Boolean).length;
  } catch (err) {
    console.warn('[push] Error enviando push global:', err.message);
    return 0;
  }
}
