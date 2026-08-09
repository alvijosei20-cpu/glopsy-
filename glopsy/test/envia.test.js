import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { getShippingOptionsFromEnvia } from '../services/envia.service.js';
import { pool } from '../db.js';
import { redisClient } from '../services/redis.service.js';

test('getShippingOptionsFromEnvia caches results and calls external API only once', async () => {
  // Save originals
  const origPoolQuery = pool.query;
  const origAxiosPost = axios.post;
  const origRedisGet = redisClient.get;
  const origRedisSet = redisClient.set;

  // Mock implementations
  let axiosCallCount = 0;
  axios.post = async (url, payload, opts) => {
    axiosCallCount++;
    return { data: { data: [ { carrier: 'servientrega', totalprice: 20000, service: 'Estándar', deliveryEstimate: '2 días' } ] } };
  };

  pool.query = async (text, params) => {
    if (/FROM ciudades c/.test(text)) {
      return { rows: [{ ciudad_nombre: 'Bogotá', codigo_postal: '110011', codigo_dane: '11001000', departamento_nombre: 'Bogotá D.C.' }] };
    }
    // Fallback responses for other queries
    return { rows: [] };
  };

  // In-memory cache stub
  const cache = new Map();
  redisClient.get = async (k) => cache.has(k) ? cache.get(k) : null;
  redisClient.set = async (k, v, opts) => { cache.set(k, v); return 'OK'; };

  // Ensure env token present
  process.env.ENVIA_API_TOKEN = 'TESTTOKEN12345678';

  const items = [{ id: 1, name: 'Test Item', quantity: 1, weight: 1 }];

  const first = await getShippingOptionsFromEnvia(items, 1, undefined);
  assert.ok(Array.isArray(first.shippingOptions));
  assert.equal(first.shippingOptions.length, 1);
  assert.equal(first.shippingCost, 20000);

  const second = await getShippingOptionsFromEnvia(items, 1, undefined);
  // axios should have been called only once due to caching
  assert.equal(axiosCallCount, 1);
  assert.equal(second.shippingCost, 20000);

  // Restore originals
  pool.query = origPoolQuery;
  axios.post = origAxiosPost;
  redisClient.get = origRedisGet;
  redisClient.set = origRedisSet;
});
