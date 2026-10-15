// ==========================================
// Despacho local (Colombia) vía ENVIA.
//
// Para pedidos de productos NO integrados con MasterShop (nacionales), al
// confirmarse el pago se genera la guía ENVIA usando la transportadora/servicio
// que el comprador eligió en el checkout (guardados en order_shipments) y se
// deja el tracking en el envío. El origen sale del fullment del producto.
// ==========================================

import { pool } from '../db.js';
import {
  getStoreEnviaCredentials,
  generateEnviaLabel,
  scheduleEnviaPickup,
  getStateCode,
  ensure8DigitDane,
  getEnviaBalance,
} from './envia.service.js';
import { resolvePackagingForProduct } from './tariff.service.js';

const PAID_ORDER_STATUSES = new Set(['Completado', 'approved', 'paid', 'authorized']);
const isPaidOrderStatus = (status) => PAID_ORDER_STATUSES.has(String(status || ''));

const cityInfo = async (ciudadId) => {
  if (!ciudadId) return null;
  const { rows } = await pool.query(
    `SELECT c.nombre, c.codigo_postal, c.codigo_dane, d.nombre AS departamento
     FROM ciudades c
     LEFT JOIN departamentos d ON c.departamento_id = d.id
     WHERE c.id = $1 LIMIT 1`,
    [Number(ciudadId)]
  );
  return rows[0] || null;
};

const buildOrigin = (info) => ({
  name: process.env.ENVIA_ORIGIN_NAME || 'Glopsy Store',
  company: process.env.ENVIA_ORIGIN_COMPANY || 'Glopsy',
  phone: process.env.ENVIA_ORIGIN_PHONE || '3000000000',
  street: process.env.ENVIA_ORIGIN_STREET || 'Bodega principal',
  number: process.env.ENVIA_ORIGIN_NUMBER || '1',
  city: ensure8DigitDane(info?.codigo_dane),
  state: getStateCode(info?.departamento),
  country: 'CO',
  postalCode: info?.codigo_postal || '110011',
});

const buildDestination = (info, order) => ({
  name: order.customer_name || 'Cliente',
  phone: String(order.telefono || '').replace(/[^\d+]/g, '') || undefined,
  street: order.direccion || '',
  number: '',
  city: ensure8DigitDane(info?.codigo_dane),
  state: getStateCode(info?.departamento),
  country: 'CO',
  postalCode: info?.codigo_postal || '110011',
});

// Consolida los ítems del envío en un único paquete (peso total + dimensiones máximas).
const buildPackage = async (items) => {
  const ids = items.map((i) => Number(i.product_id)).filter(Boolean);
  let map = new Map();
  if (ids.length) {
    const { rows } = await pool.query(
      `SELECT id, peso, largo, alto, ancho, categoria_id FROM produc WHERE id = ANY($1::int[])`,
      [ids]
    );
    map = new Map(rows.map((r) => [Number(r.id), r]));
  }
  let weight = 0;
  let length = 0;
  let width = 0;
  let height = 0;
  let qty = 0;
  let content = 'Mercancia General';
  for (const it of items) {
    const p = map.get(Number(it.product_id)) || {};
    const q = Number(it.quantity) || 1;
    const pack = await resolvePackagingForProduct({
      categoriaId: p.categoria_id,
      peso: p.peso,
      largo: p.largo,
      alto: p.alto,
      ancho: p.ancho,
    });
    weight += pack.weight * q;
    length = Math.max(length, pack.length);
    width = Math.max(width, pack.width);
    height = Math.max(height, pack.height);
    qty += q;
    if (content === 'Mercancia General' && it.product_name) {
      content = String(it.product_name).replace(/[^\w\s\+\-\.]/gi, '').trim() || content;
    }
  }
  return [{
    type: 'box',
    content,
    amount: qty || 1,
    weight: Math.max(1, Math.round(weight * 100) / 100),
    weightUnit: 'KG',
    lengthUnit: 'CM',
    dimensions: { length: Math.max(1, length), width: Math.max(1, width), height: Math.max(1, height) },
  }];
};

