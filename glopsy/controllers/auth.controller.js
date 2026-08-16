import axios from 'axios';
// Importamos el servicio independiente de autenticación
import {
  processOAuthUser,
  revokeSession,
  registerWithEmail,
  loginWithEmail,
  savePushSubscriptionService,
  saveBiometricCredentialService,
  deleteBiometricCredentialService,
  getBiometricRegistrationOptionsService,
  verifyBiometricRegistrationService,
  getBiometricLoginOptionsService,
  verifyBiometricLoginService,
} from '../services/auth.service.js';
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
      'SELECT id, email, name, avatar_url, phone, TO_CHAR(birthdate, \'YYYY-MM-DD\') AS birthdate, document_type, document_number, gender FROM users WHERE id = $1',
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

export const updateCurrentUser = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { name, phone, birthdate, document_type, document_number, gender, avatar_url } = req.body;

    const { rows } = await pool.query(
      `UPDATE users SET 
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        birthdate = COALESCE($3, birthdate),
        document_type = COALESCE($4, document_type),
        document_number = COALESCE($5, document_number),
        gender = COALESCE($6, gender),
        avatar_url = COALESCE($7, avatar_url),
        updated_at = NOW()
       WHERE id = $8
       RETURNING id, email, name, avatar_url, phone, birthdate, document_type, document_number, gender`,
      [name, phone, birthdate || null, document_type, document_number, gender, avatar_url, userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }

    return res.json({ ok: true, user: rows[0] });
  } catch (error) {
    console.error('Error al actualizar perfil de usuario:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible actualizar el perfil.' });
  }
};

export const getAddresses = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { rows } = await pool.query(
      'SELECT id, type, title, street, city, state, zip_code, country, phone, notes FROM user_addresses WHERE user_id = $1 ORDER BY id DESC',
      [userId]
    );
    return res.json({ ok: true, addresses: rows });
  } catch (error) {
    console.error('Error al obtener direcciones:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible obtener las direcciones.' });
  }
};

export const saveAddress = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { type, title, street, city, state, zip_code, country, phone, notes } = req.body;
    if (!street || !city) {
      return res.status(400).json({ ok: false, message: 'Calle y ciudad son obligatorias.' });
    }
    if (phone && !/^3\d{9}$/.test(phone)) {
      return res.status(400).json({ ok: false, message: 'El número móvil debe tener 10 dígitos y empezar por 3 (Ej: 3001234567).' });
    }

    const { rows } = await pool.query(
      `INSERT INTO user_addresses (user_id, type, title, street, city, state, zip_code, country, phone, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, type, title, street, city, state, zip_code, country, phone, notes`,
      [userId, type || 'envio', title || 'Dirección principal', street, city, state || '', zip_code || '', country || 'Colombia', phone || '', notes || '']
    );

    return res.status(201).json({ ok: true, address: rows[0] });
  } catch (error) {
    console.error('Error al guardar dirección:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible guardar la dirección.' });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const id = Number(req.params.id);
    const { rowCount } = await pool.query('DELETE FROM user_addresses WHERE id = $1 AND user_id = $2', [id, userId]);
    if (rowCount === 0) {
      return res.status(404).json({ ok: false, message: 'Dirección no encontrada.' });
    }
    return res.json({ ok: true, message: 'Dirección eliminada.' });
  } catch (error) {
    console.error('Error al eliminar dirección:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible eliminar la dirección.' });
  }
};

export const getCards = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { rows } = await pool.query(
      'SELECT id, card_holder, last_four, card_brand, expiry_month, expiry_year FROM user_cards WHERE user_id = $1 ORDER BY id DESC',
      [userId]
    );
    return res.json({ ok: true, cards: rows });
  } catch (error) {
    console.error('Error al obtener tarjetas:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible obtener las tarjetas.' });
  }
};

export const saveCard = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { card_holder, card_number, expiry_month, expiry_year, card_brand } = req.body;
    if (!card_number || card_number.length < 4) {
      return res.status(400).json({ ok: false, message: 'Número de tarjeta inválido.' });
    }

    const last_four = card_number.slice(-4);
    const brand = card_brand || 'Visa';

    const { rows } = await pool.query(
      `INSERT INTO user_cards (user_id, card_holder, last_four, card_brand, expiry_month, expiry_year)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, card_holder, last_four, card_brand, expiry_month, expiry_year`,
      [userId, card_holder || 'Titular', last_four, brand, expiry_month || '12', expiry_year || '28']
    );

    return res.status(201).json({ ok: true, card: rows[0] });
  } catch (error) {
    console.error('Error al guardar tarjeta:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible guardar la tarjeta.' });
  }
};

