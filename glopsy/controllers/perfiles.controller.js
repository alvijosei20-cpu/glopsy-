import { pool } from '../db.js';
import { invalidateRatesCacheForStore } from '../services/envia.service.js';

export const getPerfilesForUser = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { rows } = await pool.query(`SELECT id, nombre, tipo_envio AS tipo, alcance, fullment_id, costo, estado FROM perfiles_envio WHERE tienda_id = $1 ORDER BY id`, [userId]);
    return res.json({ ok: true, perfiles: rows });
  } catch (err) {
    console.error('Error al obtener perfiles de envío:', err.message);
    return res.status(500).json({ ok: false, message: 'No fue posible obtener los perfiles de envío.' });
  }
};

export const createPerfilForUser = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { nombre, tipo, alcance, fullment_id, costo } = req.body;
    if (!nombre || !tipo || !alcance) {
      return res.status(400).json({ ok: false, message: 'Nombre, tipo y alcance son obligatorios.' });
    }

    const insert = await pool.query(`
      INSERT INTO perfiles_envio (tienda_id, nombre, tipo_envio, alcance, fullment_id, costo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nombre, tipo_envio AS tipo, alcance, fullment_id, costo, estado
    `, [userId, nombre, tipo, alcance, fullment_id || null, costo || 0]);
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
    const id = Number(req.params.id);
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
