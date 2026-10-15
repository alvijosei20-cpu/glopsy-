-- Tratamiento de IVA por producto (exactitud DIAN/SENIAT).
-- gravado | excluido | exento | no_responsable
-- iva_pct = tarifa aplicable (0 para excluido/exento/no_responsable).
ALTER TABLE public.produc
  ADD COLUMN IF NOT EXISTS iva_tratamiento VARCHAR(15),
  ADD COLUMN IF NOT EXISTS iva_pct NUMERIC(5,2);

CREATE INDEX IF NOT EXISTS idx_produc_iva_tratamiento
  ON public.produc(iva_tratamiento) WHERE iva_tratamiento IS NOT NULL;
