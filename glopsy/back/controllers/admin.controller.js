import { pool } from '../db.js';
import { cleanString, cleanEmail } from '../utils/validation.js';

// GET /api/admin/sellers?q=&limit= -> usuarios con su estado de vendedor y tienda.
export const listUsersForAdmin = async (req, res) => {
  try {
    const q = cleanString(req.query.q, { maxLength: 120 });
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const values = [limit];
    let where = '';
    if (q) {
      values.push(`%${q}%`);
      where = `WHERE (u.email ILIKE $${values.length} OR u.name ILIKE $${values.length})`;
    }
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.name, u.avatar_url, u.can_sell, u.created_at,
              t.nombres AS store_name, COALESCE(t.activa, false) AS store_active
       FROM users u
       LEFT JOIN tiendas t ON t.usrid = u.id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $1`,
      values
    );
    return res.json({ ok: true, users: rows });
  } catch (error) {
    console.error('Error listando usuarios para admin:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible listar los usuarios.' });
  }
};

// POST /api/admin/sellers/set { email, can_sell }
export const setUserCanSell = async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email, { required: true });
    const canSell = req.body?.can_sell === true;
    if (!email) {
      return res.status(400).json({ ok: false, message: 'Correo inválido.' });
    }
    const { rows } = await pool.query(
      `UPDATE users SET can_sell = $2, updated_at = NOW() WHERE email = $1 RETURNING id, email, can_sell`,
      [email, canSell]
    );
    if (!rows[0]) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    }
    return res.json({ ok: true, user: rows[0] });
  } catch (error) {
    console.error('Error actualizando can_sell:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible actualizar el usuario.' });
  }
};
