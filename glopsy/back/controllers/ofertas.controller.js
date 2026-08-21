import { pool } from '../db.js';
import { cleanString, cleanText, toNumber, toInt, isAllowedEnum } from '../utils/validation.js';

export const getOfertas = async (req, res) => {
  try {
    const tiendaId = req.auth.userId;
    const { rows } = await pool.query(`
      SELECT o.id, o.titulo, o.descripcion, o.tipo_descuento AS tipo, o.valor_descuento AS valor, o.alcance, o.estado,
             COALESCE(
               (SELECT ARRAY_AGG(op.producto_id ORDER BY op.producto_id)
                FROM oferta_productos op WHERE op.oferta_id = o.id), '{}') AS product_ids
      FROM ofertas o
      WHERE o.tienda_id = $1
      ORDER BY o.created_at DESC
    `, [tiendaId]);
    return res.json({ ok: true, ofertas: rows });
  } catch (err) {
    console.error('Error al obtener ofertas:', err.message);
    return res.status(500).json({ ok: false, message: 'No fue posible obtener las ofertas.' });
  }
};

export const createOferta = async (req, res) => {
  try {
    const tiendaId = req.auth.userId;
    const titulo = cleanString(req.body.titulo, { maxLength: 150 });
    const descripcion = cleanText(req.body.descripcion, { maxLength: 2000 });
    const tipo = cleanString(req.body.tipo, { maxLength: 20 });
    const alcance = cleanString(req.body.alcance, { maxLength: 20 });
    const product_ids = Array.isArray(req.body.product_ids)
      ? req.body.product_ids.map((pid) => toInt(pid, { min: 1 })).filter(Boolean)
      : [];
    const hasValor = req.body.valor !== undefined && req.body.valor !== null && req.body.valor !== '';
    const valor = hasValor ? toNumber(req.body.valor, { min: 0, max: 9999999999, fallback: null }) : null;

    if (!titulo || !tipo || !hasValor || valor === null || !alcance) {
      return res.status(400).json({ ok: false, message: 'Título, tipo, valor y alcance son obligatorios.' });
    }
    if (!isAllowedEnum(tipo, ['porcentaje', 'monto_fijo'])) {
      return res.status(400).json({ ok: false, message: 'Tipo de descuento inválido.' });
    }
    if (!isAllowedEnum(alcance, ['global', 'productos', 'ciudad'])) {
      return res.status(400).json({ ok: false, message: 'Alcance inválido.' });
    }

    let ids = [];
    if (alcance === 'productos') {
      if (product_ids.length === 0) {
        return res.status(400).json({ ok: false, message: 'Debes seleccionar al menos un producto.' });
      }
      const { rows: prodRows } = await pool.query(
        `SELECT id FROM produc WHERE tienda_id = $1 AND id = ANY($2::int[])`,
        [tiendaId, product_ids]
      );
      if (prodRows.length !== product_ids.length) {
        return res.status(400).json({ ok: false, message: 'Uno o más productos no pertenecen a tu tienda.' });
      }
      ids = product_ids;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insert = await client.query(`
        INSERT INTO ofertas (tienda_id, titulo, descripcion, tipo_descuento, valor_descuento, alcance)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, titulo, descripcion, tipo_descuento AS tipo, valor_descuento AS valor, alcance, estado
      `, [tiendaId, titulo, descripcion || null, tipo, valor, alcance]);
      const oferta = insert.rows[0];

      for (const pid of ids) {
        await client.query(`INSERT INTO oferta_productos (oferta_id, producto_id) VALUES ($1, $2)`, [oferta.id, pid]);
      }
      await client.query('COMMIT');
      oferta.product_ids = ids;
      return res.status(201).json({ ok: true, oferta });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, message: 'Ya existe una promoción global activa para tu tienda.' });
    }
    console.error('Error al crear oferta:', err.message);
    return res.status(500).json({ ok: false, message: 'No fue posible crear la oferta.' });
  }
};

export const updateOfertaProductos = async (req, res) => {
  try {
    const tiendaId = req.auth.userId;
    const id = toInt(req.params.id, { min: 1 });
    const product_ids = Array.isArray(req.body.product_ids)
      ? req.body.product_ids.map((pid) => toInt(pid, { min: 1 })).filter(Boolean)
      : [];

    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido.' });

    const { rows: ofertaRows } = await pool.query(
      `SELECT id, alcance FROM ofertas WHERE id = $1 AND tienda_id = $2 LIMIT 1`,
      [id, tiendaId]
    );
    if (ofertaRows.length === 0) return res.status(404).json({ ok: false, message: 'Oferta no encontrada.' });
    if (ofertaRows[0].alcance !== 'productos') {
      return res.status(400).json({ ok: false, message: 'Esta oferta no aplica por productos.' });
    }

    if (product_ids.length > 0) {
      const { rows: prodRows } = await pool.query(
        `SELECT id FROM produc WHERE tienda_id = $1 AND id = ANY($2::int[])`,
        [tiendaId, product_ids]
      );
      if (prodRows.length !== product_ids.length) {
        return res.status(400).json({ ok: false, message: 'Uno o más productos no pertenecen a tu tienda.' });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM oferta_productos WHERE oferta_id = $1`, [id]);
      for (const pid of product_ids) {
        await client.query(`INSERT INTO oferta_productos (oferta_id, producto_id) VALUES ($1, $2)`, [id, pid]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return res.json({ ok: true, oferta_id: id, product_ids });
  } catch (err) {
    console.error('Error al actualizar productos de la oferta:', err.message);
    return res.status(500).json({ ok: false, message: 'No fue posible actualizar los productos de la oferta.' });
  }
};

export const deleteOferta = async (req, res) => {
  try {
    const tiendaId = req.auth.userId;
    const id = toInt(req.params.id, { min: 1 });
    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido.' });

    const { rowCount } = await pool.query(`DELETE FROM ofertas WHERE id = $1 AND tienda_id = $2`, [id, tiendaId]);
    if (rowCount === 0) return res.status(404).json({ ok: false, message: 'Oferta no encontrada.' });

    return res.json({ ok: true, message: 'Oferta eliminada.' });
  } catch (err) {
    console.error('Error al eliminar oferta:', err.message);
    return res.status(500).json({ ok: false, message: 'No fue posible eliminar la oferta.' });
  }
};

export default { getOfertas, createOferta, updateOfertaProductos, deleteOferta };
