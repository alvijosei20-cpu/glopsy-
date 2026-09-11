-- Venezuela: origen de envíos configurable por tienda (integración ZOOM Envíos).
-- zoom_origen_codciudad = código de ciudad de ZOOM (getCiudades).
-- zoom_modalidad: 1 = retirar por oficina, 2 = puerta a puerta.
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS zoom_origen_codciudad INTEGER;
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS zoom_modalidad SMALLINT DEFAULT 2;
