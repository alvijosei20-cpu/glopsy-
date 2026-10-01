-- Credenciales globales de OAuth de la plataforma (p. ej. TikTok Login Kit).
-- Se configuran desde el panel (tienda principal) y tienen respaldo en variables
-- de entorno. El client_secret se guarda cifrado (utils/crypto.js).

CREATE TABLE IF NOT EXISTS public.plataforma_oauth (
  provider      varchar(30) PRIMARY KEY,
  client_id     text,
  client_secret text,
  redirect_uri  text,
  scopes        text,
  enabled       boolean NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
