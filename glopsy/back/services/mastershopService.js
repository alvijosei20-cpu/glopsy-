import axios from 'axios';
import { redisClient } from './redis.service.js';

// Credenciales de la cuenta agregadora de la plataforma (solo para la tienda principal).
// No debe estar hardcodeada: se lee del entorno. Sin configurar, el lookup devuelve null.
const MASTERSHOP_API_KEY = process.env.MASTERSHOP_API_KEY || '';
const MASTERSHOP_BASE = (process.env.MASTERSHOP_API_URL || 'https://prod.api.mastershop.com/api').replace(/\/$/, '');
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

        if (!MASTERSHOP_API_KEY) {
            console.warn('[Mastershop] MASTERSHOP_API_KEY no configurada; lookup deshabilitado.');
            return null;
        }

        // 3. Cache Miss: Si no estaba en Redis, consultamos a la API de Mastershop
        console.log(`[Cache Miss] Consultando producto ${id} en la API de Mastershop...`);
        const url = `${MASTERSHOP_BASE}/products/${id}`;
        
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
