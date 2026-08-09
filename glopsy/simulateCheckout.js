import { query } from './db.js';
import { getShippingOptionsFromEnvia } from './services/envia.service.js';

async function simulateCheckout() {
    try {
        // Paso 1: Obtener productos
        const productos = await query('SELECT * FROM produc;');

        // Simulación de ciudad y negocio
        const ciudadDANE = '11001'; // Código DANE de Bogotá
        const agrupados = {};

        // Agrupar productos por idbusiness y ciudad
        for (const producto of productos.rows) {
            const idbusiness = producto.product_owner.idbusiness;
            const key = `${idbusiness}-${ciudadDANE}`;

            if (!agrupados[key]) {
                agrupados[key] = [];
            }
            agrupados[key].push(producto);
        }

        const resultados = {};
        for (const key in agrupados) {
            const items = agrupados[key];
            const pesoTotal = items.reduce((acc, item) => acc + (item.peso || 3), 0); // Asumir peso
            const { shippingOptions, shippingCost } = await getShippingOptionsFromEnvia(items, ciudadDANE);
            resultados[key] = { costoEnvio: shippingCost, shippingOptions, items };
        }

        console.log('Resultados de costos de envío:', resultados);
    } catch (error) {
        console.error('Error durante la simulación de checkout:', error);
    }
}

simulateCheckout();
