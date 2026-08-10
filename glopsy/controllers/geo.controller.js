import { query } from '../db.js';
import { getProductsByFullment, assignProductsToFullment } from '../services/product.service.js';
import { invalidateRatesCacheForStore } from '../services/envia.service.js';

export const getFullments = async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT 
        f.id AS fullment_id,
        f.tienda_id,
        c.id AS ciudad_id,
        c.nombre AS ciudad_nombre,
        d.id AS departamento_id,
        d.nombre AS departamento_nombre,
        p.id AS pais_id,
        p.nombre AS pais_nombre
      FROM fullments f
      JOIN ciudades c ON f.ciudad_id = c.id
      JOIN departamentos d ON c.departamento_id = d.id
      JOIN paises p ON d.pais_id = p.id
      WHERE f.estado = 'activo'
      ORDER BY c.nombre
    `);
    res.json({ ok: true, fullments: rows });
  } catch (error) {
    console.error('Error al obtener fullments:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener centros de distribución (fullments)' });
  }
};

export const getMyFullments = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { rows } = await query(`
      SELECT 
        f.id AS fullment_id,
        f.tienda_id,
        c.id AS ciudad_id,
        c.nombre AS ciudad_nombre,
        d.id AS departamento_id,
        d.nombre AS departamento_nombre,
        p.id AS pais_id,
        p.nombre AS pais_nombre
      FROM fullments f
      JOIN ciudades c ON f.ciudad_id = c.id
      JOIN departamentos d ON c.departamento_id = d.id
      JOIN paises p ON d.pais_id = p.id
      WHERE f.tienda_id = $1 AND f.estado = 'activo'
      ORDER BY c.nombre
    `, [userId]);
    res.json({ ok: true, fullments: rows });
  } catch (error) {
    console.error('Error al obtener fullments de la tienda:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener los centros de distribución de la tienda' });
  }
};

export const getDepartamentos = async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT id, nombre, pais_id
      FROM departamentos
      ORDER BY nombre
    `);
    res.json({ ok: true, departamentos: rows });
  } catch (error) {
    console.error('Error al obtener departamentos:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener departamentos' });
  }
};

export const getCiudades = async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT id, nombre, departamento_id, codigo_postal
      FROM ciudades
      ORDER BY nombre
    `);
    res.json({ ok: true, ciudades: rows });
  } catch (error) {
    console.error('Error al obtener ciudades:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener ciudades' });
  }
};

export const createFullment = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { ciudad_id } = req.body;

    if (!ciudad_id) {
      return res.status(400).json({ ok: false, message: 'El campo ciudad_id es obligatorio' });
    }

    const { rows } = await query(
      `INSERT INTO fullments (tienda_id, ciudad_id, estado)
       VALUES ($1, $2, 'activo')
       RETURNING id AS fullment_id, tienda_id, ciudad_id, estado`,
      [userId, ciudad_id]
    );

    res.status(201).json({ ok: true, fullment: rows[0] });
    try { await invalidateRatesCacheForStore(userId).catch(() => {}); } catch {}
  } catch (error) {
    console.error('Error al crear fullment:', error.message);
    if (error.code === '23505') {
      return res.status(400).json({ ok: false, message: 'Este centro de distribución ya se encuentra registrado para esta ciudad.' });
    }
    res.status(500).json({ ok: false, message: 'Error al guardar el centro de distribución' });
  }
};

export const deleteFullment = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { id } = req.params;

    const { rowCount } = await query(
      `DELETE FROM fullments WHERE id = $1 AND tienda_id = $2`,
      [id, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ ok: false, message: 'Centro de distribución no encontrado' });
    }

    res.json({ ok: true, message: 'Centro de distribución eliminado' });
    try { await invalidateRatesCacheForStore(userId).catch(() => {}); } catch {}
  } catch (error) {
    console.error('Error al eliminar fullment:', error.message);
    res.status(500).json({ ok: false, message: 'Error al eliminar el centro de distribución' });
  }
};

export const updateFullmentPerfil = async (req, res) => {
  return res.json({ ok: true, message: 'Actualizado.' });
};

export const getFullmentProducts = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { id } = req.params;
    const products = await getProductsByFullment(userId, id);
    res.json({ ok: true, products });
  } catch (error) {
    console.error('Error al obtener productos del centro:', error.message);
    res.status(500).json({ ok: false, message: 'Error al obtener los productos del centro de distribución' });
  }
};

export const updateFullmentProducts = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    const { id } = req.params;
    const { product_ids, product_profiles } = req.body;

    const products = await assignProductsToFullment(userId, id, product_ids, product_profiles);
    res.json({ ok: true, message: 'Productos actualizados en el centro de distribución', products });
  } catch (error) {
    console.error('Error al actualizar productos del centro:', error.message);
    res.status(400).json({ ok: false, message: error.message || 'Error al actualizar los productos del centro de distribución' });
  }
};
