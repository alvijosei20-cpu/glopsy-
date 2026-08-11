import { query } from './db.js';

async function checkDDL() {
    try {
        const res2 = await query(`
            SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('webhook', 'webhook_tienda_integraciones');
        `);
        console.log('Foreign keys:', res2.rows);

        const wRows = await query(`SELECT * FROM webhook;`);
        console.log('webhook rows:', wRows.rows);

        const wtiRows = await query(`SELECT * FROM webhook_tienda_integraciones;`);
        console.log('webhook_tienda_integraciones rows:', wtiRows.rows);

        const tiRows = await query(`SELECT * FROM tienda_integraciones;`);
        console.log('tienda_integraciones rows:', tiRows.rows);

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

checkDDL();
