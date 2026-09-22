import { pool } from '../db.js';
import { cleanString, cleanEmail, toInt, isAllowedEnum } from '../utils/validation.js';
import { approveUsdActivation } from '../services/tienda.service.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

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
    // Al deshabilitar al vendedor, su tienda deja de estar activa (no sigue vendiendo).
    let storeActive = null;
    if (!canSell) {
      const { rows: tRows } = await pool.query(
        `UPDATE tiendas SET activa = false WHERE usrid = $1 RETURNING activa`,
        [rows[0].id]
      );
      storeActive = tRows[0] ? Boolean(tRows[0].activa) : null;
    }
    return res.json({ ok: true, user: rows[0], storeActive });
  } catch (error) {
    console.error('Error actualizando can_sell:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible actualizar el usuario.' });
  }
};

// GET /api/admin/commissions -> regla global + comisión por categoría.
export const listCommissions = async (req, res) => {
  try {
    const { rows: globalRows } = await pool.query(
      `SELECT id, porcentaje, activo
       FROM commission_rules
       WHERE scope = 'global' AND scope_id IS NULL AND tienda_id IS NULL
       ORDER BY id LIMIT 1`
    );
    const { rows } = await pool.query(
      `SELECT c.id, c.nombre,
              r.id AS rule_id, r.porcentaje, r.activo
       FROM categorias c
       LEFT JOIN commission_rules r
         ON r.scope = 'categoria' AND r.scope_id = c.id AND r.tienda_id IS NULL
       WHERE c.tienda_id IS NULL
       ORDER BY c.nombre`
    );
    const g = globalRows[0];
    return res.json({
      ok: true,
      global: g
        ? { id: g.id, porcentaje: Number(g.porcentaje), activo: g.activo === true }
        : { id: null, porcentaje: null, activo: true },
      categorias: rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        ruleId: r.rule_id || null,
        porcentaje: r.porcentaje != null ? Number(r.porcentaje) : null,
        activo: r.activo === true,
      })),
    });
  } catch (error) {
    console.error('Error listando comisiones:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible listar las comisiones.' });
  }
};

// POST /api/admin/commissions { scope, scope_id?, porcentaje, activo? }
export const saveCommission = async (req, res) => {
  try {
    const scope = cleanString(req.body?.scope, { maxLength: 20 });
    if (!isAllowedEnum(scope, ['global', 'categoria', 'producto'])) {
      return res.status(400).json({ ok: false, message: 'Alcance no válido.' });
    }
    const porcentaje = Number(req.body?.porcentaje);
    if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      return res.status(400).json({ ok: false, message: 'El porcentaje debe estar entre 0 y 100.' });
    }
    const activo = req.body?.activo !== false;
    const scopeId = scope === 'global' ? null : toInt(req.body?.scope_id, { min: 1 });
    if (scope !== 'global' && !scopeId) {
      return res.status(400).json({ ok: false, message: 'Falta el elemento al que aplica la comisión.' });
    }
    if (scope === 'categoria') {
      const { rows: cat } = await pool.query(
        `SELECT 1 FROM categorias WHERE id = $1 AND tienda_id IS NULL LIMIT 1`,
        [scopeId]
      );
      if (!cat[0]) return res.status(404).json({ ok: false, message: 'Categoría no encontrada.' });
    }
    const { rows } = await pool.query(
      `INSERT INTO commission_rules (scope, scope_id, tienda_id, porcentaje, activo)
       VALUES ($1, $2, NULL, $3, $4)
       ON CONFLICT (scope, COALESCE(scope_id, 0), COALESCE(tienda_id, 0))
       DO UPDATE SET porcentaje = EXCLUDED.porcentaje, activo = EXCLUDED.activo, updated_at = NOW()
       RETURNING id, scope, scope_id, porcentaje, activo`,
      [scope, scopeId, round2(porcentaje), activo]
    );
    return res.json({ ok: true, rule: { ...rows[0], porcentaje: Number(rows[0].porcentaje) } });
  } catch (error) {
    console.error('Error guardando comisión:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible guardar la comisión.' });
  }
};

// DELETE /api/admin/commissions/:id
export const deleteCommission = async (req, res) => {
  try {
    const id = toInt(req.params.id, { min: 1 });
    if (!id) return res.status(400).json({ ok: false, message: 'Id inválido.' });
    const { rowCount } = await pool.query(`DELETE FROM commission_rules WHERE id = $1`, [id]);
    if (!rowCount) return res.status(404).json({ ok: false, message: 'Regla no encontrada.' });
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error eliminando comisión:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible eliminar la comisión.' });
  }
};

// POST /api/admin/sellers/usd-activation { email, approve } -> activa (o rechaza) la tienda en USD.
export const setUsdActivation = async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email, { required: true });
    if (!email) return res.status(400).json({ ok: false, message: 'Correo inválido.' });
    const { rows } = await pool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
    if (!rows[0]) return res.status(404).json({ ok: false, message: 'Usuario no encontrado.' });
    const result = await approveUsdActivation(rows[0].id, req.body?.approve !== false);
    return res.json({ ok: true, result });
  } catch (error) {
    console.error('Error actualizando activación USD:', error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible actualizar la activación USD.' });
  }
};
