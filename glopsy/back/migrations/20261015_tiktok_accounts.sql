-- Cuenta de TikTok del vendedor para publicar contenido (Content Posting API).
-- Guarda tokens OAuth (cifrados) con scope video.upload.
CREATE TABLE IF NOT EXISTS tiktok_accounts (
  tienda_id bigint PRIMARY KEY,
  open_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  scope text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
