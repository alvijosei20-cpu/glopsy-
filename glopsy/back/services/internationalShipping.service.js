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
} from './mastershopOrder.service.js';
import {
  getDropanasIntegrationForStore,
  createDropanasDispatchOrder,
} from './dropanasOrder.service.js';
import { resolvePackagingForProduct } from './tariff.service.js';

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

export const getInternationalShippingOptions = async ({
  tiendaId,
  items = [],
  destination,
  currency = 'USD',
  maxCarriers = 5,
  maxBranchesPerCarrier = 2,
} = {}) => {
  if (!destination?.country) throw new Error('Falta el país de destino.');
  if (!Array.isArray(items) || items.length === 0) throw new Error('No hay productos para cotizar.');

  // Normaliza el estado destino al código que exige ENVIA (2-3 letras).
  destination = { ...destination, state: normalizeState(destination.state), country: String(destination.country).toUpperCase() };

  const creds = await getStoreEnviaCredentials(tiendaId);
  if (!creds?.accessToken) {
    throw new Error('La tienda no tiene ENVIA configurado para envíos internacionales.');
  }

  const origin = await resolveOriginAddress(items, tiendaId);
  const packages = await buildPackages(items);

  // DDP garantizado: envia.com cotiza flete + derechos/impuestos de importación.
  const customsSettings = { dutiesPaymentEntity: 'envia_guaranteed', exportReason: 'sale' };

  const carriers = await getEnviaCarriers({
    accessToken: creds.accessToken,
    mode: creds.mode,
    countryCode: destination.country,
  }).catch(() => []);
  const carrierNames = carriers
    .map((c) => c?.name || c?.carrier || c?.slug)
    .filter(Boolean)
    .slice(0, maxCarriers);

  const destAddress = {
    name: destination.name || 'Cliente',
    email: destination.email || undefined,
    phone: String(destination.phone || '').replace(/[^\d+]/g, '') || undefined,
    phone_code: destination.phone_code || undefined,
    street: destination.street || destination.address || '',
    number: destination.number || '',
    district: destination.district || undefined,
    city: destination.city || '',
    state: destination.state || '',
    country: destination.country || '',
    postalCode: destination.postalCode || '',
    reference: destination.reference || '',
  };

  const options = [];

  // Caso A: ENVIA NO opera en el país destino (ej. Venezuela) → un único tramo
  // internacional que llega DIRECTO a la dirección del comprador.
  if (carrierNames.length === 0) {
    for (const carrier of ["dhl", "fedex", "ups", "aramex"]) {
      try {
        const rates = await getInternationalShippingRates({
          accessToken: creds.accessToken,
          mode: creds.mode,
          origin,
          destination: destAddress,
          packages,
          currency,
          carrier,
          customsSettings,
        });
        const best = pickCheapest(rates);
        if (!best) continue;
        const landedCost = rateLandedCost(best);
        const shippingOnly = rateShippingOnly(best);
        options.push({
          carrier,
          direct: true,
          branch: null,
          leg1: {
            carrier: rateCarrier(best) || carrier,
            service: rateService(best),
            amount: shippingOnly,
            currency: rateCurrency(best),
            dutiesAndTaxes: landedCost,
            totalWithDuties: ratePrice(best),
          },
          leg2: null,
          dutiesAndTaxes: landedCost,
          shippingTotal: shippingOnly,
          total: ratePrice(best),
        });
      } catch {
        // Se ignora el carrier y se continúa con los demás.
      }
    }
  } else {
    // Caso B: ENVIA opera en destino → origen -> oficina -> cliente (última milla).
    for (const carrier of carrierNames) {
      let branches = [];
      try {
        branches = await getEnviaBranches({
          accessToken: creds.accessToken,
          mode: creds.mode,
          carrier,
          countryCode: destination.country,
          state: destination.state,
          locality: destination.city,
          zipcode: destination.postalCode,
          type: 2,
          packages,
          limitBranches: maxBranchesPerCarrier,
        });
      } catch {
        continue;
      }

      for (const branch of branches.slice(0, maxBranchesPerCarrier)) {
        const branchAddress = buildBranchAddress(branch, destination);
        try {
          const [leg1Rates, leg2Rates] = await Promise.all([
            getInternationalShippingRates({
              accessToken: creds.accessToken,
              mode: creds.mode,
              origin,
              destination: branchAddress,
              packages,
              currency,
              carrier,
              customsSettings,
            }),
            getInternationalShippingRates({
              accessToken: creds.accessToken,
              mode: creds.mode,
              origin: branchAddress,
              destination,
              packages,
              currency,
              carrier,
            }),
          ]);
          const leg1 = pickCheapest(leg1Rates);
          const leg2 = pickCheapest(leg2Rates);
          if (!leg1 || !leg2) continue;
          const leg1Total = ratePrice(leg1);
          const landedCost = rateLandedCost(leg1);
          const leg1Shipping = rateShippingOnly(leg1);
          const leg2Total = ratePrice(leg2);
          options.push({
            carrier,
            direct: false,
            branch: {
              code: branch?.branch_code || branch?.branch_id || null,
              reference: branch?.reference || null,
              distance: branch?.distance ?? null,
              address: branchAddress,
            },
            leg1: {
              carrier: rateCarrier(leg1) || carrier,
              service: rateService(leg1),
              amount: leg1Shipping,
              currency: rateCurrency(leg1),
              dutiesAndTaxes: landedCost,
              totalWithDuties: Number.isFinite(leg1Total) ? leg1Total : leg1Shipping,
            },
            leg2: {
              carrier: rateCarrier(leg2) || carrier,
              service: rateService(leg2),
              amount: leg2Total,
              currency: rateCurrency(leg2),
            },
            dutiesAndTaxes: landedCost,
            shippingTotal: leg1Shipping + leg2Total,
            total: Number.isFinite(leg1Total) ? leg1Total + leg2Total : leg1Shipping + leg2Total,
          });
        } catch {
          // Se ignora esta combinación y se continúa con las demás.
        }
      }
    }
  }

  options.sort((a, b) => a.total - b.total);
  const top = options.slice(0, 5).map((o, idx) => ({
    id: `${o.carrier}_${o.branch?.code || idx}`,
    ...o,
    total: Math.round(o.total * 100) / 100,
  }));

  return { origin, destination, currency, options: top };
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

export default { getInternationalShippingOptions, dispatchInternationalOrder };
