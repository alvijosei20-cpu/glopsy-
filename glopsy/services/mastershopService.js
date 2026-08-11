import axios  from 'axios';
import { createClient } from 'redis';

// 1. Configurar e inicializar el cliente de Redis
const redisClient = createClient({
    // url: 'redis://localhost:6379' // Cambia esto si usas credenciales o un puerto diferente
});

redisClient.on('error', (err) => console.error('Error en el cliente de Redis:', err));

// Conectar a Redis (en las versiones más recientes de redis para Node, esto es asíncrono)
(async () => {
    await redisClient.connect();
    console.log('Conectado a Redis con éxito');
})();

const MASTERSHOP_API_KEY = 'g-4G2yMS57mBqym0Dsp6MF3ncSGrDpMld4o9UVcRDMO786whDz'; 
const TIEMPO_EXPIRACION = 3600; // Tiempo en segundos que durará en caché (ej. 1 hora)

/**
 * Obtiene un producto buscando primero en Redis y, si no existe, en Mastershop.
 * @param {string|number} id - El ID del producto
 */
const obtenerProductoPorId = async (id) => {
    const cacheKey = `producto:${id}`;

    try {
        // 2. Intentar obtener el producto desde Redis
        const productoCacheado = await redisClient.get(cacheKey);

        if (productoCacheado) {
            console.log(`[Cache Hit] Producto ${id} obtenido desde Redis`);
            return JSON.parse(productoCacheado); // Devolvemos el objeto convertido desde String
        }

        // 3. Cache Miss: Si no estaba en Redis, consultamos a la API de Mastershop
        console.log(`[Cache Miss] Consultando producto ${id} en la API de Mastershop...`);
        const url = `https://prod.api.mastershop.com/api/products/${id}`;
        
        const response = await axios.get(url, {
            headers: {
                'ms-api-key': MASTERSHOP_API_KEY
            }
        });

        const productoData = response.data;

        // 4. Guardar el resultado en Redis para futuras consultas
        // Usamos 'EX' para asignarle un tiempo de expiración y que la caché no sea eterna
        await redisClient.set(cacheKey, JSON.stringify(productoData), {
            EX: TIEMPO_EXPIRACION 
        });

        return productoData;

    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.warn(`[Mastershop] Producto ${id} no encontrado (404).`);
            return null;
        }
        console.error('Error en el servicio de productos:', error.message);
        throw error;
    }
};

export  { obtenerProductoPorId };
