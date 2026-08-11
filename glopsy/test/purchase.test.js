import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { recordPurchaseForUser, getUserPurchasesDetails } from '../services/product.service.js';
import { pool } from '../db.js';
import { redisClient } from '../services/redis.service.js';

test('recordPurchaseForUser guarda exitosamente la orden, shipments y items en las tres tablas', async () => {
  const userId = 1;
  const items = [
    { id: 1, name: 'Producto Test 1', quantity: 1, price: 20000, tienda_id: 1 }
  ];
  const options = {
    preferenceId: 'pref_ship_test',
    paymentResponse: { id: 112233445, status: 'approved' },
    customerInfo: { departamento_id: 5, ciudad_id: 1, direccion: 'Calle 10', telefono: '3001234567' },
    shippingCost: 10000,
    shippingPayload: {
      grouped: [
        {
          key: 'grp_1',
          idbusiness: '123',
          originCiudadId: 59,
          destinationCiudadId: 1,
          shippingCost: 10000,
          selected_carrier: { carrier: 'InterRapidisimo', service: 'Mensajeria' },
          items
        }
      ]
    }
  };

  try {
    await recordPurchaseForUser(userId, items, options);
    const { rows: orderRows } = await pool.query(`SELECT id FROM orders WHERE preference_id = $1 LIMIT 1`, ['pref_ship_test']);
    assert.equal(orderRows.length, 1);
    const orderId = orderRows[0].id;

    const { rows: shipRows } = await pool.query(`SELECT * FROM order_shipments WHERE order_id = $1`, [orderId]);
    assert.equal(shipRows.length, 1);
    assert.equal(shipRows[0].carrier, 'InterRapidisimo');
    const shipmentId = shipRows[0].id;

    const { rows: itemRows } = await pool.query(`SELECT * FROM order_items WHERE order_id = $1`, [orderId]);
    assert.equal(itemRows.length, 1);
    assert.equal(itemRows[0].shipment_id, shipmentId);
  } catch (err) {
    console.error('Error in purchase/shipment test:', err.message);
    throw err;
  }
});

after(async () => {
  await pool.end();
  if (redisClient.isOpen) await redisClient.quit();
});
