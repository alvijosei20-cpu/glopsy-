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
} from './envia.service.js';
import {
  getMastershopIntegrationForStore,
  createMastershopDispatchOrder,
} from './mastershopOrder.service.js';

const ratePrice = (r) =>
  Number(
    r?.totalPrice ??
      r?.total_price ??
      r?.total ??
      r?.price ??
      r?.amount ??
      Infinity
  );

const pickCheapest = (rates) => {
  if (!Array.isArray(rates) || rates.length === 0) return null;
  return rates.reduce((best, r) => (ratePrice(r) < ratePrice(best) ? r : best));
};

const rateCarrier = (r) => r?.carrier || r?.carrierName || r?.provider || null;
const rateService = (r) => r?.service || r?.serviceName || r?.service_name || null;
const rateCurrency = (r) => r?.currency || r?.currencyId || 'USD';

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
    state: isCo ? getStateCode(row.departamento_nombre) : row.departamento_nombre,
    country,
    postalCode: row.codigo_postal || (isCo ? '11001000' : ''),
  };
};

// Paquetes a cotizar (peso/dimensiones del producto).
const buildPackages = async (items) => {
  const ids = items.map((i) => Number(i.id)).filter(Boolean);
  let map = new Map();
  if (ids.length > 0) {
    const { rows } = await pool.query(
      `SELECT id, peso, largo, alto, ancho FROM produc WHERE id = ANY($1::int[])`,
      [ids]
    );
    map = new Map(rows.map((r) => [Number(r.id), r]));
  }
  return items.map((it) => {
    const p = map.get(Number(it.id)) || {};
    return {
      type: 'box',
      content: String(it.name || 'Mercancía General').replace(/[^\w\s\+\-\.]/gi, '').trim() || 'Mercancia General',
      amount: Number(it.quantity) || 1,
      weight: Number(p.peso) || Number(process.env.ENVIA_DEFAULT_WEIGHT) || 1,
      weightUnit: 'KG',
      lengthUnit: 'CM',
      declaredValue: Number(it.price) || 0,
      dimensions: {
        length: Number(p.largo) || Number(process.env.ENVIA_DEFAULT_LENGTH) || 10,
        width: Number(p.ancho) || Number(process.env.ENVIA_DEFAULT_WIDTH) || 10,
        height: Number(p.alto) || Number(process.env.ENVIA_DEFAULT_HEIGHT) || 10,
      },
    };
  });
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
    state: a.state || dest.state,
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

  const creds = await getStoreEnviaCredentials(tiendaId);
  if (!creds?.accessToken) {
    throw new Error('La tienda no tiene ENVIA configurado para envíos internacionales.');
  }

  const origin = await resolveOriginAddress(items, tiendaId);
  const packages = await buildPackages(items);

  let carriers = [];
  try {
    carriers = await getEnviaCarriers({ accessToken: creds.accessToken, mode: creds.mode, countryCode: destination.country });
  } catch {
    carriers = [];
  }
  const carrierNames = carriers
    .map((c) => c?.name || c?.carrier || c?.slug)
    .filter(Boolean)
    .slice(0, maxCarriers);

  const options = [];
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
          // Tramo 1: origen del producto -> oficina (internacional).
          getInternationalShippingRates({
            accessToken: creds.accessToken,
            mode: creds.mode,
            origin,
            destination: branchAddress,
            packages,
            currency,
          }),
          // Tramo 2: oficina -> cliente (última milla con la transportadora de la oficina).
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
        options.push({
          carrier,
          branch: {
            code: branch?.branch_code || branch?.branch_id || null,
            reference: branch?.reference || null,
            distance: branch?.distance ?? null,
            address: branchAddress,
          },
          leg1: {
            carrier: rateCarrier(leg1) || carrier,
            service: rateService(leg1),
            amount: ratePrice(leg1),
            currency: rateCurrency(leg1),
          },
          leg2: {
            carrier: rateCarrier(leg2) || carrier,
            service: rateService(leg2),
            amount: ratePrice(leg2),
            currency: rateCurrency(leg2),
          },
          total: ratePrice(leg1) + ratePrice(leg2),
        });
      } catch {
        // Se ignora esta combinación y se continúa con las demás.
      }
    }
  }

  options.sort((a, b) => a.total - b.total);
  const top = options.slice(0, 5).map((o, idx) => ({
    id: `${o.carrier}_${o.branch.code || idx}`,
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
    if (!store || store.international_dispatch_provider !== 'mastershop') {
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
    const branchAddress = option?.branch?.address || null;
    if (!branchAddress) return { ok: false, reason: 'no_branch' };

    const result = { ok: true, mastershop: null, tracking: null, label: null };

    // 1) Pedido de despacho en MasterShop (paquete -> oficina de ENVIA).
    const ms = await getMastershopIntegrationForStore(order.tienda_id);
    if (ms?.apiKey) {
      try {
        result.mastershop = await createMastershopDispatchOrder({
          apiKey: ms.apiKey,
          orderId: order.order_number || order.id,
          shippingAddress: branchAddress,
          items,
          total: Number(order.amount) || 0,
          currency: store.moneda || 'COP',
          additionalCharges: [
            { type_charge: 'Envío internacional', value: Math.round(Number(option.total) || 0) },
          ],
        });
      } catch (e) {
        console.error('[dispatch] MasterShop:', orderId, e.message);
      }
    }

    // 2) Guía ENVIA de la última milla (oficina -> cliente).
    const creds = await getStoreEnviaCredentials(order.tienda_id);
    if (creds?.accessToken && option?.branch?.code) {
      try {
        const packages = await buildPackages(items);
        const label = await generateEnviaLabel({
          accessToken: creds.accessToken,
          mode: creds.mode,
          origin: { ...branchAddress, branchCode: option.branch.code },
          destination: buildDestinationAddress(destination, order),
          packages,
          carrier: option.leg2?.carrier || option.carrier,
          service: option.leg2?.service,
          currency: 'USD',
          orderReference: order.order_number || String(order.id),
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
          [orderId, result.tracking, option.leg2?.carrier || option.carrier, JSON.stringify({ international: true, option, enviaLabel: label })]
        );

        if (String(process.env.ENVIA_SCHEDULE_PICKUP).toLowerCase() === 'true' && result.tracking) {
          try {
            const pickup = await scheduleEnviaPickup({
              accessToken: creds.accessToken,
              mode: creds.mode,
              origin: { ...branchAddress, branchCode: option.branch.code },
              carrier: option.leg2?.carrier || option.carrier,
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
