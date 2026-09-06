-- Columnas SEO auto-generadas por el motor de marketing sobre el catálogo
ALTER TABLE produc ADD COLUMN IF NOT EXISTS seo_title VARCHAR(160);
ALTER TABLE produc ADD COLUMN IF NOT EXISTS seo_keywords JSONB DEFAULT '[]'::jsonb;
ALTER TABLE produc ADD COLUMN IF NOT EXISTS seo_updated_at TIMESTAMPTZ;

-- Motor de Marketing de glopsy
-- Analiza el catálogo cada 6h y produce sugerencias accionables
-- (SEO, promociones, stock, redes sociales y email/push).
-- Las sugerencias se generan con reglas siempre; el LLM (DeepSeek)
-- solo se usa como capa de mejora y nunca es requisito.

-- Bitácora de ejecuciones del motor
CREATE TABLE IF NOT EXISTS marketing_runs (
  id SERIAL PRIMARY KEY,
  tienda_id BIGINT NOT NULL REFERENCES tiendas(usrid) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL DEFAULT 'auto' CHECK (tipo IN ('auto', 'manual')),
  estado VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (estado IN ('running', 'ok', 'error')),
  resumen JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_marketing_runs_tienda ON marketing_runs(tienda_id, started_at DESC);

-- Sugerencias generadas por el motor de marketing
CREATE TABLE IF NOT EXISTS marketing_suggestions (
  id SERIAL PRIMARY KEY,
  tienda_id BIGINT NOT NULL REFERENCES tiendas(usrid) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('seo', 'promo', 'stock', 'social', 'email')),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aplicada', 'descartada')),
  fuente VARCHAR(10) NOT NULL DEFAULT 'rules' CHECK (fuente IN ('rules', 'llm')),
  titulo VARCHAR(200) NOT NULL,
  detalle TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  product_id INTEGER REFERENCES produc(id) ON DELETE CASCADE,
  oferta_id INTEGER REFERENCES ofertas(id) ON DELETE SET NULL,
  dedupe_key VARCHAR(160) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ,
  UNIQUE (tienda_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_marketing_sug_tienda_estado ON marketing_suggestions(tienda_id, estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_sug_tipo ON marketing_suggestions(tipo);
CREATE INDEX IF NOT EXISTS idx_marketing_sug_producto ON marketing_suggestions(product_id);
