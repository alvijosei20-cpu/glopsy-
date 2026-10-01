-- Trazabilidad de la aceptación de Términos y Condiciones y de la Política de
-- Privacidad por parte de los usuarios (compradores). Registra usuario, IP,
-- timestamp, navegador, dispositivo, país e idioma para dejar constancia
-- auditable del consentimiento previo, expreso e informado (Ley 1581 de 2012,
-- art. 9).

CREATE TABLE IF NOT EXISTS public.user_aceptaciones (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL,
  terms_version   VARCHAR(30),
  privacy_version VARCHAR(30),
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
  referrer        TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_user_aceptaciones_user ON public.user_aceptaciones(user_id);
CREATE INDEX IF NOT EXISTS idx_user_aceptaciones_at ON public.user_aceptaciones(accepted_at);

-- Consentimiento vigente del usuario y soporte para la supresión de cuenta
-- (derecho de supresión, Ley 1581 de 2012 art. 8).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(30);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS privacy_version VARCHAR(30);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
