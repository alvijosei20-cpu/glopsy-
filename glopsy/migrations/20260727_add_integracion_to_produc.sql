-- Agregar integracion_id a la tabla produc para enlazar con la integración de la tienda (ej. mastershop)
ALTER TABLE produc ADD COLUMN IF NOT EXISTS integracion_id INTEGER REFERENCES tienda_integraciones(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_produc_integracion_id ON produc(integracion_id);
