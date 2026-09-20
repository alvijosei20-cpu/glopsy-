// ==========================================
// Libro de Ventas (SENIAT, Venezuela) en PDF.
// Se arma desde las órdenes de la tienda en el período.
// IVA por defecto 16%; IGTF 3% cuando la tienda opera en divisas (USD).
// ==========================================

import PDFDocument from 'pdfkit';
import { pool } from '../db.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const IVA_RATE = Number(process.env.LIBRO_IVA_RATE || 0.16);
const IGTF_RATE = Number(process.env.LIBRO_IGTF_RATE || 0.03);

export const getLibroVentasData = async (tiendaId, { desde, hasta } = {}) => {
  const { rows: tRows } = await pool.query(
    `SELECT nombres, moneda, titular_cuenta, titular_documento
     FROM tiendas WHERE usrid = $1 LIMIT 1`,
    [tiendaId]
  );
  const tienda = tRows[0];
  if (!tienda) return null;

  const desdeFecha = desde || '1970-01-01';
  const hastaFecha = hasta || new Date().toISOString().slice(0, 10);
  const esDivisa = String(tienda.moneda || '').toUpperCase() !== 'VES';

  const { rows } = await pool.query(
    `SELECT order_number, created_at, amount, customer_name,
            identification_type, identification_number, status
     FROM orders
     WHERE tienda_id = $1
       AND created_at >= $2::date
       AND created_at < ($3::date + INTERVAL '1 day')
     ORDER BY created_at ASC`,
    [tiendaId, desdeFecha, hastaFecha]
  );

  const facturas = rows.map((r) => {
    const total = round2(r.amount || 0);
    const base = round2(total / (1 + IVA_RATE));
    const iva = round2(total - base);
    const igtf = esDivisa ? round2(total * IGTF_RATE) : 0;
    return {
      fecha: r.created_at,
      numero: r.order_number || '',
      rif: r.identification_number || '',
      tipoDoc: r.identification_type || '',
      nombre: r.customer_name || 'Consumidor final',
      total,
      base,
      iva,
      igtf,
    };
  });

  const totals = facturas.reduce(
    (a, f) => ({
      total: round2(a.total + f.total),
      base: round2(a.base + f.base),
      iva: round2(a.iva + f.iva),
      igtf: round2(a.igtf + f.igtf),
    }),
    { total: 0, base: 0, iva: 0, igtf: 0 }
  );

  return {
    emisor: {
      nombre: tienda.titular_cuenta || tienda.nombres,
      rif: tienda.titular_documento || '',
      moneda: tienda.moneda || 'USD',
    },
    periodo: { desde: desdeFecha, hasta: hastaFecha },
    facturas,
    totals,
  };
};

export const buildLibroVentasPdf = (data) => new Promise((resolve, reject) => {
  try {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const fmt = (n) => Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const cols = [
      { key: 'fecha', label: 'Fecha', w: 70 },
      { key: 'numero', label: 'N° Factura', w: 70 },
      { key: 'rif', label: 'RIF/CI', w: 95 },
      { key: 'nombre', label: 'Nombre / Razón Social', w: 210 },
      { key: 'total', label: 'Total', w: 80, num: true },
      { key: 'base', label: 'Base', w: 80, num: true },
      { key: 'iva', label: 'IVA', w: 70, num: true },
      { key: 'igtf', label: 'IGTF', w: 60, num: true },
    ];

    doc.fontSize(14).font('Helvetica-Bold').text('LIBRO DE VENTAS', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');
    doc.text(`Entidad: ${data.emisor.nombre}`);
    doc.text(`RIF/CI: ${data.emisor.rif || '—'}    Moneda: ${data.emisor.moneda}`);
    doc.text(`Período: ${data.periodo.desde} a ${data.periodo.hasta}`);
    doc.moveDown(0.6);

    const rowH = 16;
    const drawHeader = () => {
      let x = left;
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(8);
      cols.forEach((c) => {
        doc.rect(x, y, c.w, rowH).stroke('#999');
        doc.fillColor('#000').text(c.label, x + 3, y + 4, { width: c.w - 6, align: c.num ? 'right' : 'left' });
        x += c.w;
      });
      doc.y = y + rowH;
    };
    drawHeader();

    doc.font('Helvetica').fontSize(8);
    for (const f of data.facturas) {
      if (doc.y + rowH > doc.page.height - doc.page.margins.bottom - 30) {
        doc.addPage();
        drawHeader();
      }
      let x = left;
      const y = doc.y;
      const fecha = new Date(f.fecha).toLocaleDateString('es-VE');
      const vals = { ...f, fecha, total: fmt(f.total), base: fmt(f.base), iva: fmt(f.iva), igtf: fmt(f.igtf) };
      cols.forEach((c) => {
        doc.rect(x, y, c.w, rowH).stroke('#ccc');
        doc.fillColor('#000').text(String(vals[c.key] ?? ''), x + 3, y + 4, { width: c.w - 6, align: c.num ? 'right' : 'left', lineBreak: false });
        x += c.w;
      });
      doc.y = y + rowH;
    }

    let x = left;
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8);
    const tvals = {
      fecha: 'TOTALES', numero: '', rif: '', nombre: '',
      total: fmt(data.totals.total), base: fmt(data.totals.base), iva: fmt(data.totals.iva), igtf: fmt(data.totals.igtf),
    };
    cols.forEach((c) => {
      doc.rect(x, y, c.w, rowH).stroke('#999');
      doc.fillColor('#000').text(String(tvals[c.key] ?? ''), x + 3, y + 4, { width: c.w - 6, align: c.num ? 'right' : 'left', lineBreak: false });
      x += c.w;
    });
    doc.y = y + rowH;

    doc.moveDown(1).font('Helvetica').fontSize(7).fillColor('#555');
    doc.text(`IVA aplicado: ${(IVA_RATE * 100).toFixed(0)}%. IGTF: ${(IGTF_RATE * 100).toFixed(0)}% ${data.emisor.moneda !== 'VES' ? '(divisas)' : '(no aplica)'}. Documento generado por Glopsy.`, left, doc.y, { width: right - left });

    doc.end();
  } catch (err) {
    reject(err);
  }
});
