// ==========================================
// Reporte fiscal BA VEN-NIF N° 12 — "Tenencia de Criptoactivos Propios"
// (FCCPV). Se arma a partir de las operaciones/ventas de la tienda.
//
// Nota: el BA VEN-NIF 12 es una norma contable sobre criptoactivos, no un
// formato de declaración del SENIAT. Este documento resume las revelaciones
// requeridas y las operaciones del período.
// ==========================================

import { pool } from '../db.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const getBaVenNif12Report = async (tiendaId, { desde, hasta } = {}) => {
  const { rows: tRows } = await pool.query(
    `SELECT nombres, moneda, pais_id, titular_cuenta, titular_documento, banco_codigo, banco_nombre
     FROM tiendas WHERE usrid = $1 LIMIT 1`,
    [tiendaId]
  );
  const tienda = tRows[0];
  if (!tienda) return null;

  const desdeFecha = desde || '1970-01-01';
  const hastaFecha = hasta || new Date().toISOString().slice(0, 10);

  const { rows: ventas } = await pool.query(
    `SELECT order_number, amount, status, created_at
     FROM orders
     WHERE tienda_id = $1
       AND created_at >= $2::date
       AND created_at < ($3::date + INTERVAL '1 day')
     ORDER BY created_at ASC`,
    [tiendaId, desdeFecha, hastaFecha]
  );

  const totalVentas = round2(ventas.reduce((a, v) => a + Number(v.amount || 0), 0));

  // Criptoactivos asociados al cobro/liquidación de la tienda.
  const criptoactivos = [];
  if (tienda.banco_codigo === 'BINANCE_PAY') {
    criptoactivos.push({
      tipo: 'Binance Pay (stablecoins: USDT/USDC)',
      intencion: 'Cobro y liquidación de ventas en el exterior',
      fuenteValor: 'Valor de referencia publicado por el mercado (Nivel 1/2)',
    });
  }

  return {
    documento: 'BA VEN-NIF N° 12 — Tenencia de Criptoactivos Propios',
    emisor: {
      nombre: tienda.titular_cuenta || tienda.nombres,
      rif: tienda.titular_documento || '',
      moneda: tienda.moneda || 'USD',
    },
    periodo: { desde: desdeFecha, hasta: hastaFecha },
    resumen: {
      operaciones: ventas.length,
      totalVentas,
      promedio: ventas.length ? round2(totalVentas / ventas.length) : 0,
    },
    ventas: ventas.map((v) => ({
      fecha: v.created_at,
      numero: v.order_number || '',
      monto: round2(v.amount || 0),
      estado: v.status || '',
    })),
    criptoactivos,
    revelaciones: [
      'Tipos de criptoactivos que controla la entidad y restricciones, si las hubiere.',
      'Intención de uso relativa a cada grupo de criptoactivos.',
      'Fuente de información base para la medición reconocida (valor razonable Nivel 1/2).',
      'Conciliación de cambios en el importe en libros: cambios de valor razonable, adquisiciones, ventas/desincorporaciones e intercambios.',
    ],
  };
};
