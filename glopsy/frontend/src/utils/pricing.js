// Cálculo del precio de venta publicado.
//
// El proveedor ingresa su PRECIO DE VENTA (en la moneda de la tienda) y el
// sistema le suma, según el país de la tienda:
//   + IVA (si aplica)
//   + comisión de Glopsy por categoría
//   + comisión de la pasarela de pago
// El resultado es el PRECIO TOTAL que se publica (suggested_price).
//
// El Precio Base es solo control interno y NO entra en este cálculo.

import { ivaRateForCountry } from './iva';

// Tarifas de pasarela por país. CO: ePayco (tarifa general publicada).
// VE queda en 0 hasta definir la pasarela; ajustar aquí si cambia.
export const GATEWAY_FEES = {
  CO: { label: 'ePayco', percent: 3.29, fixed: 700, ivaOnFee: 19 },
  VE: { label: 'Pasarela', percent: 0, fixed: 0, ivaOnFee: 0 },
};

export const gatewayFeeForCountry = (paisCodigo) =>
  GATEWAY_FEES[String(paisCodigo || '').toUpperCase()] || GATEWAY_FEES.CO;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Devuelve el desglose y el total. `salePrice` es el precio que puso el proveedor.
export const calculatePublishedPrice = ({
  salePrice,
  paisCodigo,
  ivaAplica = false,
  glopsyPorcentaje = 0,
  gateway,
} = {}) => {
  const price = Number(salePrice) || 0;
  const fee = gateway || gatewayFeeForCountry(paisCodigo);
  const ivaPct = ivaAplica ? ivaRateForCountry(paisCodigo) : 0;
  const glopsyPct = Number(glopsyPorcentaje) || 0;

  const iva = round2((price * ivaPct) / 100);
  const glopsy = round2((price * glopsyPct) / 100);
  const gatewayBase = round2((price * (Number(fee.percent) || 0)) / 100 + (Number(fee.fixed) || 0));
  const gatewayIva = round2((gatewayBase * (Number(fee.ivaOnFee) || 0)) / 100);
  const gatewayTotal = round2(gatewayBase + gatewayIva);
  const total = round2(price + iva + glopsy + gatewayTotal);

  return {
    price,
    ivaPct,
    iva,
    glopsyPct,
    glopsy,
    gateway: fee,
    gatewayBase,
    gatewayIva,
    gatewayTotal,
    total,
    extra: round2(total - price),
  };
};
