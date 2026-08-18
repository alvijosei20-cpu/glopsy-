-- Promociones: soporte para alcance 'productos' y relación con productos publicados

-- Ampliar el CHECK de alcance para permitir 'productos'
ALTER TABLE ofertas DROP CONSTRAINT IF EXISTS ofertas_alcance_check;
ALTER TABLE ofertas ADD CONSTRAINT ofertas_alcance_check CHECK (alcance IN ('global', 'productos', 'ciudad'));

-- Tabla de relación promoción <-> productos (muchos a muchos)
CREATE TABLE IF NOT EXISTS oferta_productos (
  oferta_id INTEGER NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES produc(id) ON DELETE CASCADE,
  PRIMARY KEY (oferta_id, producto_id)
);

CREATE INDEX IF NOT EXISTS idx_oferta_productos_producto_id ON oferta_productos(producto_id);

-- Solo una promoción global activa por tienda
CREATE UNIQUE INDEX IF NOT EXISTS uq_oferta_global_activa ON ofertas (tienda_id) WHERE alcance = 'global' AND estado = 'activo';
