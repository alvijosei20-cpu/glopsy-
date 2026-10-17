// Cotización combinada de envíos internacionales para tiendas de Venezuela:
//  - Tramo 1: origen del producto (publicado por el vendedor) -> oficina de ENVIA.
//  - Tramo 2: oficina de ENVIA -> dirección final del cliente.
// Se elige la oficina más cercana a la ciudad destino y la combinación más económica.
// Todo se cotiza en USD (settings.currency = USD de envia.com).
import { pool } from '../db.js';
import {
  getStoreEnviaCredentials,
  getEnviaCarriers,
  getEnviaBranches,
  getInternationalShippingRates,
  generateEnviaLabel,
  scheduleEnviaPickup,
  getStateCode,
  ensure8DigitDane,
  createCommercialInvoice,
} from './envia.service.js';
import {
  getMastershopIntegrationForStore,
  createMastershopDispatchOrder,
  cancelMastershopDispatchOrder,
  extractMastershopOrderId,
  resolveMastershopOrderRef,
} from './mastershopOrder.service.js';
import {
  getDropanasIntegrationForStore,
  createDropanasDispatchOrder,
} from './dropanasOrder.service.js';
import { resolvePackagingForProduct } from './tariff.service.js';
import { dispatchDomesticOrder } from './domesticShipping.service.js';

const ratePrice = (r) =>
  Number(
    r?.totalPrice ??
      r?.total_price ??
      r?.total ??
      r?.price ??
      r?.amount ??
      Infinity
  );

// Costo de derechos/impuestos de importación (DDP) devuelto por envia.com.
// En /ship/rate viene en landedCostTotal (si Envia Guaranteed está disponible).
const rateLandedCost = (r) => {
  const v = r?.landedCostTotal ?? r?.landed_cost_total ?? null;
  return v === null || v === undefined ? null : Number(v);
};

// Flete sin impuestos: totalPrice - landedCost cuando hay landed cost.
const rateShippingOnly = (r) => {
  const total = ratePrice(r);
  const landed = rateLandedCost(r);
  if (landed === null || !Number.isFinite(total)) return total;
  return Math.max(0, total - landed);
};

// Costo de envío generado por MasterShop al crear el pedido de despacho
// (tarifa de la transportadora + tarifa de primera milla a la bodega).
const mastershopGeneratedShipping = (data) => {
  const lg = data?.orderLogistics || data?.order_logistics || {};
  const rate = Number(lg.shipping_rate ?? lg.shippingRate);
  if (!Number.isFinite(rate)) return null;
  const firstMile = Number(lg.first_mile_fee ?? lg.firstMileFee);
  return Math.round((rate + (Number.isFinite(firstMile) ? firstMile : 0)) * 100) / 100;
};

const pickCheapest = (rates) => {
  if (!Array.isArray(rates) || rates.length === 0) return null;
  return rates.reduce((best, r) => (ratePrice(r) < ratePrice(best) ? r : best));
};

const rateCarrier = (r) => r?.carrier || r?.carrierName || r?.provider || null;
const rateService = (r) => r?.service || r?.serviceName || r?.service_name || null;
const rateCurrency = (r) => r?.currency || r?.currencyId || 'USD';

// ENVIA exige que `state` tenga 2-3 caracteres (código). Si llega el nombre
// completo (ej. "Distrito Capital"), se colapsa a un código corto.
const normalizeState = (state) => {
  const s = String(state || '').trim();
  if (!s) return s;
  if (s.length <= 3) return s.toUpperCase();
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[\s\-]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
};

