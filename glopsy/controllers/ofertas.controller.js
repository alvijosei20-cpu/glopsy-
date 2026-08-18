import { pool } from '../db.js';

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
    const { titulo, descripcion, tipo, valor, alcance, product_ids } = req.body;

    if (!titulo || !tipo || valor === undefined || !alcance) {
      return res.status(400).json({ ok: false, message: 'Título, tipo, valor y alcance son obligatorios.' });
    }
    if (!['porcentaje', 'monto_fijo'].includes(tipo)) {
      return res.status(400).json({ ok: false, message: 'Tipo de descuento inválido.' });
    }
    if (!['global', 'productos', 'ciudad'].includes(alcance)) {
      return res.status(400).json({ ok: false, message: 'Alcance inválido.' });
    }

    let ids = [];
    if (alcance === 'productos') {
      const idsNum = (Array.isArray(product_ids) ? product_ids : []).map(Number).filter(Boolean);
      if (idsNum.length === 0) {
        return res.status(400).json({ ok: false, message: 'Debes seleccionar al menos un producto.' });
      }
      const { rows: prodRows } = await pool.query(
        `SELECT id FROM produc WHERE tienda_id = $1 AND id = ANY($2::int[])`,
        [tiendaId, idsNum]
      );
      if (prodRows.length !== idsNum.length) {
        return res.status(400).json({ ok: false, message: 'Uno o más productos no pertenecen a tu tienda.' });
      }
      ids = idsNum;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insert = await client.query(`
        INSERT INTO ofertas (tienda_id, titulo, descripcion, tipo_descuento, valor_descuento, alcance)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, titulo, descripcion, tipo_descuento AS tipo, valor_descuento AS valor, alcance, estado
      `, [tiendaId, titulo, descripcion || null, tipo, Number(valor) || 0, alcance]);
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
    const id = Number(req.params.id);
    const { product_ids } = req.body;

    if (!id) return res.status(400).json({ ok: false, message: 'ID inválido.' });

    const { rows: ofertaRows } = await pool.query(
      `SELECT id, alcance FROM ofertas WHERE id = $1 AND tienda_id = $2 LIMIT 1`,
      [id, tiendaId]
    );
    if (ofertaRows.length === 0) return res.status(404).json({ ok: false, message: 'Oferta no encontrada.' });
    if (ofertaRows[0].alcance !== 'productos') {
      return res.status(400).json({ ok: false, message: 'Esta oferta no aplica por productos.' });
    }

    const idsNum = (Array.isArray(product_ids) ? product_ids : []).map(Number).filter(Boolean);
    if (idsNum.length > 0) {
      const { rows: prodRows } = await pool.query(
        `SELECT id FROM produc WHERE tienda_id = $1 AND id = ANY($2::int[])`,
        [tiendaId, idsNum]
      );
      if (prodRows.length !== idsNum.length) {
        return res.status(400).json({ ok: false, message: 'Uno o más productos no pertenecen a tu tienda.' });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM oferta_productos WHERE oferta_id = $1`, [id]);
      for (const pid of idsNum) {
        await client.query(`INSERT INTO oferta_productos (oferta_id, producto_id) VALUES ($1, $2)`, [id, pid]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return res.json({ ok: true, oferta_id: id, product_ids: idsNum });
  } catch (err) {
    console.error('Error al actualizar productos de la oferta:', err.message);
    return res.status(500).json({ ok: false, message: 'No fue posible actualizar los productos de la oferta.' });
  }
};

export const deleteOferta = async (req, res) => {
  try {
    const tiendaId = req.auth.userId;
    const id = Number(req.params.id);
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
