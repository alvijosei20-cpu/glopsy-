-- Trazabilidad de la aceptación de Términos y Condiciones (y Contrato de Mandato)
-- al crear una tienda (vendedor). Guarda usuario, IP, timestamp, navegador,
-- dispositivo, país, idioma y coordenadas para dejar un registro claro y auditable.

CREATE TABLE IF NOT EXISTS public.tienda_aceptaciones (
  id              BIGSERIAL PRIMARY KEY,
  tienda_usrid    BIGINT NOT NULL,
  user_id         BIGINT,
  terms_version   VARCHAR(30) NOT NULL,
  accepted        BOOLEAN NOT NULL DEFAULT true,
  accepted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip              VARCHAR(64),
  forwarded_for   TEXT,
  user_agent      TEXT,
  browser         VARCHAR(80),
  browser_version VARCHAR(40),
  os              VARCHAR(80),
  device          VARCHAR(40),
  language        VARCHAR(60),
  timezone        VARCHAR(60),
  country         VARCHAR(2),
  latitude        NUMERIC(10,7),
  longitude       NUMERIC(10,7),
  referrer        TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_tienda_aceptaciones_usrid ON public.tienda_aceptaciones(tienda_usrid);
CREATE INDEX IF NOT EXISTS idx_tienda_aceptaciones_user ON public.tienda_aceptaciones(user_id);
CREATE INDEX IF NOT EXISTS idx_tienda_aceptaciones_at ON public.tienda_aceptaciones(accepted_at);

-- Marca rápida en la tienda de la última aceptación registrada.
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS terms_version VARCHAR(30);
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
