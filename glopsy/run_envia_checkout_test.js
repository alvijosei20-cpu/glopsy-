import dotenv from 'dotenv';
dotenv.config();
import { pool } from './db.js';
import { calculateShippingCost } from './services/product.service.js';
import { redisClient } from './services/redis.service.js';

async function run() {
  console.log('Running Envia checkout integration test (using DB checkout_integrations tokens)...');

  try {
    // Build a sample cart from some produc rows in DB
    const { rows: sample } = await pool.query(`SELECT id, name, tienda_id FROM produc WHERE id IS NOT NULL ORDER BY id LIMIT 6`);
    if (!sample || sample.length === 0) {
      console.log('No products found in produc table to test with. Aborting.');
      return;
    }

    // Create items array: use first 3 as example, assign quantities
    const items = sample.slice(0, 3).map((p, idx) => ({ id: p.id, name: p.name, quantity: idx === 0 ? 2 : 1, tienda_id: p.tienda_id }));

    // Ask for destination city: try to use a city id from DB (first ciudad)
    const { rows: cities } = await pool.query('SELECT id FROM ciudades ORDER BY id LIMIT 1');
    const destinationCiudadId = (cities[0] && cities[0].id) || process.env.DEFAULT_DEST_CIUDAD || null;

    console.log('Items:', items, 'destinationCiudadId:', destinationCiudadId);

    const result = await calculateShippingCost(items, destinationCiudadId);
    console.log('CalculateShippingCost result:');
    console.dir(result, { depth: 5 });

  } catch (err) {
    console.error('Error running Envia checkout test:', err.message, err.response?.data || '');
  } finally {
    try { await pool.end(); } catch {}
    try { if (redisClient.isOpen) await redisClient.quit(); } catch {}
  }
}

run();
