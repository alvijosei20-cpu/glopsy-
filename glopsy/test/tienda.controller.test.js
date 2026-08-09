import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createTiendaController } from '../controllers/tienda.controller.js';
import { pool } from '../db.js';
import { redisClient } from '../services/redis.service.js';

const response = () => {
  const result = { statusCode: 200, body: null };
  result.status = (code) => { result.statusCode = code; return result; };
  result.json = (body) => { result.body = body; return result; };
  return result;
};

test('devuelve la tienda del usuario autenticado', async () => {
  const controller = createTiendaController({ getTienda: async (id) => ({ id, name: 'Luna', isActive: true }) });
  const res = response();
  await controller.getMine({ auth: { userId: 7 } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.tienda.name, 'Luna');
});

test('rechaza estados que no sean booleanos', async () => {
  const controller = createTiendaController();
  const res = response();
  await controller.changeStatus({ auth: { userId: 7 }, body: { isActive: 'true' } }, res);
  assert.equal(res.statusCode, 400);
});

test('actualiza el estado solamente para el usuario autenticado', async () => {
  let received;
  const controller = createTiendaController({ updateStatus: async (...args) => { received = args; return { id: 'a', isActive: false }; } });
  const res = response();
  await controller.changeStatus({ auth: { userId: 7 }, body: { isActive: false } }, res);
  assert.deepEqual(received, [7, false]);
  assert.equal(res.body.tienda.isActive, false);
});

after(async () => {
  await pool.end();
  if (redisClient.isOpen) await redisClient.quit();
});
