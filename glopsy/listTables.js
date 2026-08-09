import { query } from './db.js';

async function listTables() {
    try {
        const result = await query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`);
        console.log(result.rows);
    } catch (error) {
        console.error('Error fetching tables:', error);
    }
}

listTables();
