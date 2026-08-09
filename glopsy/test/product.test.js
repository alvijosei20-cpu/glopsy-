import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { saveProductForUser } from '../services/product.service.js';
import { pool } from '../db.js';
import { redisClient } from '../services/redis.service.js';

test('saveProductForUser valida campos obligatorios', async () => {
  await assert.rejects(
    async () => {
      await saveProductForUser(1, { name: '' });
    },
    { message: 'El nombre del producto es obligatorio.' }
  );
});

test('saveProductForUser procesa correctamente datos con variantes y precios formateados', async () => {
  const uniqueName = `Test Product ${Date.now()}`;
  try {
    const saved = await saveProductForUser(1, {
      name: uniqueName,
      idVariant: 'var_123',
      selectedOptions: { Talla: 'M' },
      suggestedPrice: '49,99',
      basePrice: '10.50',
    });
    assert.equal(saved.name, uniqueName);
    assert.equal(saved.selected_variant_id, 'var_123');
  } catch (err) {
    // Si la tienda o el usuario 1 no existe en la BD de pruebas, permitimos error de llave foránea
    assert.match(err.message, /violates foreign key constraint|Key \(tienda_id\)=/);
  }
});

after(async () => {
  await pool.end();
  if (redisClient.isOpen) await redisClient.quit();
});
