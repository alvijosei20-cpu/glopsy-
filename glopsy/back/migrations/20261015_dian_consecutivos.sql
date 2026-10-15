-- Rango de numeración de la resolución DIAN (para la plantilla manual).
ALTER TABLE tienda_dian ADD COLUMN IF NOT EXISTS consecutivo_desde integer DEFAULT 1;
ALTER TABLE tienda_dian ADD COLUMN IF NOT EXISTS consecutivo_hasta integer DEFAULT 5000;
ALTER TABLE tienda_dian ADD COLUMN IF NOT EXISTS consecutivo_actual integer DEFAULT 1;
