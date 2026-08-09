import axios from 'axios';
// Importamos el servicio independiente de autenticación
import { processOAuthUser, revokeSession } from '../services/auth.service.js';
import { pool } from '../db.js';

// ==========================================
// GOOGLE OAUTH
// ==========================================
export const googleLogin = (req, res) => {
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = new URLSearchParams({
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    client_id: process.env.GOOGLE_CLIENT_ID,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
  });

  res.redirect(`${rootUrl}?${options.toString()}`);
};

export const googleCallback = async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ message: 'Código de autorización no provisto' });
  }

  try {
    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token } = tokenResponse.data;

    const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const googleUser = userResponse.data;

    // Llamada al servicio extraído
    const { token } = await processOAuthUser({
      email: googleUser.email,
      name: googleUser.name,
      avatar_url: googleUser.picture,
      provider: 'google',
      provider_id: googleUser.id,
    });

    // El fragmento no se envía a servidores ni a cabeceras Referer.
    res.redirect(`${process.env.FRONTEND_URL}/auth/success#token=${encodeURIComponent(token)}`);
  } catch (error) {
    console.error('Error en callback de Google:', error.response?.data || error.message);
    res.status(500).json({ message: 'Error en la autenticación con Google' });
  }
};

// ==========================================
// DISCORD OAUTH
// ==========================================
export const discordLogin = (req, res) => {
  const rootUrl = 'https://discord.com/api/oauth2/authorize';
  const options = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email',
  });

  res.redirect(`${rootUrl}?${options.toString()}`);
};

export const discordCallback = async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ message: 'Código de autorización no provisto' });
  }

  try {
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token } = tokenResponse.data;

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const discordUser = userResponse.data;

    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null;

    // Llamada al servicio extraído
    const { token } = await processOAuthUser({
      email: discordUser.email,
      name: discordUser.global_name || discordUser.username,
      avatar_url: avatarUrl,
      provider: 'discord',
      provider_id: discordUser.id,
    });

    res.redirect(`${process.env.FRONTEND_URL}/auth/success#token=${encodeURIComponent(token)}`);
  } catch (error) {
    console.error('Error en callback de Discord:', error.response?.data || error.message);
    res.status(500).json({ message: 'Error en la autenticación con Discord' });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, avatar_url FROM users WHERE id = $1',
      [req.auth.userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    return res.json({ ok: true, user: rows[0] });
  } catch (error) {
    console.error('Error al consultar el usuario actual:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible consultar el usuario.' });
  }
};

export const logout = async (req, res) => {
  try {
    await revokeSession(req.auth.userId);
    return res.status(204).send();
  } catch (error) {
    console.error('Error al cerrar sesión:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible cerrar sesión.' });
  }
};
