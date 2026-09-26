// ==========================================
// Informe de Recaudos por Mandato (blindaje DIAN)
//
// Documento de soporte para operar bajo mandato (arts. 1262 C.Co.): acredita
// que el dinero recaudado en la cuenta de pagos de la plataforma NO es ingreso
// de la tienda, sino recaudo por cuenta de un tercero (mandante). Solo la
// comisión pactada es ingreso gravado del emisor.
//
// Resumen por orden: valor recaudado, comisión retenida, neto a transferir al
// tercero.
// ==========================================

import PDFDocument from 'pdfkit';
import { pool } from '../db.js';
import { resolveCommissionRate } from './ledger.service.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const buildMandateReport = async (tiendaId, { desde, hasta } = {}) => {
  const { rows: tRows } = await pool.query(
    `SELECT usrid, nombres, titular_cuenta, titular_documento, moneda, pais_id
     FROM tiendas WHERE usrid = $1 LIMIT 1`,
    [tiendaId]
  );
  const tienda = tRows[0];
  if (!tienda) return { ok: false, reason: 'sin_tienda' };

  const { rows: dianRows } = await pool.query(
    `SELECT numero_resolucion, regimen, responsabilidad,
            mandato_activo, mandato_tercero_nombre, mandato_tercero_tipo_documento,
            mandato_tercero_documento
     FROM tienda_dian WHERE tienda_id = $1 LIMIT 1`,
    [tiendaId]
  );
  const mandato = dianRows[0] || {};
  const terceroNombre = mandato.mandato_tercero_nombre || '';
  const terceroDoc = String(mandato.mandato_tercero_documento || '').replace(/\D/g, '');
  const mandatoActivo = mandato.mandato_activo === true || mandato.mandato_activo === 'true';

  const desdeFecha = desde || '1970-01-01';
  const hastaFecha = hasta || new Date().toISOString().slice(0, 10);

  const { rows: orders } = await pool.query(
    `SELECT o.id, o.order_number, o.created_at, o.amount, o.customer_name, o.es_exportacion
     FROM orders o
     WHERE o.tienda_id = $1
       AND o.status = 'Completado'
       AND o.created_at >= $2::date
       AND o.created_at < ($3::date + INTERVAL '1 day')
     ORDER BY o.created_at ASC`,
    [tiendaId, desdeFecha, hastaFecha]
  );

  const rateCache = new Map();
  const detalle = [];

  for (const order of orders) {
    const { rows: lineas } = await pool.query(
      `SELECT oi.product_id, oi.line_total, p.categoria_id
       FROM order_items oi
       JOIN produc p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [order.id]
    );

    let comision = 0;
    for (const linea of lineas) {
      const cacheKey = `${linea.product_id}:${linea.categoria_id}`;
      let rate = rateCache.get(cacheKey);
      if (rate === undefined) {
        rate = await resolveCommissionRate(pool, {
          productoId: linea.product_id,
          categoriaId: linea.categoria_id,
          tiendaId,
        });
        rateCache.set(cacheKey, rate);
      }
      comision = round2(comision + (Number(linea.line_total) || 0) * rate / 100);
    }

    const recaudado = round2(Number(order.amount) || 0);
    detalle.push({
      fecha: order.created_at,
      numero: order.order_number || `ORD-${order.id}`,
      cliente: order.customer_name || 'Consumidor final',
      recaudado,
      comision: round2(comision),
      neto: round2(recaudado - comision),
      es_exportacion: order.es_exportacion === true,
    });
  }

  const totals = detalle.reduce(
    (a, d) => ({
      recaudado: round2(a.recaudado + d.recaudado),
      comision: round2(a.comision + d.comision),
      neto: round2(a.neto + d.neto),
    }),
    { recaudado: 0, comision: 0, neto: 0 }
  );

  return {
    ok: true,
    periodo: { desde: desdeFecha, hasta: hastaFecha },
    emisor: {
      nombre: tienda.titular_cuenta || tienda.nombres || '',
      documento: tienda.titular_documento || '',
      moneda: tienda.moneda || 'COP',
    },
    mandato: {
      activo: mandatoActivo,
      terceroNombre,
      terceroTipo: mandato.mandato_tercero_tipo_documento || '',
      terceroDocumento: terceroDoc,
      resolucion: mandato.numero_resolucion || '',
      regimen: mandato.regimen || '',
      responsabilidad: mandato.responsabilidad || '',
    },
    detalle,
    totals,
  };
};

export const buildMandateReportPdf = (data) => new Promise((resolve, reject) => {
  try {
    const doc = new PDFDocument({ size: 'A4', landscape: true, margin: 30 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const fmt = (n) => Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const cols = [
      { key: 'fecha', label: 'Fecha', w: 75 },
      { key: 'numero', label: 'N° Factura', w: 100 },
      { key: 'cliente', label: 'Cliente', w: 215 },
      { key: 'export', label: 'Export.', w: 55 },
      { key: 'recaudado', label: 'Recaudado', w: 90, num: true },
      { key: 'comision', label: 'Comisión (tú)', w: 90, num: true },
      { key: 'neto', label: 'A transferir al tercero', w: 115, num: true },
    ];

    doc.fontSize(14).font('Helvetica-Bold').text('INFORME DE RECAUDOS POR MANDATO', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');
    doc.text(`Plataforma/Mandatario: ${data.emisor.nombre}    NIT/CC: ${data.emisor.documento || '—'}`);
    doc.text(`Período: ${data.periodo.desde} a ${data.periodo.hasta}    Moneda: ${data.emisor.moneda}`);

    doc.moveDown(0.3);
    if (data.mandato.activo && data.mandato.terceroNombre) {
      doc.text(`Tercero (mandante) por cuya cuenta se recauda: ${data.mandato.terceroNombre} (${data.mandato.terceroTipo || ''} ${data.mandato.terceroDocumento || ''})`);
      doc.text(`Resolución facturación: ${data.mandato.resolucion || '—'}    Régimen: ${data.mandato.regimen || '—'}    Responsabilidad: ${data.mandato.responsabilidad || '—'}`);
    }
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#333').text(
      'Los valores de "Recaudado" corresponden a recaudos por cuenta del tercero identificado arriba, conforme al contrato de ' +
      'mandato (arts. 1262 y siguientes del Código de Comercio). De cada venta, el emisor retiene solo la comisión pactada (' +
      '"Comisión (tú)"); el saldo neto es de titularidad del tercero y no constituye ingreso del emisor ante la DIAN.',
      left, doc.y, { width: right - left }
    );
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
    for (const d of data.detalle) {
      if (doc.y + rowH > doc.page.height - doc.page.margins.bottom - 30) {
        doc.addPage();
        drawHeader();
      }
      let x = left;
      const y = doc.y;
      const v = { ...d, fecha: new Date(d.fecha).toLocaleDateString('es-CO'), export: d.es_exportacion ? 'SÍ' : '·', recaudado: fmt(d.recaudado), comision: fmt(d.comision), neto: fmt(d.neto) };
      cols.forEach((c) => {
        doc.rect(x, y, c.w, rowH).stroke('#ccc');
        doc.fillColor('#000').text(String(v[c.key] ?? ''), x + 3, y + 4, { width: c.w - 6, align: c.num ? 'right' : 'left', lineBreak: false });
        x += c.w;
      });
      doc.y = y + rowH;
    }

    let x = left;
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8);
    const tv = { fecha: 'TOTALES', numero: '', cliente: '', export: data.detalle.some((d) => d.es_exportacion) ? 'SÍ' : '', recaudado: fmt(data.totals.recaudado), comision: fmt(data.totals.comision), neto: fmt(data.totals.neto) };
    cols.forEach((c) => {
      doc.rect(x, y, c.w, rowH).stroke('#999');
      doc.fillColor('#000').text(String(tv[c.key] ?? ''), x + 3, y + 4, { width: c.w - 6, align: c.num ? 'right' : 'left', lineBreak: false });
      x += c.w;
    });
    doc.y = y + rowH;

    doc.moveDown(1).font('Helvetica').fontSize(7).fillColor('#555');
    doc.text(`Documento generado por Glopsy como soporte de operaciones en nombre y por cuenta de terceros. Las facturas electrónicas de venta se emiten con la cláusula "en nombre y por cuenta de" el tercero, de conformidad con la normativa DIAN aplicable. Las ventas marcadas como Export. (SÍ) son exportaciones de bienes excluidas de IVA (art. 481 E.T.).`, left, doc.y, { width: right - left });

    doc.end();
  } catch (err) {
    reject(err);
  }
});