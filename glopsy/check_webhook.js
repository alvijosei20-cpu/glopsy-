import { query } from './db.js';

async function checkWebhooks() {
    try {
        const colsWebhook = await query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'webhook';`);
        console.log('Columns in webhook:', colsWebhook.rows);

        const colsRel = await query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'webhook_tienda_integraciones';`);
        console.log('Columns in webhook_tienda_integraciones:', colsRel.rows);

        const dataWebhook = await query(`SELECT * FROM webhook;`);
        console.log('Data in webhook:', dataWebhook.rows);

        const dataRel = await query(`SELECT * FROM webhook_tienda_integraciones;`);
        console.log('Data in webhook_tienda_integraciones:', dataRel.rows);

        const dataIntegraciones = await query(`SELECT * FROM tienda_integraciones;`);
        console.log('Data in tienda_integraciones:', dataIntegraciones.rows);

        const dataCheckout = await query(`SELECT * FROM checkout_integrations;`);
        console.log('Data in checkout_integrations:', dataCheckout.rows);
    } catch (err) {
        console.error('Error:', err);
    }
    process.exit(0);
}

checkWebhooks();
