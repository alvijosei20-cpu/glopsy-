-- Pixel de TikTok por tienda (marketing/atribución). Cada tienda reporta sus
-- eventos e-commerce a SU pixel para optimizar campañas de TikTok Ads.

ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS tiktok_pixel_id VARCHAR(64);
