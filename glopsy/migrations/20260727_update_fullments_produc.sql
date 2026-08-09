-- Reestructuración: eliminar producto_id y tienda_id de fullments, y agregar fullm_id a produc

DROP TABLE IF EXISTS fullments CASCADE;

CREATE TABLE IF NOT EXISTS fullments (
  id SERIAL PRIMARY KEY,
  tienda_id BIGINT NOT NULL REFERENCES tiendas(usrid) ON DELETE CASCADE,
  ciudad_id INTEGER NOT NULL REFERENCES ciudades(id) ON DELETE CASCADE,
  costo_kg NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  costo_dms NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  estado VARCHAR(50) DEFAULT 'activo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_tienda_ciudad_fullment UNIQUE (tienda_id, ciudad_id)
);

CREATE INDEX IF NOT EXISTS idx_fullments_tienda_id ON fullments(tienda_id);
CREATE INDEX IF NOT EXISTS idx_fullments_ciudad_id ON fullments(ciudad_id);

-- Actualizar tabla produc para incluir fullm_id y su índice
ALTER TABLE produc ADD COLUMN IF NOT EXISTS fullm_id INTEGER REFERENCES fullments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_produc_fullm_id ON produc(fullm_id);
