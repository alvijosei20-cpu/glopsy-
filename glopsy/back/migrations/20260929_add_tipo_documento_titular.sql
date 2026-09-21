-- Tipo de documento del titular de la cuenta de liquidación (sensible al país).
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(20);
