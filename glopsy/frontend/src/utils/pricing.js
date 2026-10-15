// Cálculo del precio de venta publicado.
//
// El proveedor ingresa su PRECIO DE VENTA (en la moneda de la tienda) y el
// sistema le suma, según el país de la tienda:
//   + IVA (si aplica)
//   + comisión de Glopsy por categoría
//   + tarifa MÁXIMA de la pasarela (Bold), que asume el proveedor
// El resultado es el PRECIO TOTAL que se publica (suggested_price).
//
// La tarifa de la pasarela la paga el PROVEEDOR: se cubre con el precio
// publicado (se calcula con el método más caro), por lo que NO se vuelve a
// sumar en el checkout.

import { ivaRateForCountry } from './iva';

// Tarifas públicas de Bold para pagos en línea (antes de IVA y retenciones).
export const BOLD_METHOD_FEES = {
  visa_mastercard: { label: 'Tarjeta Visa / Mastercard', percent: 2.99, fixed: 900, ivaOnFee: 19 },
  otras_tarjetas: { label: 'Otras tarjetas', percent: 3.29, fixed: 900, ivaOnFee: 19 },
  pse_bancolombia: { label: 'PSE / Bancolombia / Billeteras', percent: 2.89, fixed: 900, ivaOnFee: 19 },
  internacional: { label: 'Tarjeta internacional (+1%)', percent: 4.29, fixed: 900, ivaOnFee: 19 },
  qr_breb: { label: 'QR Bre-B (transferencia)', percent: 2.89, fixed: 0, ivaOnFee: 19 },
};

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// --- Entrada de dinero con formato entendible (miles con '.', decimal con ',') ---
// Normaliza lo que el usuario escribe a un valor numérico crudo (decimal con '.').
export const cleanMoneyInput = (str) => {
  let s = String(str ?? '').replace(/[^\d.,]/g, '');
  if (s.includes(',')) {
    // Coma decimal (es-CO): los puntos son separadores de miles.
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Sin coma: los puntos se asumen separadores de miles.
    s = s.replace(/\./g, '');
  }
  const parts = s.split('.');
  s = parts[0] + (parts.length > 1 ? `.${parts.slice(1).join('').slice(0, 2)}` : '');
  return s;
};

// Da formato a un valor crudo: 30000 -> "30.000", 30000.5 -> "30.000,5".
export const formatMoneyInput = (raw) => {
  if (raw === '' || raw === null || raw === undefined) return '';
  const [intPart, decPart] = String(raw).split('.');
  const intFmt = (intPart || '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart !== undefined && decPart !== '' ? `${intFmt},${decPart}` : intFmt;
};

// Recargo de la pasarela según el método de pago Bold.
// `amount` es el monto a cobrar (sin tarifa). Devuelve base (sin IVA), iva y
// el total del recargo. El fijo aplica solo en moneda local (COP).
export const boldGatewayFeeForMethod = (amount, methodKey, { currency = 'COP' } = {}) => {
  const fee = BOLD_METHOD_FEES[methodKey] || BOLD_METHOD_FEES.otras_tarjetas;
  const esLocal = String(currency).toUpperCase() === 'COP';
  const base = round2((Number(amount) * (Number(fee.percent) || 0)) / 100 + (esLocal ? Number(fee.fixed) || 0 : 0));
  const iva = round2(base * (Number(fee.ivaOnFee) || 0) / 100);
  return { method: fee, base, iva, total: round2(base + iva) };
};

// Tarifa MÁXIMA de la pasarela (el método más caro). Se usa para calcular el
// precio publicado de modo que el proveedor quede cubierto en el peor caso.
export const maxBoldGatewayFee = (amount, { currency = 'COP' } = {}) => {
  let best = null;
  for (const key of Object.keys(BOLD_METHOD_FEES)) {
    const calc = boldGatewayFeeForMethod(amount, key, { currency });
    if (!best || calc.total > best.total) best = { methodKey: key, ...calc };
  }
  return best;
};

// Calcula el precio publicado INCLUYENDO la tarifa máxima de pasarela.
export const calculatePublishedPrice = ({
  salePrice,
  paisCodigo,
  ivaAplica = false,
  glopsyPorcentaje = 0,
  gateway = null,
  currency = 'COP',
  includeGateway = true,
} = {}) => {
  const price = Number(salePrice) || 0;
  const ivaPct = ivaAplica ? ivaRateForCountry(paisCodigo) : 0;
  const glopsyPct = Number(glopsyPorcentaje) || 0;

  const iva = round2((price * ivaPct) / 100);
  const glopsy = round2((price * glopsyPct) / 100);
  const base = round2(price + iva + glopsy);

  const gatewayCalc = includeGateway ? maxBoldGatewayFee(base, { currency }) : null;

  return {
    price,
    ivaPct,
    iva,
    glopsyPct,
    glopsy,
    gateway: gateway || (gatewayCalc ? gatewayCalc.method : null),
    gatewayMethodKey: gatewayCalc?.methodKey || null,
    gatewayBase: gatewayCalc?.base || 0,
    gatewayIva: gatewayCalc?.iva || 0,
    gatewayTotal: gatewayCalc?.total || 0,
    total: round2(base + (gatewayCalc?.total || 0)),
    extra: round2(round2(base + (gatewayCalc?.total || 0)) - price),
  };
};