// Origen del envío: ciudad/departamento con los que se publicó el producto.
const resolveOriginAddress = async (items, tiendaId) => {
  const ids = items.map((i) => Number(i.id)).filter(Boolean);
  let row = null;
  if (ids.length > 0) {
    const { rows } = await pool.query(
      `SELECT c.nombre AS ciudad_nombre, c.codigo_postal, c.codigo_dane,
              d.nombre AS departamento_nombre, p.codigo_iso
       FROM produc pr
       LEFT JOIN fullments f ON pr.fullm_id = f.id
       LEFT JOIN ciudades c ON f.ciudad_id = c.id
       LEFT JOIN departamentos d ON c.departamento_id = d.id
       LEFT JOIN paises p ON d.pais_id = p.id
       WHERE pr.id = ANY($1::int[]) AND c.id IS NOT NULL
       LIMIT 1`,
      [ids]
    );
    row = rows[0] || null;
  }
  if (!row && tiendaId) {
    const { rows } = await pool.query(
      `SELECT c.nombre AS ciudad_nombre, c.codigo_postal, c.codigo_dane,
              d.nombre AS departamento_nombre, p.codigo_iso
       FROM fullments f
       JOIN ciudades c ON f.ciudad_id = c.id
       LEFT JOIN departamentos d ON c.departamento_id = d.id
       LEFT JOIN paises p ON d.pais_id = p.id
       WHERE f.tienda_id = $1 AND f.estado = 'activo'
       LIMIT 1`,
      [tiendaId]
    );
    row = rows[0] || null;
  }
  if (!row) throw new Error('No se pudo determinar la ciudad de origen del pedido.');

  const country = row.codigo_iso || 'CO';
  const isCo = country === 'CO';
  return {
    name: process.env.ENVIA_ORIGIN_NAME || 'Glopsy Store',
    company: process.env.ENVIA_ORIGIN_COMPANY || 'Glopsy',
    phone: process.env.ENVIA_ORIGIN_PHONE || '3000000000',
    street: process.env.ENVIA_ORIGIN_STREET || 'Bodega principal',
    number: process.env.ENVIA_ORIGIN_NUMBER || '1',
    district: undefined,
    city: isCo ? ensure8DigitDane(row.codigo_dane) : row.ciudad_nombre,
    state: isCo ? getStateCode(row.departamento_nombre) : normalizeState(row.departamento_nombre),
    country,
    postalCode: row.codigo_postal || (isCo ? '11001000' : ''),
  };
};

// Paquete consolidado a cotizar + datos de aduana.
// Se consolida TODO el pedido en un único paquete/guía para no fragmentar el
// envío: el régimen de bajo valor (p.ej. Venezuela <= USD 100) se evalúa por
// guía, así que varios paquetes romperían la exención. El detalle por ítem
// (HS code + valor unitario) se envía dentro del arreglo de la aduana.
const buildPackages = async (items) => {
  const ids = items.map((i) => Number(i.id)).filter(Boolean);
  let map = new Map();
  if (ids.length > 0) {
    const { rows } = await pool.query(
      `SELECT id, peso, largo, alto, ancho, hs_code, country_of_manufacture, categoria_id
       FROM produc WHERE id = ANY($1::int[])`,
      [ids]
    );
    map = new Map(rows.map((r) => [Number(r.id), r]));
  }

  let totalWeight = 0;
  let maxLength = 0;
  let maxWidth = 0;
  let maxHeight = 0;
  let declaredValue = 0;
  const customsItems = [];

  for (const it of items) {
    const p = map.get(Number(it.id)) || {};
    const qty = Number(it.quantity) || 1;
    const unitPrice = Number(it.price) || 0;
    const hsCode = p.hs_code || null;
    const originCountry = p.country_of_manufacture || null;
    const content =
      String(it.name || 'Mercancía General').replace(/[^\w\s\+\-\.]/gi, '').trim() || 'Mercancia General';

    // Empaque optimizado por categoría (evita cobrar el volumen de una caja
    // demasiado grande que sobrefactura el peso volumétrico).
    const pack = await resolvePackagingForProduct({
      categoriaId: p.categoria_id,
      peso: p.peso,
      largo: p.largo,
      alto: p.alto,
      ancho: p.ancho,
    });

    totalWeight += pack.weight * qty;
    maxLength = Math.max(maxLength, pack.length);
    maxWidth = Math.max(maxWidth, pack.width);
    maxHeight = Math.max(maxHeight, pack.height);
    declaredValue += unitPrice * qty;

    customsItems.push({
      description: content,
      ...(hsCode ? { hsCode } : {}),
      quantity: qty,
      price: unitPrice,
      ...(originCountry ? { countryOfManufacture: originCountry } : {}),
    });
  }

  const content = customsItems.length > 0 ? customsItems[0].description : 'Mercancia General';
  return [
    {
      type: 'box',
      content,
      amount: customsItems.reduce((a, x) => a + (Number(x.quantity) || 1), 0) || 1,
      weight: Math.max(1, Math.round(totalWeight * 100) / 100),
      weightUnit: 'KG',
      lengthUnit: 'CM',
      declaredValue: Math.round(declaredValue * 100) / 100,
      dimensions: { length: maxLength, width: maxWidth, height: maxHeight },
      items: customsItems,
    },
  ];
};

