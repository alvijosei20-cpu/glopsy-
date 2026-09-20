-- La tienda principal (app.glopsy.shop) vende en Colombia.
UPDATE tiendas
SET pais_id = (SELECT id FROM paises WHERE codigo_iso = 'CO' LIMIT 1)
WHERE is_main = true AND pais_id IS NULL;
