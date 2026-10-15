-- El IVA por producto debe ser NULL cuando no se definió tratamiento, para que
-- el ledger use la tasa del país como respaldo (y no 0 por defecto).
ALTER TABLE public.produc ALTER COLUMN iva_pct DROP DEFAULT;
UPDATE public.produc SET iva_pct = NULL WHERE iva_tratamiento IS NULL;
