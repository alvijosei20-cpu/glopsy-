-- Eliminar tienda_id de la tabla fullments
ALTER TABLE fullments DROP CONSTRAINT IF EXISTS unique_tienda_ciudad_fullment;
DROP INDEX IF EXISTS idx_fullments_tienda_id;
ALTER TABLE fullments DROP COLUMN IF EXISTS tienda_id;

-- Restricción única en ciudad_id para fullments
ALTER TABLE fullments ADD CONSTRAINT unique_ciudad_fullment UNIQUE (ciudad_id);
