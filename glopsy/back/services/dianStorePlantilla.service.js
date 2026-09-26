// ==========================================
// Plantilla DIAN (.json.dian) lista para el proveedor, armada con sus
// ventas (o productos) y sus datos. El usuario solo elige régimen y
// responsabilidad fiscal.
// ==========================================

import { pool } from '../db.js';
import { generateDianPlantillaFile } from './dianPlantilla.service.js';
import { computeNitDv } from '../utils/nit.js';

export const buildDianPlantillaFromStore = async (tiendaId, { regimen, responsabilidad, exportacion = false } = {}) => {
  const { rows: tRows } = await pool.query(
    `SELECT nombres, titular_cuenta, titular_documento FROM tiendas WHERE usrid = $1 LIMIT 1`,
    [tiendaId]
  );
  const tienda = tRows[0];
  if (!tienda) return { ok: false, errors: ['No tienes una tienda registrada.'] };

  const { rows: dianRows } = await pool.query(
    `SELECT prefix, test_set_id, numero_resolucion, resolucion_fecha_desde, resolucion_fecha_hasta,
            direccion_fiscal, regimen AS regimen_guardado, responsabilidad AS responsabilidad_guardada,
            mandato_activo, mandato_tercero_nombre, mandato_tercero_tipo_documento,
            mandato_tercero_documento
     FROM tienda_dian WHERE tienda_id = $1 LIMIT 1`,
    [tiendaId]
  );
  const dian = dianRows[0] || {};
  const prefix = dian.prefix || 'FE';
  const resolucion = String(dian.numero_resolucion || dian.test_set_id || '').replace(/\D/g, '') || '0';
  const regimenFinal = regimen || dian.regimen_guardado || '48';
  const responsabilidadFinal = responsabilidad || dian.responsabilidad_guardada || 'O-47';

  // Departamento (2) y municipio (5) DANE desde la ciudad de la tienda.
  const { rows: cityRows } = await pool.query(
    `SELECT c.codigo_dane
     FROM fullments f
     JOIN ciudades c ON c.id = f.ciudad_id
     WHERE f.tienda_id = $1 AND f.estado = 'activo' AND c.codigo_dane ~ '^[0-9]{5}$'
     ORDER BY f.id ASC LIMIT 1`,
    [tiendaId]
  );
  const dane = cityRows[0]?.codigo_dane || null;
  const departamento = dane ? dane.slice(0, 2) : null;
  const municipio = dane || null;

  const esExportacion = exportacion === true || exportacion === 'true' || exportacion === 1;

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
    PorcentajeIva: esExportacion ? 0 : 19,
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
      PorcentajeIva: esExportacion ? 0 : 19,
    }));
  }
  if (lineas.length === 0) {
    lineas = [{
      CodigoProducto: '1', NombreProducto: 'Producto', Cantidad: 1, UnidadMedida: '94',
      PrecioUnitario: esExportacion ? 1 : 1000, PorcentajeIva: esExportacion ? 0 : 19,
    }];
  }

  const doc = String(tienda.titular_documento || '').replace(/\D/g, '');
  const dv = computeNitDv(doc);

  // Operación bajo mandato: la factura se emite en nombre y por cuenta del
  // tercero (mandante). Solo aplica si está activo y hay datos del tercero.
  const mandatoActivo = dian.mandato_activo === true || dian.mandato_activo === 'true';
  const terceroDoc = String(dian.mandato_tercero_documento || '').replace(/\D/g, '');
  const terceroTipo = String(dian.mandato_tercero_tipo_documento || '').trim() || '31';
  let facturaPorCuentaDe = null;
  if (mandatoActivo && dian.mandato_tercero_nombre && terceroDoc) {
    facturaPorCuentaDe = {
      TipoIdentificacion: terceroTipo,
      NumeroIdentificacion: terceroDoc,
      DV: String(terceroTipo) === '31' ? String(computeNitDv(terceroDoc)) : undefined,
      RazonSocial: String(dian.mandato_tercero_nombre).trim(),
    };
  }

  return generateDianPlantillaFile({
    VersionPlantilla: '1.0',
    TipoDocumento: '01',
    InformacionResolucion: {
      NumeroResolucion: resolucion,
      FechaDesde: dian.resolucion_fecha_desde ? String(dian.resolucion_fecha_desde).slice(0, 10) : undefined,
      FechaHasta: dian.resolucion_fecha_hasta ? String(dian.resolucion_fecha_hasta).slice(0, 10) : undefined,
      Prefijo: prefix,
      ConsecutivoDesde: 1,
      ConsecutivoHasta: 5000,
    },
    Emisor: {
      TipoIdentificacion: '31',
      NumeroIdentificacion: doc || '900000000',
      DV: dv != null ? String(dv) : '0',
      RazonSocial: tienda.titular_cuenta || tienda.nombres || 'Mi empresa',
      RegimenFiscal: regimenFinal,
      ResponsabilidadFiscal: responsabilidadFinal,
      Direccion: dian.direccion_fiscal || null,
      Departamento: departamento,
      Municipio: municipio,
    },
    FacturaPorCuentaDe: facturaPorCuentaDe,
    DetallesFactura: {
      FechaEmision: new Date().toISOString().slice(0, 10),
      HoraEmision: '10:00:00-05:00',
      Moneda: esExportacion ? 'USD' : 'COP',
      FormaPago: '1',
      MedioPago: '10',
      Observaciones: esExportacion
        ? 'Venta de bienes de EXPORTACIÓN: operación excluida de IVA conforme al artículo 481 del Estatuto Tributario. La factura se emite en moneda extranjera (USD) para la exportación de mercancías al exterior.'
        : undefined,
    },
    LineasDeFactura: lineas,
  });
};
