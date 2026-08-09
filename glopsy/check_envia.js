import { getShippingOptionsFromEnvia } from './services/envia.service.js';
import axios from 'axios';
import { pool } from './db.js';
import { redisClient } from './services/redis.service.js';

async function runCheck() {
  console.log('Starting Envia checkout smoke test...');

  // Save originals
  const origPoolQuery = pool.query;
  const origAxiosPost = axios.post;
  const origRedisGet = redisClient.get;
  const origRedisSet = redisClient.set;

  // Mock pool.query for city lookups
  pool.query = async (text, params) => {
    if (/FROM ciudades c/.test(text)) {
      return { rows: [{ ciudad_nombre: 'Bogotá', codigo_postal: '110011', codigo_dane: '11001000', departamento_nombre: 'Bogotá D.C.' }] };
    }
    // fallback empty
    return { rows: [] };
  };

  let axiosCallCount = 0;
  axios.post = async (url, payload, opts) => {
    axiosCallCount++;
    // Return structure similar to Envia per-carrier single-rate
    return { data: { data: [ { carrier: 'servientrega', totalprice: 25000, service: 'Estándar', deliveryEstimate: '3 días' } ] } };
  };

  // In-memory cache stub
  const cache = new Map();
  redisClient.get = async (k) => cache.has(k) ? cache.get(k) : null;
  redisClient.set = async (k, v, opts) => { cache.set(k, v); return 'OK'; };

  process.env.ENVIA_API_TOKEN = process.env.ENVIA_API_TOKEN || 'TESTTOKEN12345678';

  try {
    const items = [{ id: 1, name: 'Producto Test', quantity: 1, weight: 1 }];
    const destinationCiudadId = 1;

    console.log('First call (should hit external mocked API)...');
    const first = await getShippingOptionsFromEnvia(items, destinationCiudadId, undefined);
    console.log('First result:', first);

    console.log('Second call (should come from cache, no new external calls)...');
    const second = await getShippingOptionsFromEnvia(items, destinationCiudadId, undefined);
    console.log('Second result:', second);

    console.log('axios.post call count:', axiosCallCount, '(expected 3 for 3 carriers on first call)');
  } catch (err) {
    console.error('Error during smoke test:', err.message, err.response?.data);
  } finally {
    // Restore originals
    pool.query = origPoolQuery;
    axios.post = origAxiosPost;
    redisClient.get = origRedisGet;
    redisClient.set = origRedisSet;
    // Close DB pool (optional)
    try { await pool.end(); } catch {}
    try { if (redisClient.isOpen) await redisClient.quit(); } catch {}
  }
}

runCheck();
