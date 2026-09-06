ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tiktok_id character varying(255);

CREATE UNIQUE INDEX IF NOT EXISTS users_tiktok_id_key ON public.users (tiktok_id) WHERE tiktok_id IS NOT NULL;
