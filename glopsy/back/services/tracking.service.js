// ==========================================
// Rastreo unificado de envíos.
//  - Envíos ENVIA (Colombia/local): POST /ship/generaltrack/.
//  - Envíos MasterShop (internacional): orderHistory + orderShipmentUpdateHistory
//    + orderLogistics.carrierTracking (GET /orders?idOrder=).
// ==========================================

import { getStoreEnviaCredentials, getEnviaTracking } from './envia.service.js';
import {
  getMastershopIntegrationForStore,
  getMastershopOrder,
  resolveMastershopOrderRef,
} from './mastershopOrder.service.js';

const baseShipment = (s) => ({
  shipment_number: s.shipment_number,
  carrier: s.carrier,
  service: s.service,
  tracking_code: s.tracking_code,
  shipping_url: s.shipping_url,
  fulfillment_status: s.fulfillment_status,
});

const mapEnvia = (shipments, tracked) => {
  const byNumber = new Map((tracked || []).map((t) => [String(t.trackingNumber || t.tracking_number), t]));
  return shipments.map((s) => {
    const t = s.tracking_code ? byNumber.get(String(s.tracking_code)) : null;
    return {
      ...baseShipment(s),
      provider: 'envia',
      tracking: t
        ? {
            status: t.status || null,
            status_color: t.statusColor || null,
            service: t.serviceDescription || t.service || null,
            estimated_delivery: t.estimatedDelivery || null,
            shipped_at: t.shippedAt || null,
            delivered_at: t.deliveredAt || null,
            track_url: t.trackUrl || null,
            track_url_site: t.trackUrlSite || null,
            destination: t.destination || null,
            events: Array.isArray(t.eventHistory) ? t.eventHistory : [],
          }
        : null,
    };
  });
};

const mapMastershop = (shipments, msOrder) => {
  const lg = msOrder?.orderLogistics || {};
  const ct = lg.carrierTracking || {};
  const guide = ct.tracking || ct.tracking_code || ct.guide || ct.guideNumber || ct.waybill || null;
  const trackUrl = ct.url || ct.url_tracking || ct.tracking_url || ct.trackUrl || null;
  const events = [
    ...(Array.isArray(msOrder?.orderHistory) ? msOrder.orderHistory : []).map((h) => ({
      status: h.history || h.status || null,
      date: h.createdAt || h.date || null,
    })),
    ...(Array.isArray(msOrder?.orderShipmentUpdateHistory) ? msOrder.orderShipmentUpdateHistory : []).map((h) => ({
      status: h.history || h.status || h.status_name || null,
      date: h.createdAt || h.date || null,
    })),
  ].filter((e) => e.status);

  const dest = msOrder?.shippingAddress || null;
  const tracking = {
    status: msOrder?.statusName || null,
    status_color: '#7e22ce',
    service: lg.carrier || ct.carrier || null,
    estimated_delivery: null,
    shipped_at: null,
    delivered_at: null,
    track_url: trackUrl,
    track_url_site: trackUrl,
    destination: dest
      ? { name: dest.full_name || null, city: dest.city || null, state: dest.state || null, country: dest.country || null }
      : null,
    events,
  };

  return shipments.map((s) => ({
    ...baseShipment(s),
    carrier: s.carrier || lg.carrier || null,
    tracking_code: s.tracking_code || guide || null,
    provider: 'mastershop',
    tracking,
  }));
};

// Devuelve los envíos con su rastreo según el proveedor del pedido.
export const getOrderShipmentsTracking = async ({ tiendaId, order, shipments }) => {
  const list = shipments || [];

  const isMastershop = Boolean(order?.payload?.mastershop) || Boolean(order?.internationalDispatchProvider === 'mastershop');
  if (isMastershop) {
    const ms = await getMastershopIntegrationForStore(tiendaId);
    if (ms?.apiKey) {
      const msOrder = await getMastershopOrder(ms.apiKey, resolveMastershopOrderRef(order)).catch(() => null);
      if (msOrder) return { provider: 'mastershop', shipments: mapMastershop(list, msOrder) };
    }
  }

  // ENVIA
  const codes = list.map((s) => s.tracking_code).filter(Boolean);
  if (codes.length === 0) {
    return { provider: 'envia', shipments: list.map((s) => ({ ...baseShipment(s), provider: 'envia', tracking: null })) };
  }
  const creds = await getStoreEnviaCredentials(tiendaId);
  if (!creds?.accessToken) {
    return { provider: 'envia', reason: 'no_envia', shipments: list.map((s) => ({ ...baseShipment(s), provider: 'envia', tracking: null })) };
  }
  const tracked = await getEnviaTracking({ accessToken: creds.accessToken, mode: creds.mode, trackingNumbers: codes }).catch(() => []);
  return { provider: 'envia', shipments: mapEnvia(list, tracked) };
};

export default { getOrderShipmentsTracking };
