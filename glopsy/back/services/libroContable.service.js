// ==========================================
// Libro de Ventas y Contabilidad (exportable).
//
// Genera el libro contable de la tienda con el desglose completo (costo base,
// costo de venta, tarifa Glopsy, tarifa de pasarela e IVA) a partir del ledger.
// Las columnas y el encabezado se ajustan al país de la tienda:
//   CO -> DIAN (NIT, base gravable, IVA, total facturado)
//   VE -> SENIAT (RIF/CI, base imponible, IVA, total)
// ==========================================

import { pool } from '../db.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Celda CSV segura (delimitador ';', comillas dobles cuando aplica).
const csvCell = (v) => {
  const s = String(v ?? '');
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const getLibroContableData = async (tiendaId, { desde, hasta, moneda } = {}) => {
  const { rows: tRows } = await pool.query(
    `SELECT t.nombres, t.titular_cuenta, t.titular_documento, t.tipo_documento,
            COALESCE(t.moneda, pa.moneda, 'COP') AS moneda,
            COALESCE(pa.codigo_iso, 'CO') AS pais_iso
     FROM tiendas t
     LEFT JOIN paises pa ON pa.id = t.pais_id
     WHERE t.usrid = $1 LIMIT 1`,
    [tiendaId]
  );
  const tienda = tRows[0];
  if (!tienda) return null;

  const currency = String(moneda || tienda.moneda || 'COP').toUpperCase();
  const desdeFecha = desde || '1970-01-01';
  const hastaFecha = hasta || new Date().toISOString().slice(0, 10);

  const { rows } = await pool.query(
    `SELECT o.id AS order_id, o.order_number, o.created_at,
            o.customer_name, o.identification_type, o.identification_number,
            COALESCE(o.es_exportacion, false) AS es_exportacion,
            COALESCE(SUM(l.base_cost), 0) AS base_cost,
            COALESCE(SUM(l.sale_amount), 0) AS sale_amount,
            COALESCE(SUM(l.glopsy_fee), 0) AS glopsy_fee,
            COALESCE(SUM(l.gateway_fee), 0) AS gateway_fee,
            COALESCE(SUM(l.iva), 0) AS iva,
            COALESCE(SUM(l.provider_net), 0) AS provider_net
     FROM ledger_sale_lines l
     JOIN orders o ON o.id = l.order_id
     WHERE l.tienda_id = $1 AND l.moneda = $2
       AND l.created_at >= $3::date
       AND l.created_at < ($4::date + INTERVAL '1 day')
     GROUP BY o.id
     ORDER BY o.created_at ASC`,
    [tiendaId, currency, desdeFecha, hastaFecha]
  );

  const facturas = rows.map((r, i) => {
    const total = round2(r.sale_amount);
    const iva = round2(r.iva);
    return {
      consecutivo: i + 1,
      fecha: r.created_at,
      numero: r.order_number || '',
      tipoDoc: r.identification_type || '',
      identificacion: r.identification_number || '',
      cliente: r.customer_name || 'Consumidor final',
      base: round2(total - iva),
      iva,
      total,
      baseCost: round2(r.base_cost),
      glopsyFee: round2(r.glopsy_fee),
      gatewayFee: round2(r.gateway_fee),
      providerNet: round2(r.provider_net),
      esExportacion: r.es_exportacion === true,
    };
  });

  const totals = facturas.reduce(
    (a, f) => ({
      base: round2(a.base + f.base),
      iva: round2(a.iva + f.iva),
      total: round2(a.total + f.total),
      baseCost: round2(a.baseCost + f.baseCost),
      glopsyFee: round2(a.glopsyFee + f.glopsyFee),
      gatewayFee: round2(a.gatewayFee + f.gatewayFee),
      providerNet: round2(a.providerNet + f.providerNet),
    }),
    { base: 0, iva: 0, total: 0, baseCost: 0, glopsyFee: 0, gatewayFee: 0, providerNet: 0 }
  );

  return {
    pais: String(tienda.pais_iso || 'CO').toUpperCase(),
    emisor: {
      nombre: tienda.titular_cuenta || tienda.nombres || '',
      documento: tienda.titular_documento || '',
      tipoDocumento: tienda.tipo_documento || '',
    },
    moneda: currency,
    periodo: { desde: desdeFecha, hasta: hastaFecha },
    facturas,
    totals,
  };
};

// CSV del libro contable. Delimitador ';' (estándar en Colombia/Venezuela).
export const buildLibroContableCsv = (data) => {
  if (!data) return null;
  const esCO = data.pais === 'CO';
  const normativa = esCO ? 'DIAN (Colombia)' : 'SENIAT (Venezuela)';
  const docLabel = esCO ? 'NIT' : 'RIF/CI';

  const lines = [];
  lines.push(csvCell('LIBRO DE VENTAS Y CONTABILIDAD'));
  lines.push([csvCell('Normativa'), csvCell(normativa)].join(';'));
  lines.push([csvCell('Razón social'), csvCell(data.emisor.nombre)].join(';'));
  lines.push([csvCell(docLabel), csvCell(data.emisor.documento)].join(';'));
  lines.push([csvCell('Período'), csvCell(`${data.periodo.desde} a ${data.periodo.hasta}`)].join(';'));
  lines.push([csvCell('Moneda'), csvCell(data.moneda)].join(';'));
  lines.push('');

  const headers = [
    'Consecutivo', 'Fecha', 'N° Factura', 'Tipo Doc', docLabel, 'Cliente',
    'Base gravable', 'IVA', 'Total facturado',
    'Costo base', 'Tarifa Glopsy', 'Tarifa pasarela', 'Neto proveedor',
  ];
  lines.push(headers.map(csvCell).join(';'));

  const fmtDate = (d) => {
    try { return new Date(d).toISOString().slice(0, 10); } catch { return ''; }
  };
  const num = (n) => Number(n || 0).toFixed(2);

  for (const f of data.facturas) {
    lines.push([
      f.consecutivo, fmtDate(f.fecha), f.numero, f.tipoDoc, f.identificacion, f.cliente,
      num(f.base), num(f.iva), num(f.total),
      num(f.baseCost), num(f.glopsyFee), num(f.gatewayFee), num(f.providerNet),
    ].map(csvCell).join(';'));
  }

  lines.push([
    '', '', '', '', '', 'TOTALES',
    num(data.totals.base), num(data.totals.iva), num(data.totals.total),
    num(data.totals.baseCost), num(data.totals.glopsyFee), num(data.totals.gatewayFee), num(data.totals.providerNet),
  ].map(csvCell).join(';'));

  return '\uFEFF' + lines.join('\r\n');
};
