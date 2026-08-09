-- Creación de la tabla checkout_integrations (chackout_inte) para pasarelas de pago y envío (Mercado Pago y ENVIA)
CREATE TABLE IF NOT EXISTS checkout_integrations (
  id SERIAL PRIMARY KEY,
  tienda_id BIGINT NOT NULL REFERENCES tiendas(usrid) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  public_key TEXT,
  access_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_tienda_checkout_provider UNIQUE (tienda_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_checkout_integrations_tienda_id ON checkout_integrations(tienda_id);
CREATE INDEX IF NOT EXISTS idx_checkout_integrations_provider ON checkout_integrations(provider);

-- Vista de compatibilidad para chackout_inte si es requerida
CREATE OR REPLACE VIEW chackout_inte AS 
SELECT id, tienda_id, provider, public_key, access_token, created_at, updated_at 
FROM checkout_integrations;
