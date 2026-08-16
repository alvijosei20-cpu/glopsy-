import { query } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, 'migrations', '20260811_add_order_number_to_orders.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Aplicando migración...');
        await query(sql);
        console.log('Migración aplicada con éxito.');

        // Backfill existing orders that don't have order_number
        const { rows: orders } = await query('SELECT id FROM orders WHERE order_number IS NULL');
        console.log(`Actualizando ${orders.length} pedidos existentes con número de orden...`);
        for (const ord of orders) {
            const orderNum = String(100000 + ord.id);
            await query('UPDATE orders SET order_number = $1 WHERE id = $2', [orderNum, ord.id]);
        }
        console.log('Backfill completado.');
    } catch (err) {
        console.error('Error aplicando migración:', err);
    } finally {
        process.exit(0);
    }
}

runMigration();
