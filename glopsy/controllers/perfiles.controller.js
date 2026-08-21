import { pool } from '../db.js';
import { invalidateRatesCacheForStore } from '../services/envia.service.js';
import { cleanString, toInt, toNumber, isAllowedEnum } from '../utils/validation.js';

export const getPerfilesForUser = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { rows } = await pool.query(`SELECT id, nombre, tipo_envio AS tipo, alcance, fullment_id, ciudad_id, costo, estado FROM perfiles_envio WHERE tienda_id = $1 ORDER BY id`, [userId]);
    return res.json({ ok: true, perfiles: rows });
  } catch (err) {
    console.error('Error al obtener perfiles de envío:', err.message);
    return res.status(500).json({ ok: false, message: 'No fue posible obtener los perfiles de envío.' });
  }
};

export const createPerfilForUser = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const nombre = cleanString(req.body.nombre, { maxLength: 150 });
    const tipo = cleanString(req.body.tipo, { maxLength: 20 });
    const alcance = cleanString(req.body.alcance, { maxLength: 20 });
    const fullment_id = toInt(req.body.fullment_id, { min: 1 });
    const ciudad_id = toInt(req.body.ciudad_id, { min: 1 });
    const costo = toNumber(req.body.costo, { min: 0, max: 99999999, fallback: 0 });
    if (!nombre || !tipo || !alcance) {
      return res.status(400).json({ ok: false, message: 'Nombre, tipo y alcance son obligatorios.' });
    }
    if (!isAllowedEnum(tipo, ['gratis', 'cobro'])) {
      return res.status(400).json({ ok: false, message: 'Tipo de envío inválido.' });
    }
    if (!isAllowedEnum(alcance, ['global', 'ciudad'])) {
      return res.status(400).json({ ok: false, message: 'Alcance inválido.' });
    }
    if (alcance === 'ciudad' && !ciudad_id) {
      return res.status(400).json({ ok: false, message: 'Debes seleccionar la ciudad destino del perfil de envío.' });
    }
    if (tipo === 'gratis' && (!costo || costo <= 0)) {
      return res.status(400).json({ ok: false, message: 'El precio del perfil de envío gratis es obligatorio y debe ser mayor a 0.' });
    }

    const insert = await pool.query(`
      INSERT INTO perfiles_envio (tienda_id, nombre, tipo_envio, alcance, fullment_id, ciudad_id, costo) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, nombre, tipo_envio AS tipo, alcance, fullment_id, ciudad_id, costo, estado
    `, [userId, nombre, tipo, alcance, fullment_id || null, ciudad_id || null, costo]);
    const perfil = insert.rows[0];

    // invalidate cache for store
    try { await invalidateRatesCacheForStore(userId).catch(() => {}); } catch {}

    return res.status(201).json({ ok: true, perfil });
  } catch (err) {
    console.error('Error al crear perfil de envío:', err.message);
    return res.status(500).json({ ok: false, message: err.message || 'No fue posible crear el perfil.' });
  }
};

export const deletePerfilForUser = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const id = toInt(req.params.id, { min: 1 });
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido.' });

    const { rowCount } = await pool.query(`DELETE FROM perfiles_envio WHERE id = $1 AND tienda_id = $2`, [id, userId]);
    if (rowCount === 0) return res.status(404).json({ ok: false, message: 'Perfil no encontrado.' });

    try { await invalidateRatesCacheForStore(userId).catch(() => {}); } catch {}

    return res.json({ ok: true, message: 'Perfil eliminado.' });
  } catch (err) {
    console.error('Error al eliminar perfil de envío:', err.message);
    return res.status(500).json({ ok: false, message: 'No fue posible eliminar el perfil.' });
  }
};

export default { getPerfilesForUser, createPerfilForUser, deletePerfilForUser };
