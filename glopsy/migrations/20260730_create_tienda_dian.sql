-- Creación de la tabla tienda_dian para la facturación electrónica DIAN relacionada con tiendas
CREATE TABLE IF NOT EXISTS tienda_dian (
  id SERIAL PRIMARY KEY,
  tienda_id BIGINT NOT NULL REFERENCES tiendas(usrid) ON DELETE CASCADE,
  sw_id VARCHAR(255) NOT NULL,
  sw_pin VARCHAR(255) NOT NULL,
  technical_key TEXT NOT NULL,
  prefix VARCHAR(50) NOT NULL,
  test_set_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_tienda_dian UNIQUE (tienda_id)
);

CREATE INDEX IF NOT EXISTS idx_tienda_dian_tienda_id ON tienda_dian(tienda_id);
