-- Subdominio público por tienda (Opción B): cada tienda vive en <slug>.glopsy.shop
-- El slug se normaliza a minúsculas + guiones y es único (NULL permitido = sin subdominio).
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS slug VARCHAR(63);
CREATE UNIQUE INDEX IF NOT EXISTS tiendas_slug_unique ON public.tiendas(slug) WHERE slug IS NOT NULL;