// Genera las guías ENVIA de un pedido local ya pagado. Idempotente por envío.
export const dispatchDomesticOrder = async (orderId) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM orders WHERE id = $1 LIMIT 1`, [orderId]);
    const order = rows[0];
    if (!order) return { ok: false, reason: 'order_not_found' };
    if (!isPaidOrderStatus(order.status)) return { ok: false, reason: 'not_paid', status: order.status };

    const sp = order.shipping_payload || {};
    if (sp?.international) return { ok: false, reason: 'international' };

    const creds = await getStoreEnviaCredentials(order.tienda_id);
    if (!creds?.accessToken) return { ok: false, reason: 'no_envia' };

    const { rows: shipments } = await pool.query(
      `SELECT * FROM order_shipments WHERE order_id = $1 ORDER BY shipment_number`,
      [orderId]
    );
    if (!shipments.length) return { ok: false, reason: 'no_shipments' };

    const destInfo = await cityInfo(order.ciudad_id);
    const destination = buildDestination(destInfo, order);

    // Envíos que necesitan guía (sin tracking y con códigos ENVIA válidos).
    const needsGuide = shipments.filter((sh) => {
      if (sh.tracking_code) return false;
      const sc = (sh.payload && typeof sh.payload === 'object' ? sh.payload.selected_carrier : null) || {};
      return Boolean(sc.carrier_code || sh.carrier) && Boolean(sc.service_code || sh.service);
    });

    // Control de saldo ENVIA: si no alcanza, deja los envíos en espera y avisa
    // al vendedor. Un worker reintenta cuando haya saldo.
    if (needsGuide.length > 0) {
      const required = Math.round(needsGuide.reduce((s, sh) => s + (Number(sh.shipping_cost) || 0), 0) * 100) / 100;
      const balanceInfo = await getEnviaBalance({ accessToken: creds.accessToken, mode: creds.mode }).catch(() => null);
      if (balanceInfo && balanceInfo.balance != null && balanceInfo.balance < required) {
        const newly = [];
        for (const sh of needsGuide) {
          if (sh.fulfillment_status !== 'pending_balance') newly.push(sh.id);
          await pool.query(
            `UPDATE order_shipments
             SET fulfillment_status = 'pending_balance',
                 payload = COALESCE(payload, '{}'::jsonb) || $2::jsonb,
                 updated_at = NOW()
             WHERE id = $1`,
            [sh.id, JSON.stringify({ envia_pending_balance: true, required, balance: balanceInfo.balance })]
          );
        }
        if (newly.length > 0) {
          try {
            const { createNotification } = await import('./product.service.js');
            const { rows: pc } = await pool.query(
              `SELECT count(*)::int AS c
               FROM order_shipments s JOIN orders o ON o.id = s.order_id
               WHERE o.tienda_id = $1 AND s.fulfillment_status = 'pending_balance'`,
              [order.tienda_id]
            );
            const pending = pc[0]?.c || needsGuide.length;
            await createNotification(
              order.tienda_id, null, null,
              'ENVIA sin saldo',
              `Saldo ENVIA insuficiente ($${balanceInfo.balance}). Tienes ${pending} envío(s) pendiente(s) por fondear; se generarán solos al recargar.`,
              'envia_no_balance',
              { required, balance: balanceInfo.balance, pending },
              '/market/config'
            );
          } catch (e) {
            console.error('[dispatch] No se pudo notificar saldo ENVIA:', e.message);
          }
        }
        return { ok: false, reason: 'sin_saldo', required, balance: balanceInfo.balance };
      }
    }

    const result = { ok: true, shipments: [], tracking: null, label: null };

    for (const sh of shipments) {
      if (sh.tracking_code) { result.shipments.push({ id: sh.id, skipped: 'ya_generada' }); continue; }

      // ENVIA exige los códigos reales de transportadora y servicio (no las
      // descripciones). Vienen guardados en payload.selected_carrier.
      const sc = (sh.payload && typeof sh.payload === 'object' ? sh.payload.selected_carrier : null) || {};
      const carrierCode = sc.carrier_code || sh.carrier;
      const serviceCode = sc.service_code || sh.service;
      if (!carrierCode || !serviceCode) { result.shipments.push({ id: sh.id, skipped: 'sin_codigos_envia' }); continue; }

      const originInfo = await cityInfo(sh.origin_ciudad_id || order.ciudad_id);
      const origin = buildOrigin(originInfo);

      const { rows: items } = await pool.query(
        `SELECT product_id, product_name, quantity FROM order_items WHERE shipment_id = $1`,
        [sh.id]
      );
      if (!items.length) { result.shipments.push({ id: sh.id, skipped: 'sin_items' }); continue; }

      const packages = await buildPackage(items);
      const label = await generateEnviaLabel({
        accessToken: creds.accessToken,
        mode: creds.mode,
        origin,
        destination,
        packages,
        carrier: carrierCode,
        service: serviceCode,
        currency: 'COP',
        orderReference: order.order_number || String(order.id),
      });

      const tracking = label?.trackingNumber || label?.tracking || null;
      const labelUrl = label?.label || label?.labelUrl || null;

      await pool.query(
        `UPDATE order_shipments
         SET tracking_code = COALESCE($2, tracking_code),
             carrier = COALESCE($3, carrier),
             shipping_url = COALESCE($4, shipping_url),
             fulfillment_status = CASE WHEN $2 IS NOT NULL THEN 'guia_generada' ELSE fulfillment_status END,
             payload = COALESCE(payload, '{}'::jsonb) || $5::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [sh.id, tracking, sh.carrier, labelUrl, JSON.stringify({ envia: true, envia_service: serviceCode, envia_carrier: carrierCode, label })]
      );

      result.shipments.push({ id: sh.id, tracking, label: labelUrl });
      result.tracking = tracking || result.tracking;
      result.label = labelUrl || result.label;
      if (String(process.env.ENVIA_SCHEDULE_PICKUP).toLowerCase() === 'true' && tracking) {
        try {
          await scheduleEnviaPickup({
            accessToken: creds.accessToken,
            mode: creds.mode,
            origin,
            carrier: carrierCode,
            trackingNumbers: [tracking],
            totalPackages: 1,
            totalWeight: packages[0]?.weight || 1,
          });
        } catch (e) {
          console.error('[dispatch] Pickup ENVIA (local):', orderId, e.message);
        }
      }
    }

    // Notifica al comprador cuando se generó al menos una guía (flujo de compra).
    const dispatched = result.shipments.filter((s) => s.tracking);
    if (dispatched.length > 0) {
      try {
        const { createNotification } = await import('./product.service.js');
        await createNotification(
          order.user_id,
          order.guest_hash,
          order.id,
          `Pedido #${order.order_number || order.id} despachado`,
          `Tu pedido fue enviado${result.tracking ? ` · Guía ${result.tracking}` : ''}.`,
          'order_shipped',
          { tracking: result.tracking, shipments: dispatched },
          order.order_hash ? `/compras/${order.order_hash}` : '/consultar-pedido'
        );
      } catch (e) {
        console.error('[dispatch] No se pudo notificar el despacho local:', e.message);
      }
    }

    return result;
  } catch (error) {
    console.error('[dispatch] Error despachando orden local ENVIA:', orderId, error.response?.data || error.message);
    return { ok: false, reason: 'error', message: error.message };
  }
};

export default { dispatchDomesticOrder };
