import axios from 'axios';
import { pool } from '../db.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';

const GRAPH_VERSION = process.env.FB_GRAPH_VERSION || 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
const GRAPH_TIMEOUT = 20000;

const graphError = (err, fallback = 'No fue posible conectar con Facebook.') => {
  const detail =
    err?.response?.data?.error?.message ||
    err?.message ||
    fallback;
  return new Error(`Facebook: ${String(detail).slice(0, 300)}`);
};

const get = async (path, params) => {
  try {
    const { data } = await axios.get(`${GRAPH_URL}/${path}`, { params, timeout: GRAPH_TIMEOUT });
    return data;
  } catch (err) {
    throw graphError(err);
  }
};

// ------------------------------------------------------------------ DB

export const getFacebookPageForTienda = async (tiendaId) => {
  const { rows } = await pool.query(
    `SELECT id, tienda_id, fb_page_id, fb_page_name, fb_user_name, access_token,
            created_at, updated_at
     FROM facebook_pages WHERE tienda_id = $1 LIMIT 1`,
    [tiendaId]
  );
  if (!rows[0]) return null;
  return { ...rows[0], access_token: decryptSecret(rows[0].access_token) };
};

export const getFacebookPageStatus = async (tiendaId) => {
  const { rows } = await pool.query(
    `SELECT fb_page_id, fb_page_name, fb_user_name, created_at
     FROM facebook_pages WHERE tienda_id = $1 LIMIT 1`,
    [tiendaId]
  );
  if (!rows[0]) return null;
  return { connected: true, ...rows[0] };
};

export const saveFacebookPage = async (tiendaId, { pageId, pageName, accessToken, userName }) => {
  await pool.query(
    `INSERT INTO facebook_pages (tienda_id, fb_page_id, fb_page_name, fb_user_name, access_token, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (tienda_id)
     DO UPDATE SET fb_page_id = EXCLUDED.fb_page_id,
                   fb_page_name = EXCLUDED.fb_page_name,
                   fb_user_name = EXCLUDED.fb_user_name,
                   access_token = EXCLUDED.access_token,
                   updated_at = NOW()`,
    [tiendaId, String(pageId).slice(0, 64), String(pageName || 'Página').slice(0, 200), String(userName || '').slice(0, 200), encryptSecret(accessToken)]
  );
};

export const deleteFacebookPage = async (tiendaId) => {
  const { rows } = await pool.query(
    `DELETE FROM facebook_pages WHERE tienda_id = $1 RETURNING id`,
    [tiendaId]
  );
  return Boolean(rows.length);
};

// ------------------------------------------------------------------ Graph API

export const listFacebookAccounts = async (systemToken) => {
  const token = String(systemToken || '').trim();
  if (!token) throw new Error('Facebook: falta el token de acceso.');
  if (token.length < 20) throw new Error('Facebook: el token no parece válido.');

  const [me, accounts] = await Promise.all([
    get('me', { fields: 'id,name', access_token: token }),
    get('me/accounts', { fields: 'id,name,access_token', access_token: token, limit: 100 }),
  ]);

  const pages = Array.isArray(accounts.data)
    ? accounts.data
        .filter((p) => p.id && p.access_token)
        .map((p) => ({ id: String(p.id), name: String(p.name || 'Página de Facebook') }))
    : [];

  return { owner: me?.name || 'Mi cuenta', ownerId: me?.id || null, pages };
};

export const connectFacebookPage = async (tiendaId, { token, pageId }) => {
  const systemToken = String(token || '').trim();
  const targetId = String(pageId || '').trim();
  if (!systemToken || !targetId) throw new Error('Facebook: token y página son obligatorios.');

  const accounts = await get('me/accounts', {
    fields: 'id,name,access_token',
    access_token: systemToken,
    limit: 100,
  });
  const page = Array.isArray(accounts.data) ? accounts.data.find((p) => String(p.id) === targetId) : null;
  if (!page || !page.access_token) {
    throw new Error('Facebook: esa página no está disponible para este token. Revisa los permisos del system user.');
  }
  const me = await get('me', { fields: 'name', access_token: systemToken });

  await saveFacebookPage(tiendaId, {
    pageId: page.id,
    pageName: page.name,
    accessToken: page.access_token,
    userName: me?.name || null,
  });
  return { pageId: String(page.id), pageName: String(page.name || 'Página de Facebook') };
};

// Publica una foto (si hay imagen accesible) o un post de texto en la página.
export const publishToFacebookPage = async ({ accessToken, pageId, message, photoUrl }) => {
  const token = String(accessToken || '').trim();
  if (!token) throw new Error('Facebook: no hay una página conectada para esta tienda.');
  if (!String(message || '').trim()) throw new Error('Facebook: el mensaje está vacío.');

  const body = String(message).trim();
  const hasImage = typeof photoUrl === 'string' && /^https?:\/\/\S+$/i.test(photoUrl);

  try {
    // Publicar como foto: Facebook descarga la URL pública de la imagen del producto.
    if (hasImage) {
      const { data } = await axios.post(`${GRAPH_URL}/${pageId}/photos`, {}, {
        params: { url: photoUrl, message: body, access_token: token },
        timeout: GRAPH_TIMEOUT,
      });
      return { kind: 'photo', postId: data?.id || null };
    }

    const { data } = await axios.post(
      `${GRAPH_URL}/${pageId}/feed`,
      {},
      { params: { message: body, access_token: token }, timeout: GRAPH_TIMEOUT }
    );
    return { kind: 'feed', postId: data?.id || null };
  } catch (err) {
    // Si falla el post con foto por problemas de la imagen (inaccesible o no
    // soportada), reintenta como post de texto para no perder la publicación.
    // Los errores de token/permisos sí se propagan para que el usuario reconecte.
    if (hasImage) {
      const photoErr = String(err?.response?.data?.error?.message || '');
      const imageIssue = /image|photo|url|fetch|download|unsupported|format|http exception|invalid image/i.test(photoErr);
      if (imageIssue) {
        try {
          const { data } = await axios.post(
            `${GRAPH_URL}/${pageId}/feed`,
            {},
            { params: { message: body, access_token: token }, timeout: GRAPH_TIMEOUT }
          );
          return { kind: 'feed', fallback: true, fallbackReason: photoErr.slice(0, 160), postId: data?.id || null };
        } catch (fallbackErr) {
          throw graphError(fallbackErr, 'No fue posible publicar en Facebook.');
        }
      }
    }
    throw graphError(err, 'No fue posible publicar en Facebook.');
  }
};
