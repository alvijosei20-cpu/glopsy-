// Cálculo del precio de venta publicado.
//
// El proveedor ingresa su PRECIO DE VENTA (en la moneda de la tienda) y el
// sistema le suma, según el país de la tienda:
//   + IVA (si aplica)
//   + comisión de Glopsy por categoría
//   + tarifa MÁXIMA de la pasarela (ePayco), que asume el proveedor
// El resultado es el PRECIO TOTAL que se publica (suggested_price).
//
// La tarifa de la pasarela la paga el PROVEEDOR: se cubre con el precio
// publicado (se calcula con el método más caro), por lo que NO se vuelve a
// sumar en el checkout.

import { ivaRateForCountry } from './iva';

// Tarifas públicas de ePayco (plan Agregador, otros bancos), antes de IVA.
// Fuente: epayco.com/tarifas (2026). Base 3.29% + $700; tarjeta internacional
// +0.8%; PSE < $60.000 tiene tarifa fija $2.000. IVA 19% sobre el fee.
// No se incluye efectivo.
export const EPAYCO_METHOD_FEES = {
  tarjeta_nacional: { label: 'Tarjeta crédito/débito nacional', percent: 3.29, fixed: 700, ivaOnFee: 19 },
  tarjeta_internacional: { label: 'Tarjeta crédito/débito internacional (+0.8%)', percent: 4.09, fixed: 700, ivaOnFee: 19 },
  pse: { label: 'PSE (≥ $60.000)', percent: 3.29, fixed: 700, ivaOnFee: 19 },
  pse_menor: { label: 'PSE (< $60.000)', percent: 0, fixed: 2000, ivaOnFee: 19 },
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

// Recargo de la pasarela según el método de pago ePayco.
// `amount` es el monto a cobrar (sin tarifa). Devuelve base (sin IVA), iva y
// el total del recargo. El fijo aplica solo en moneda local (COP).
export const epaycoGatewayFeeForMethod = (amount, methodKey, { currency = 'COP' } = {}) => {
  const fee = EPAYCO_METHOD_FEES[methodKey] || EPAYCO_METHOD_FEES.tarjeta_nacional;
  const esLocal = String(currency).toUpperCase() === 'COP';
  const base = round2((Number(amount) * (Number(fee.percent) || 0)) / 100 + (esLocal ? Number(fee.fixed) || 0 : 0));
  const iva = round2(base * (Number(fee.ivaOnFee) || 0) / 100);
  return { method: fee, base, iva, total: round2(base + iva) };
};

// Tarifa MÁXIMA de la pasarela (el método más caro). Se usa para calcular el
// precio publicado de modo que el proveedor quede cubierto en el peor caso.
export const maxEpaycoGatewayFee = (amount, { currency = 'COP' } = {}) => {
  let best = null;
  for (const key of Object.keys(EPAYCO_METHOD_FEES)) {
    const calc = epaycoGatewayFeeForMethod(amount, key, { currency });
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

  const gatewayCalc = includeGateway ? maxEpaycoGatewayFee(base, { currency }) : null;

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