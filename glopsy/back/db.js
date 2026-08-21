import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { createPool } from './utils/db-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;

// Configuración de la conexión a PostgreSQL
// Usa DATABASE_URL si existe (patrón Render/Neon) o variables DB_* individuales.
const pool = createPool();

// Manejo de errores globales del pool de conexiones
pool.on('error', (err) => {
  console.error('Error inesperado en el cliente inactivo de PostgreSQL:', err);
});

// Verificación inicial de la conexión usando async/await
(async () => {
  try {
    const client = await pool.connect();
    console.log('Conexión a PostgreSQL establecida con éxito.');
    client.release();
  } catch (err) {
    console.error('Error al conectar a PostgreSQL:', err.stack);
  }
})();

/**
 * Función helper para ejecutar consultas parametrizadas de forma segura.
 * Ejemplo de uso en tus archivos:
 *   await query('SELECT * FROM users WHERE id = $1', [userId]);
 */
export const query = (text, params) => pool.query(text, params);

// Exportamos el pool original por si necesitas hacer transacciones
export { pool };
