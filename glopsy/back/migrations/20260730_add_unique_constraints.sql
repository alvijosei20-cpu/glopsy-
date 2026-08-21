-- Restricciones de unicidad para evitar duplicados en fullments, ofertas y perfiles_envio

-- 1. Fullments: Un centro de distribución por tienda y ciudad
ALTER TABLE fullments DROP CONSTRAINT IF EXISTS unique_tienda_ciudad_fullment;
ALTER TABLE fullments ADD CONSTRAINT unique_tienda_ciudad_fullment UNIQUE (tienda_id, ciudad_id);

-- 2. Ofertas: Una oferta con el mismo título por tienda
ALTER TABLE ofertas DROP CONSTRAINT IF EXISTS unique_tienda_oferta_titulo;
ALTER TABLE ofertas ADD CONSTRAINT unique_tienda_oferta_titulo UNIQUE (tienda_id, titulo);

-- 3. Perfiles de envío: Un perfil de envío con el mismo nombre por tienda
ALTER TABLE perfiles_envio DROP CONSTRAINT IF EXISTS unique_tienda_perfil_nombre;
ALTER TABLE perfiles_envio ADD CONSTRAINT unique_tienda_perfil_nombre UNIQUE (tienda_id, nombre);