const buildBranchAddress = (branch, dest) => {
  const a = branch?.address || {};
  return {
    name: 'Oficina ENVIA',
    company: 'ENVIA',
    phone: process.env.ENVIA_BRANCH_PHONE || '0000000000',
    phone_code: dest.phone_code || undefined,
    street: a.street || branch?.reference || 'Oficina',
    number: a.number || '',
    district: a.locality || a.city || undefined,
    city: a.city || a.locality || dest.city,
    state: a.state || normalizeState(dest.state),
    country: a.country || dest.country,
    postalCode: a.postalCode || dest.postalCode,
    reference: branch?.reference || '',
  };
};

const buildDestinationAddress = (dest = {}, order = {}) => ({
  name: dest.name || order.customer_name || 'Cliente',
  email: dest.email || undefined,
  phone: String(dest.phone || order.telefono || '').replace(/[^\d+]/g, '') || undefined,
  street: dest.address || order.direccion || '',
  number: dest.number || '',
  district: dest.district || undefined,
  city: dest.city || '',
  state: dest.state || '',
  country: dest.country || '',
  postalCode: dest.postalCode || '',
});

// Despacha una orden internacional ya pagada:
//  1) crea el pedido de despacho en MasterShop apuntando a la oficina de ENVIA,
//  2) genera la guía ENVIA (oficina -> cliente) y agenda la recogida si está activado.
// Nunca lanza: los errores se registran para no romper el flujo de compra.
export const dispatchInternationalOrder = async (orderId) => {
  try {
    const { rows: orderRows } = await pool.query(`SELECT * FROM orders WHERE id = $1 LIMIT 1`, [orderId]);
    const order = orderRows[0];
    if (!order) return { ok: false, reason: 'order_not_found' };

    const sp = order.shipping_payload || {};
    if (!sp?.international || !sp?.option) return { ok: false, reason: 'not_international' };

    // Idempotencia: si el pedido ya se despachó a MasterShop/DropPanas, no duplicar.
    if (order.payload?.mastershop || order.payload?.dropanas) {
      return { ok: true, already: true, mastershop: order.payload?.mastershop || null };
    }

    const { rows: storeRows } = await pool.query(
      `SELECT international_dispatch_provider, COALESCE(moneda, 'USD') AS moneda FROM tiendas WHERE usrid = $1 LIMIT 1`,
      [order.tienda_id]
    );
    const store = storeRows[0];
    if (!store || !['mastershop', 'dropanas'].includes(store.international_dispatch_provider)) {
      return { ok: false, reason: 'no_dispatch_provider' };
    }

    const { rows: itemRows } = await pool.query(
      `SELECT product_id, product_name, quantity, unit_price FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    const items = itemRows.map((r) => ({
      id: r.product_id,
      name: r.product_name,
      quantity: r.quantity,
      price: Number(r.unit_price || 0),
    }));
    if (items.length === 0) return { ok: false, reason: 'no_items' };

    const option = sp.option;
    const destination = sp.destination || {};

    // MasterShop no despacha a Venezuela: se bloquea el envío a destino VE.
    if (store.international_dispatch_provider === 'mastershop' && String(destination.country || '').toUpperCase() === 'VE') {
      console.warn(`[dispatch] MasterShop→VE bloqueado (orden ${orderId}).`);
      return { ok: false, reason: 'mastershop_no_ve' };
    }
    const isDirect = option?.direct === true || !option?.branch?.address;
    const branchAddress = option?.branch?.address || null;
    if (!isDirect && !branchAddress) return { ok: false, reason: 'no_branch' };

    // En modo directo el paquete va del origen (producto) al comprador; en modo
    // oficina, del origen a la oficina de ENVIA y luego al comprador.
    const originAddress = isDirect
      ? await resolveOriginAddress(items, order.tienda_id).catch(() => null)
      : branchAddress;
    const destAddress = buildDestinationAddress(destination, order);

    const result = { ok: true, mastershop: null, tracking: null, label: null };

    // 1) Pedido de despacho en MasterShop / DropPanas (paquete -> oficina o comprador).
    if (store.international_dispatch_provider === 'dropanas') {
      const dp = await getDropanasIntegrationForStore(order.tienda_id);
      if (dp?.apiKey) {
        try {
          result.mastershop = await createDropanasDispatchOrder({
            apiKey: dp.apiKey,
            orderId: order.order_number || order.id,
            shippingAddress: isDirect ? destAddress : branchAddress,
            items,
            total: Number(order.amount) || 0,
            currency: store.moneda || 'USD',
          });
        } catch (e) {
          console.error('[dispatch] DropPanas:', orderId, e.message);
        }
      }
    } else {
      const ms = await getMastershopIntegrationForStore(order.tienda_id);
      if (ms?.apiKey) {
        try {
          const shippingTotal = Math.round(Number(option.shippingTotal ?? option.total) || 0);
          const additionalCharges = [
            { type_charge: 'Envío internacional', value: shippingTotal },
          ];
          if (option.dutiesAndTaxes != null) {
            additionalCharges.push({
              type_charge: 'Aranceles e impuestos',
              value: Math.round(Number(option.dutiesAndTaxes) || 0),
            });
          }
          result.mastershop = await createMastershopDispatchOrder({
            apiKey: ms.apiKey,
            orderId: order.order_number || order.id,
            shippingAddress: isDirect ? destAddress : branchAddress,
            items,
            total: Number(order.amount) || 0,
            currency: store.moneda || 'COP',
            additionalCharges,
          });
        } catch (e) {
          console.error('[dispatch] MasterShop:', orderId, e.message);
        }
      }
    }

    // Guarda el id de MasterShop/DropPanas para consultas, cancelaciones y
    // actualizaciones posteriores (y para no duplicar el despacho).
    if (result.mastershop) {
      const providerKey = store.international_dispatch_provider === 'dropanas' ? 'dropanas' : 'mastershop';
      const dispatchId = extractMastershopOrderId(result.mastershop);

      // Verificación de precio de envío: el envío cotizado (ENVIA) que cobramos
      // debe ser igual o superior al que MasterShop genera al crear el pedido.
      // Si MasterShop sale más caro, quedamos sub-cotizados (perdemos dinero).
      const quotedShipping = Math.round(Number(option.shippingTotal ?? option.total) || 0);
      const mastershopShipping = mastershopGeneratedShipping(result.mastershop);
      let shippingCheck = null;
      if (mastershopShipping != null) {
        const ok = quotedShipping >= mastershopShipping;
        shippingCheck = {
          quoted: quotedShipping,
          mastershop: mastershopShipping,
          ok,
          diff: Math.round((quotedShipping - mastershopShipping) * 100) / 100,
        };
        if (!ok) {
          console.warn(
            `[dispatch] Envío SUB-COTIZADO orden ${orderId}: cotizado=${quotedShipping} < MasterShop=${mastershopShipping} (faltante ${shippingCheck.diff})`
          );
        }
      }

      await pool.query(
        `UPDATE orders
         SET payload = COALESCE(payload, '{}'::jsonb) || $2::jsonb, updated_at = NOW()
         WHERE id = $1`,
        [
          orderId,
          JSON.stringify({
            [providerKey]: {
              ...(dispatchId ? { id: dispatchId } : {}),
              raw: result.mastershop,
              dispatched_at: new Date().toISOString(),
            },
            shipping_check: shippingCheck,
          }),
        ]
      );
    }

    // 2) Guía ENVIA (directo origen -> comprador, u oficina -> comprador).
    const creds = await getStoreEnviaCredentials(order.tienda_id);
    if (creds?.accessToken && originAddress) {
      try {
        const packages = await buildPackages(items);
        const labelCarrier = isDirect
          ? (option.leg1?.carrier || option.carrier)
          : (option.leg2?.carrier || option.carrier);
        const label = await generateEnviaLabel({
          accessToken: creds.accessToken,
          mode: creds.mode,
          origin: isDirect ? originAddress : { ...originAddress, branchCode: option.branch.code },
          destination: destAddress,
          packages,
          carrier: labelCarrier,
          service: isDirect ? option.leg1?.service : option.leg2?.service,
          currency: 'USD',
          orderReference: order.order_number || String(order.id),
          customsSettings: { dutiesPaymentEntity: 'envia_guaranteed', exportReason: 'sale' },
        });
        result.tracking = label?.trackingNumber || label?.tracking || null;
        result.label = label?.label || label?.labelUrl || null;

        await pool.query(
          `UPDATE order_shipments
           SET tracking_code = COALESCE($2, tracking_code),
               carrier = COALESCE($3, carrier),
               fulfillment_status = 'pending',
               payload = COALESCE(payload, '{}'::jsonb) || $4::jsonb,
               updated_at = NOW()
           WHERE order_id = $1`,
          [orderId, result.tracking, labelCarrier, JSON.stringify({ international: true, option, enviaLabel: label })]
        );

        // 3) Factura comercial (documento de exportación para la aduana).
        if (result.tracking) {
          try {
            const invoice = await createCommercialInvoice({
              accessToken: creds.accessToken,
              mode: creds.mode,
              origin: isDirect ? originAddress : { ...originAddress, branchCode: option.branch.code },
              destination: destAddress,
              shipment: { carrier: labelCarrier, trackingNumber: result.tracking },
              packages: packages.map((p) => ({
                items: (p.items || []).map((it) => ({
                  description: it.description || p.content,
                  productCode: it.hsCode || it.productCode || '',
                  quantity: Number(it.quantity) || 1,
                  price: Number(it.price) || 0,
                  ...(it.countryOfManufacture ? { countryOfManufacture: it.countryOfManufacture } : {}),
                })),
              })),
              customsSettings: { dutiesPaymentEntity: 'envia_guaranteed', exportReason: 'sale' },
            });
            result.commercialInvoice = invoice?.billOfLading || invoice?.commercialInvoice || null;
            const customsPayload = {
              option,
              hsCodes: packages.flatMap((p) => (p.items || []).map((it) => it.hsCode)).filter(Boolean),
              declaredValue: packages.reduce((s, p) => s + (Number(p.declaredValue) || 0), 0),
              dutiesPaymentEntity: 'envia_guaranteed',
              exportReason: 'sale',
              commercialInvoiceUrl: result.commercialInvoice,
            };
            await pool.query(
              `UPDATE orders
               SET commercial_invoice_url = COALESCE($2, commercial_invoice_url),
                   customs_payload = $3::jsonb,
                   updated_at = NOW()
               WHERE id = $1`,
              [orderId, result.commercialInvoice, JSON.stringify(customsPayload)]
            );
          } catch (e) {
            console.error('[dispatch] Factura comercial ENVIA:', orderId, e.message);
          }
        }

        if (String(process.env.ENVIA_SCHEDULE_PICKUP).toLowerCase() === 'true' && result.tracking) {
          try {
            const pickup = await scheduleEnviaPickup({
              accessToken: creds.accessToken,
              mode: creds.mode,
              origin: originAddress,
              carrier: labelCarrier,
              trackingNumbers: [result.tracking],
              totalPackages: 1,
            });
            result.pickup = pickup;
          } catch (e) {
            console.error('[dispatch] Pickup ENVIA:', orderId, e.message);
          }
        }
      } catch (e) {
        console.error('[dispatch] ENVIA label:', orderId, e.message);
      }
    }

    return result;
  } catch (error) {
    console.error('[dispatch] Error despachando orden internacional:', orderId, error.message);
    return { ok: false, reason: 'error', message: error.message };
  }
};

// Estados de orden que representan un pago confirmado.
const PAID_ORDER_STATUSES = new Set(['Completado', 'approved', 'paid', 'authorized']);
const isPaidOrderStatus = (status) => PAID_ORDER_STATUSES.has(String(status || ''));

// Despacha el pedido a MasterShop/DropPanas SOLO cuando el pago está confirmado.
// Se llama desde las confirmaciones de pago (Bold botón/QR, Mercado Pago, 1-Click).
export const fulfillPaidOrder = async (orderId) => {
  try {
    const { rows } = await pool.query(
      `SELECT status, shipping_payload FROM orders WHERE id = $1 LIMIT 1`,
      [orderId]
    );
    if (!rows[0]) return { ok: false, reason: 'order_not_found' };
    if (!isPaidOrderStatus(rows[0].status)) {
      return { ok: false, reason: 'not_paid', status: rows[0].status };
    }
    // Pedido internacional -> MasterShop/DropPanas; local -> guía ENVIA.
    const sp = rows[0].shipping_payload || {};
    if (sp?.international) return await dispatchInternationalOrder(orderId);
    return await dispatchDomesticOrder(orderId);
  } catch (error) {
    console.error('[dispatch] fulfillPaidOrder:', orderId, error.message);
    return { ok: false, reason: 'error', message: error.message };
  }
};

// Cancela el pedido de despacho en MasterShop cuando el pago se rechaza o se
// reembolsa (si no se había despachado, no hace nada).
export const cancelInternationalDispatchForOrder = async (orderId) => {
  try {
    if (!orderId) return { ok: false, reason: 'no_order' };
    const { rows } = await pool.query(`SELECT * FROM orders WHERE id = $1 LIMIT 1`, [orderId]);
    const order = rows[0];
    if (!order) return { ok: false, reason: 'order_not_found' };

    const sp = order.shipping_payload || {};
    if (!sp?.international) return { ok: false, reason: 'not_international' };

    const { rows: storeRows } = await pool.query(
      `SELECT international_dispatch_provider FROM tiendas WHERE usrid = $1 LIMIT 1`,
      [order.tienda_id]
    );
    if (storeRows[0]?.international_dispatch_provider !== 'mastershop') {
      return { ok: false, reason: 'no_dispatch_provider' };
    }

    const ms = await getMastershopIntegrationForStore(order.tienda_id);
    if (!ms?.apiKey) return { ok: false, reason: 'no_integration' };

    const cancelled = await cancelMastershopDispatchOrder({
      apiKey: ms.apiKey,
      orderId: resolveMastershopOrderRef(order),
    });

    if (cancelled) {
      await pool.query(
        `UPDATE orders
         SET payload = COALESCE(payload, '{}'::jsonb) || $2::jsonb, updated_at = NOW()
         WHERE id = $1`,
        [orderId, JSON.stringify({ mastershop_cancelled_at: new Date().toISOString() })]
      );
    }
    return { ok: cancelled };
  } catch (error) {
    console.error('[dispatch] cancelInternationalDispatchForOrder:', orderId, error.message);
    return { ok: false, reason: 'error', message: error.message };
  }
};

export default { dispatchInternationalOrder, fulfillPaidOrder, cancelInternationalDispatchForOrder };
