-- Agregar campos de variante seleccionada y opciones seleccionadas a la tabla produc para sincronizar con el frontend
ALTER TABLE produc ADD COLUMN IF NOT EXISTS selected_variant_id VARCHAR(100);
ALTER TABLE produc ADD COLUMN IF NOT EXISTS selected_options JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_produc_selected_variant_id ON produc(selected_variant_id);
