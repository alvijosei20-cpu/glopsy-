-- Agregar columna order_number a la tabla orders si no existe
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(20) UNIQUE;

-- Crear índices para búsquedas rápidas por order_number e identification_number
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_identification_number ON orders(identification_number);
