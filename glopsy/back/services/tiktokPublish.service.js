// ==========================================
// TikTok Content Posting API — subida a la bandeja de borradores (video.upload).
//
// Flujo:
//   1. OAuth (scope video.upload) -> guardamos el access_token del creador.
//   2. POST /v2/post/publish/inbox/video/init/ con source FILE_UPLOAD.
//   3. PUT del archivo al upload_url.
//   4. El creador entra a su bandeja de TikTok y termina de publicar.
//
// Doc: https://developers.tiktok.com/doc/content-posting-api-reference-upload-video/
// ==========================================

import axios from 'axios';
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';
import { getOAuthConfig } from './oauthConfig.service.js';

const OPEN_API = 'https://open.tiktokapis.com';
const AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const SCOPES = 'user.info.basic,video.upload';

const secret = () => process.env.JWT_SECRET || process.env.APP_ENC_KEY || 'glopsy';

// state firmado: {userId, redirectUri, ts} -> "<b64>.<hmac>"
export const buildState = (payload) => {
  const b64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(b64).digest('base64url');
  return `${b64}.${sig}`;
};

export const parseState = (state) => {
  const [b64, sig] = String(state || '').split('.');
  if (!b64 || !sig) return null;
  const expected = crypto.createHmac('sha256', secret()).update(b64).digest('base64url');
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(b64, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
};

export const getTikTokIntegration = async (tiendaId) => {
  if (!tiendaId) return null;
  const { rows } = await pool.query(
    `SELECT tienda_id, open_id, access_token, refresh_token, scope, expires_at
     FROM tiktok_accounts WHERE tienda_id = $1 LIMIT 1`,
    [Number(tiendaId)]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    tiendaId: Number(r.tienda_id),
    openId: r.open_id,
    accessToken: decryptSecret(r.access_token),
    refreshToken: r.refresh_token ? decryptSecret(r.refresh_token) : null,
    scope: r.scope,
    expiresAt: r.expires_at,
  };
};

export const saveTikTokIntegration = async (tiendaId, { openId, accessToken, refreshToken, scope, expiresIn }) => {
  const expiresAt = expiresIn ? new Date(Date.now() + Number(expiresIn) * 1000) : null;
  await pool.query(
    `INSERT INTO tiktok_accounts (tienda_id, open_id, access_token, refresh_token, scope, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (tienda_id) DO UPDATE SET
       open_id = EXCLUDED.open_id,
       access_token = EXCLUDED.access_token,
       refresh_token = COALESCE(EXCLUDED.refresh_token, tiktok_accounts.refresh_token),
       scope = EXCLUDED.scope,
       expires_at = EXCLUDED.expires_at,
       updated_at = now()`,
    [Number(tiendaId), openId, encryptSecret(accessToken), refreshToken ? encryptSecret(refreshToken) : null, scope || SCOPES, expiresAt]
  );
};

export const deleteTikTokIntegration = async (tiendaId) => {
  const { rows } = await pool.query(`DELETE FROM tiktok_accounts WHERE tienda_id = $1 RETURNING tienda_id`, [Number(tiendaId)]);
  return Boolean(rows[0]);
};

export const buildAuthorizeUrl = async ({ redirectUri, state }) => {
  const cfg = await getOAuthConfig('tiktok');
  if (!cfg?.clientId || !cfg?.clientSecret) throw new Error('TikTok no está configurado (Auth del admin).');
  const params = new URLSearchParams({
    client_key: cfg.clientId,
    response_type: 'code',
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
};

export const exchangeCode = async ({ code, redirectUri }) => {
  const cfg = await getOAuthConfig('tiktok');
  if (!cfg?.clientId || !cfg?.clientSecret) throw new Error('TikTok no está configurado.');
  const body = new URLSearchParams({
    client_key: cfg.clientId,
    client_secret: cfg.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  const { data } = await axios.post(`${OPEN_API}/v2/oauth/token/`, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
  });
  return data;
};

// Sube un video a la bandeja de borradores del creador. Devuelve { publishId }.
export const uploadVideoToInbox = async ({ accessToken, videoBuffer, contentType = 'video/mp4' }) => {
  if (!accessToken) throw new Error('Falta el token de TikTok.');
  if (!videoBuffer?.length) throw new Error('Video vacío.');
  const videoSize = videoBuffer.length;
  const chunkSize = videoSize; // un solo chunk

  const { data } = await axios.post(
    `${OPEN_API}/v2/post/publish/inbox/video/init/`,
    { source_info: { source: 'FILE_UPLOAD', video_size: videoSize, chunk_size: chunkSize, total_chunk_count: 1 } },
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' }, timeout: 20000 }
  );
  if (data?.error?.code && data.error.code !== 'ok') {
    throw new Error(`TikTok: ${data.error.message || data.error.code}`);
  }
  const { publish_id: publishId, upload_url: uploadUrl } = data?.data || {};
  if (!uploadUrl) throw new Error('TikTok no devolvió upload_url.');

  await axios.put(uploadUrl, videoBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': videoSize,
      'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 60000,
  });

  return { publishId };
};

// Carrusel de fotos a la bandeja de borradores (PULL_FROM_URL; las URLs deben
// ser de un dominio verificado en TikTok). Devuelve { publishId }.
export const postPhotoCarousel = async ({ accessToken, title = null, description = null, imageUrls = [], coverIndex = 0 }) => {
  if (!accessToken) throw new Error('Falta el token de TikTok.');
  const imgs = (Array.isArray(imageUrls) ? imageUrls : []).filter(Boolean).slice(0, 35);
  if (imgs.length === 0) throw new Error('Sin imágenes para el carrusel.');
  const { data } = await axios.post(
    `${OPEN_API}/v2/post/publish/content/init/`,
    {
      media_type: 'PHOTO',
      post_mode: 'MEDIA_UPLOAD',
      post_info: {
        ...(title ? { title: String(title).slice(0, 90) } : {}),
        ...(description ? { description: String(description).slice(0, 4000) } : {}),
      },
      source_info: { source: 'PULL_FROM_URL', photo_cover_index: Math.max(0, Number(coverIndex) || 0), photo_images: imgs },
    },
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' }, timeout: 20000 }
  );
  if (data?.error?.code && data.error.code !== 'ok') {
    throw new Error(`TikTok: ${data.error.message || data.error.code}`);
  }
  const publishId = data?.data?.publish_id;
  if (!publishId) throw new Error('TikTok no devolvió publish_id.');
  return { publishId };
};

export const fetchPublishStatus = async ({ accessToken, publishId }) => {
  const { data } = await axios.post(
    `${OPEN_API}/v2/post/publish/status/fetch/`,
    { publish_id: publishId },
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 15000 }
  );
  return data?.data || null;
};

export default {
  buildState,
  parseState,
  getTikTokIntegration,
  saveTikTokIntegration,
  deleteTikTokIntegration,
  buildAuthorizeUrl,
  exchangeCode,
  uploadVideoToInbox,
  postPhotoCarousel,
  fetchPublishStatus,
};
