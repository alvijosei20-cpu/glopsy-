// Cálculo del precio de venta publicado.
//
// El proveedor ingresa su PRECIO DE VENTA (en la moneda de la tienda) y el
// sistema le suma, según el país de la tienda:
//   + IVA (si aplica)
//   + comisión de Glopsy por categoría
// El resultado es el PRECIO TOTAL que se publica (suggested_price).
//
// La tarifa de la pasarela NO se suma aquí: Bold cobra distinto según el método
// de pago, así que se agrega en el CHECKOUT al momento que el cliente elige el
// método (ver boldGatewayFeeForMethod). El Precio Base es solo control interno
// y NO entra en este cálculo.

import { ivaRateForCountry } from './iva';

// Tarifas públicas de Bold para pagos en línea (antes de IVA y retenciones).
// Se aplican en el checkout según el método seleccionado por el cliente.
export const BOLD_METHOD_FEES = {
  visa_mastercard: { label: 'Tarjeta Visa / Mastercard', percent: 2.99, fixed: 900, ivaOnFee: 19 },
  otras_tarjetas: { label: 'Otras tarjetas', percent: 3.29, fixed: 900, ivaOnFee: 19 },
  pse_bancolombia: { label: 'PSE / Bancolombia / Billeteras', percent: 2.89, fixed: 900, ivaOnFee: 19 },
  internacional: { label: 'Tarjeta internacional (+1%)', percent: 4.29, fixed: 900, ivaOnFee: 19 },
};

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Recargo de la pasarela para el checkout, según el método de pago Bold.
// `amount` es el total a cobrar (sin tarifa). Devuelve base (sin IVA), iva y
// el total del recargo. El fijo aplica solo en moneda local (COP).
export const boldGatewayFeeForMethod = (amount, methodKey, { currency = 'COP' } = {}) => {
  const fee = BOLD_METHOD_FEES[methodKey] || BOLD_METHOD_FEES.otras_tarjetas;
  const esLocal = String(currency).toUpperCase() === 'COP';
  const base = round2((Number(amount) * (Number(fee.percent) || 0)) / 100 + (esLocal ? Number(fee.fixed) || 0 : 0));
  const iva = round2(base * (Number(fee.ivaOnFee) || 0) / 100);
  return { method: fee, base, iva, total: round2(base + iva) };
};

// Calcula el precio publicado SIN tarifa de pasarela (se agrega en checkout).
export const calculatePublishedPrice = ({
  salePrice,
  paisCodigo,
  ivaAplica = false,
  glopsyPorcentaje = 0,
  gateway,
} = {}) => {
  const price = Number(salePrice) || 0;
  const ivaPct = ivaAplica ? ivaRateForCountry(paisCodigo) : 0;
  const glopsyPct = Number(glopsyPorcentaje) || 0;

  const iva = round2((price * ivaPct) / 100);
  const glopsy = round2((price * glopsyPct) / 100);
  const total = round2(price + iva + glopsy);

  return {
    price,
    ivaPct,
    iva,
    glopsyPct,
    glopsy,
    gateway: gateway || null,
    gatewayBase: 0,
    gatewayIva: 0,
    gatewayTotal: 0,
    total,
    extra: round2(total - price),
  };
};