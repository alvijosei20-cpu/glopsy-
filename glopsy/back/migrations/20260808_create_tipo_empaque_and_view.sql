-- 1. Crear tabla tipo_empaque si no existe
CREATE TABLE IF NOT EXISTS tipo_empaque (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  peso NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
  largo NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
  alto NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
  ancho NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Asegurar que la tabla produc tenga columnas para medidas individuales y relación con tipo_empaque
ALTER TABLE produc ADD COLUMN IF NOT EXISTS peso NUMERIC(10, 2);
ALTER TABLE produc ADD COLUMN IF NOT EXISTS largo NUMERIC(10, 2);
ALTER TABLE produc ADD COLUMN IF NOT EXISTS alto NUMERIC(10, 2);
ALTER TABLE produc ADD COLUMN IF NOT EXISTS ancho NUMERIC(10, 2);
ALTER TABLE produc ADD COLUMN IF NOT EXISTS tipo_empaque_id INTEGER REFERENCES tipo_empaque(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_produc_tipo_empaque_id ON produc(tipo_empaque_id);

-- 3. Crear Vista de Conveniencia para obtener las medidas finales de cada producto (calcula reales vs fallback del empaque y defaults)
CREATE OR REPLACE VIEW vista_medidas_productos AS
SELECT 
  p.id AS producto_id,
  p.external_product_id,
  p.tienda_id,
  p.name AS producto_nombre,
  
  -- Medidas Reales del Producto
  p.peso AS peso_real,
  p.largo AS largo_real,
  p.alto AS alto_real,
  p.ancho AS ancho_real,
  
  -- Información del Empaque asociado
  e.id AS tipo_empaque_id,
  e.nombre AS empaque_nombre,
  e.peso AS empaque_peso,
  e.largo AS empaque_largo,
  e.alto AS empaque_alto,
  e.ancho AS empaque_ancho,
  
  -- Medidas Finales (Fallback: Real -> Empaque -> Default 1 / 10)
  COALESCE(p.peso, e.peso, 1.00) AS peso_final,
  COALESCE(p.largo, e.largo, 10.00) AS largo_final,
  COALESCE(p.alto, e.alto, 10.00) AS alto_final,
  COALESCE(p.ancho, e.ancho, 10.00) AS ancho_final
FROM produc p
LEFT JOIN tipo_empaque e ON p.tipo_empaque_id = e.id;
