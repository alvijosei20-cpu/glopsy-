// ==========================================
// Plantilla DIAN (.json.dian) lista para el proveedor, armada con sus
// ventas (o productos) y sus datos. El usuario solo elige régimen y
// responsabilidad fiscal.
// ==========================================

import { pool } from '../db.js';
import { generateDianPlantillaFile } from './dianPlantilla.service.js';

export const buildDianPlantillaFromStore = async (tiendaId, { regimen = '48', responsabilidad = 'O-47' } = {}) => {
  const { rows: tRows } = await pool.query(
    `SELECT nombres, titular_cuenta, titular_documento FROM tiendas WHERE usrid = $1 LIMIT 1`,
    [tiendaId]
  );
  const tienda = tRows[0];
  if (!tienda) return { ok: false, errors: ['No tienes una tienda registrada.'] };

  const { rows: dianRows } = await pool.query(
    `SELECT prefix, test_set_id FROM tienda_dian WHERE tienda_id = $1 LIMIT 1`,
    [tiendaId]
  );
  const prefix = dianRows[0]?.prefix || 'FE';
  const resolucion = String(dianRows[0]?.test_set_id || '').replace(/\D/g, '') || '0';

  // Líneas a partir de las ventas del proveedor.
  const { rows: vendidos } = await pool.query(
    `SELECT oi.product_name, oi.unit_price, MAX(oi.product_id) AS product_id, SUM(oi.quantity)::numeric AS qty
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.tienda_id = $1
     GROUP BY oi.product_name, oi.unit_price
     ORDER BY qty DESC
     LIMIT 50`,
    [tiendaId]
  );

  let lineas = vendidos.map((it, i) => ({
    CodigoProducto: String(it.product_id || i + 1),
    NombreProducto: it.product_name || 'Producto',
    Cantidad: Number(it.qty) || 1,
    UnidadMedida: '94',
    PrecioUnitario: Number(it.unit_price) || 0,
    PorcentajeIva: 19,
  }));

  if (lineas.length === 0) {
    const { rows: prods } = await pool.query(
      `SELECT id, name, COALESCE(suggested_price, base_price) AS price
       FROM produc WHERE tienda_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 50`,
      [tiendaId]
    );
    lineas = prods.map((p) => ({
      CodigoProducto: String(p.id),
      NombreProducto: p.name || 'Producto',
      Cantidad: 1,
      UnidadMedida: '94',
      PrecioUnitario: Number(p.price) || 0,
      PorcentajeIva: 19,
    }));
  }
  if (lineas.length === 0) {
    lineas = [{ CodigoProducto: '1', NombreProducto: 'Producto', Cantidad: 1, UnidadMedida: '94', PrecioUnitario: 1000, PorcentajeIva: 19 }];
  }

  const doc = String(tienda.titular_documento || '').replace(/\D/g, '');

  return generateDianPlantillaFile({
    VersionPlantilla: '1.0',
    TipoDocumento: '01',
    InformacionResolucion: {
      NumeroResolucion: resolucion,
      Prefijo: prefix,
      ConsecutivoDesde: 1,
      ConsecutivoHasta: 5000,
    },
    Emisor: {
      TipoIdentificacion: '31',
      NumeroIdentificacion: doc || '900000000',
      DV: '0',
      RazonSocial: tienda.titular_cuenta || tienda.nombres || 'Mi empresa',
      RegimenFiscal: regimen,
      ResponsabilidadFiscal: responsabilidad,
    },
    DetallesFactura: {
      FechaEmision: new Date().toISOString().slice(0, 10),
      HoraEmision: '10:00:00-05:00',
      Moneda: 'COP',
      FormaPago: '1',
      MedioPago: '10',
    },
    LineasDeFactura: lineas,
  });
};
