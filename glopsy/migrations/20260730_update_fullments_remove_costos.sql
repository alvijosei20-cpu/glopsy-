-- Actualizar la tabla fullments eliminando los campos costo_kg y costo_dms
ALTER TABLE fullments DROP COLUMN IF EXISTS costo_kg;
ALTER TABLE fullments DROP COLUMN IF EXISTS costo_dms;