export const deleteCard = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const id = Number(req.params.id);
    const { rowCount } = await pool.query('DELETE FROM user_cards WHERE id = $1 AND user_id = $2', [id, userId]);
    if (rowCount === 0) {
      return res.status(404).json({ ok: false, message: 'Tarjeta no encontrada.' });
    }
    return res.json({ ok: true, message: 'Tarjeta eliminada.' });
  } catch (error) {
    console.error('Error al eliminar tarjeta:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible eliminar la tarjeta.' });
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

export const registerEmail = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ ok: false, message: 'Correo y contraseña son obligatorios.' });
    }
    const { user, token } = await registerWithEmail({ email, password, name });
    res.status(201).json({ ok: true, user, token });
  } catch (error) {
    console.error('Error en registro con email:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al registrar usuario.' });
  }
};

export const loginEmail = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ ok: false, message: 'Correo y contraseña son obligatorios.' });
    }
    const { user, token } = await loginWithEmail({ email, password });
    res.json({ ok: true, user, token });
  } catch (error) {
    console.error('Error en login con email:', error.message);
    res.status(401).json({ ok: false, message: error.message || 'Correo o contraseña incorrectos.' });
  }
};

export const savePushSubscriptionController = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { subscription } = req.body;
    await savePushSubscriptionService(userId, subscription);
    return res.json({ ok: true, message: 'Suscripción push guardada con éxito.' });
  } catch (error) {
    console.error('Error al guardar suscripción push:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible guardar la suscripción push.' });
  }
};

export const saveBiometricCredentialController = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { credential } = req.body;
    await saveBiometricCredentialService(userId, credential);
    return res.json({ ok: true, message: 'Credencial biométrica asociada con éxito.' });
  } catch (error) {
    console.error('Error al asociar biométrica:', error.message);
    if (error.message === 'Ya posees una huella') {
      return res.status(400).json({ ok: false, message: 'Ya posees una huella' });
    }
    return res.status(500).json({ ok: false, message: 'No fue posible asociar la huella biométrica.' });
  }
};

export const deleteBiometricCredentialController = async (req, res) => {
  try {
    await deleteBiometricCredentialService(req.auth.userId);
    return res.json({ ok: true, message: 'Huella biométrica eliminada con éxito.' });
  } catch (error) {
    console.error('Error al eliminar biométrica:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible eliminar la huella biométrica.' });
  }
};

export const biometricRegistrationOptionsController = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const reqOrigin = req.get('origin');
    const options = await getBiometricRegistrationOptionsService(userId, reqOrigin);
    return res.json({ ok: true, options });
  } catch (error) {
    console.error('Error al generar opciones de registro biométrico:', error.message);
    if (error.message === 'Ya posees una huella') {
      return res.status(400).json({ ok: false, message: 'Ya posees una huella' });
    }
    return res.status(500).json({ ok: false, message: error.message || 'Error al generar opciones de registro.' });
  }
};

export const biometricRegistrationVerifyController = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const response = req.body;
    const reqOrigin = req.get('origin');
    await verifyBiometricRegistrationService(userId, response, reqOrigin);
    return res.json({ ok: true, message: 'Huella biométrica registrada y verificada correctamente.' });
  } catch (error) {
    console.error('Error al verificar registro biométrico:', error.message);
    return res.status(400).json({ ok: false, message: error.message || 'Error al verificar el registro biométrico.' });
  }
};

export const biometricLoginOptionsController = async (req, res) => {
  try {
    const { email } = req.body || {};
    const reqOrigin = req.get('origin');
    const options = await getBiometricLoginOptionsService(email, reqOrigin);
    return res.json({ ok: true, options });
  } catch (error) {
    console.error('Error al generar opciones de inicio de sesión biométrico:', error.message);
    return res.status(500).json({ ok: false, message: error.message || 'Error al generar opciones de login biométrico.' });
  }
};

export const biometricLoginVerifyController = async (req, res) => {
  try {
    const response = req.body;
    const reqOrigin = req.get('origin');
    const { user, token } = await verifyBiometricLoginService(response, reqOrigin);
    return res.json({ ok: true, user, token });
  } catch (error) {
    console.error('Error al verificar inicio de sesión biométrico:', error.message);
    return res.status(401).json({ ok: false, message: error.message || 'Autenticación biométrica fallida.' });
  }
};
