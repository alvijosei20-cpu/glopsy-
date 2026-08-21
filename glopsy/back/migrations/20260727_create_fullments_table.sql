-- Creación de la tabla fullments relacional con tiendas, produc y ciudades
CREATE TABLE IF NOT EXISTS fullments (
  id SERIAL PRIMARY KEY,
  tienda_id BIGINT NOT NULL REFERENCES tiendas(usrid) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES produc(id) ON DELETE CASCADE,
  ciudad_id INTEGER NOT NULL REFERENCES ciudades(id) ON DELETE CASCADE,
  costo_kg NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  costo_dms NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  estado VARCHAR(50) DEFAULT 'activo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_tienda_producto_ciudad UNIQUE (tienda_id, producto_id, ciudad_id)
);

-- Índices para facilitar la búsqueda y optimizar relaciones
CREATE INDEX IF NOT EXISTS idx_fullments_tienda_id ON fullments(tienda_id);
CREATE INDEX IF NOT EXISTS idx_fullments_producto_id ON fullments(producto_id);
CREATE INDEX IF NOT EXISTS idx_fullments_ciudad_id ON fullments(ciudad_id);
