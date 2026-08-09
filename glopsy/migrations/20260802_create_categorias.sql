-- Creación de la tabla categorias para clasificar los productos de la tienda
CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  tienda_id BIGINT REFERENCES tiendas(usrid) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categorias_tienda_id ON categorias(tienda_id);

-- Agregar categoria_id a la tabla produc
ALTER TABLE produc ADD COLUMN IF NOT EXISTS categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_produc_categoria_id ON produc(categoria_id);

-- Insertar categorías generales por defecto si no existen
INSERT INTO categorias (nombre, descripcion) VALUES 
  ('Tecnología', 'Gadgets, electrónicos y accesorios'),
  ('Hogar y Cocina', 'Artículos para el hogar y cocina'),
  ('Moda y Calzado', 'Ropa, zapatos y accesorios'),
  ('Belleza y Cuidado Personal', 'Cosméticos y cuidado personal'),
  ('Deportes', 'Equipamiento y ropa deportiva'),
  ('Otros', 'Varios y otros productos')
ON CONFLICT DO NOTHING;
