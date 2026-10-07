import axios from 'axios';
import { redisClient } from './redis.service.js';

const DROPANAS_API_KEY = process.env.DROPANAS_API_KEY || '';
const DROPANAS_BASE = (process.env.DROPANAS_API_URL || 'https://app.dropanas.com/api/v1').replace(/\/$/, '');
const TIEMPO_EXPIRACION = 3600;

export const obtenerProductoDropanasPorId = async (id) => {
    const cacheKey = `producto:dropanas:${id}`;
    try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            console.log(`[Cache Hit] Producto DropPanas ${id} obtenido desde Redis`);
            return JSON.parse(cached);
        }

        if (!DROPANAS_API_KEY) {
            console.warn('[DropPanas] DROPANAS_API_KEY no configurada; lookup deshabilitado.');
            return null;
        }

        console.log(`[Cache Miss] Consultando producto DropPanas ${id} en la API de DroPanas...`);
        const url = `${DROPANAS_BASE}/productos/${id}`;
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${DROPANAS_API_KEY}`,
                'X-DroPanas-Mode': DROPANAS_API_KEY.startsWith('test_sk_') ? 'sandbox' : 'live'
            }
        });

        const productoData = response.data;

        await redisClient.set(cacheKey, JSON.stringify(productoData), {
            EX: TIEMPO_EXPIRACION 
        });

        return productoData;

    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.warn(`[DropPanas] Producto ${id} no encontrado (404).`);
            return null;
        }
        console.error('Error en el servicio de productos DropPanas:', error.message);
        throw error;
    }
};

export { obtenerProductoDropanasPorId };
