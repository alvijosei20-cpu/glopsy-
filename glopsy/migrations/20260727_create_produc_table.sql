CREATE TABLE IF NOT EXISTS produc (
  id SERIAL PRIMARY KEY,
  tienda_id BIGINT NOT NULL REFERENCES tiendas(usrid) ON DELETE CASCADE,
  external_product_id VARCHAR(100),
  integracion_id INTEGER REFERENCES tienda_integraciones(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  base_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  base_currency_price VARCHAR(10) DEFAULT 'USD',
  suggested_price NUMERIC(12, 2),
  description TEXT,
  stock_total INTEGER DEFAULT 0,
  product_owner JSONB,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  warranties JSONB NOT NULL DEFAULT '{}'::jsonb,
  support JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para facilitar la búsqueda en la tabla produc y su relación con tiendas e integraciones
CREATE INDEX IF NOT EXISTS idx_produc_tienda_id ON produc(tienda_id);
CREATE INDEX IF NOT EXISTS idx_produc_name ON produc(name);
CREATE INDEX IF NOT EXISTS idx_produc_external_id ON produc(external_product_id);
CREATE INDEX IF NOT EXISTS idx_produc_integracion_id ON produc(integracion_id);
