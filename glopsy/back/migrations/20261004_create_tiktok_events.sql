-- Registro de eventos enviados a la TikTok Events API (server-side). Sirve para
-- idempotencia (un envío por pedido) y para auditoría/depuración.

CREATE TABLE IF NOT EXISTS public.tiktok_events (
  id          bigserial PRIMARY KEY,
  event_id    text NOT NULL UNIQUE,
  event_name  text NOT NULL,
  user_id     bigint,
  tienda_id   bigint,
  pixel_id    text,
  status      text NOT NULL DEFAULT 'pending',
  http_status integer,
  response    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz
);

CREATE INDEX IF NOT EXISTS tiktok_events_user_idx ON public.tiktok_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tiktok_events_status_idx ON public.tiktok_events (status, created_at DESC);
