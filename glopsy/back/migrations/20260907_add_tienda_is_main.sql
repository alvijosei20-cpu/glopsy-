-- Tienda "principal" (la del dueño de la plataforma): app.glopsy.shop muestra SOLO su
-- catálogo. Las demás tiendas viven únicamente en su subdominio.
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS is_main boolean NOT NULL DEFAULT false;

-- Solo puede existir una tienda principal.
CREATE UNIQUE INDEX IF NOT EXISTS tiendas_one_main ON public.tiendas((is_main)) WHERE is_main;

-- Marca como principal a la tienda más antigua si aún no hay ninguna designada.
UPDATE public.tiendas SET is_main = true
WHERE usrid = (SELECT usrid FROM public.tiendas ORDER BY usrid ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.tiendas WHERE is_main);
