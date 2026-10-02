-- Token de acceso de TikTok (Events API / Marketing) por tienda, para enviar
-- eventos de conversión server-side. Se guarda cifrado y NO se expone en el
-- payload público de la tienda.

ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS tiktok_access_token text;
