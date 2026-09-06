-- Conexión de la página de Facebook por tienda para publicar contenido social
-- generado por el asistente de marketing. Los tokens se guardan cifrados con
-- encryptSecret (APP_ENC_KEY); nunca en texto plano.
CREATE TABLE IF NOT EXISTS facebook_pages (
  id SERIAL PRIMARY KEY,
  tienda_id BIGINT NOT NULL REFERENCES tiendas(usrid) ON DELETE CASCADE,
  fb_page_id VARCHAR(64) NOT NULL,
  fb_page_name VARCHAR(200) NOT NULL,
  fb_user_name VARCHAR(200),
  access_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_facebook_page_tienda UNIQUE (tienda_id)
);

CREATE INDEX IF NOT EXISTS idx_facebook_pages_tienda ON facebook_pages(tienda_id);
