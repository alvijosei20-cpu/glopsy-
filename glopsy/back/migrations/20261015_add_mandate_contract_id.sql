-- Contrato de Mandato del proveedor (modelo de intermediación/dropshipping):
-- identificador único tipo "time hash" (GLM-<timestamp>-<hash>) y trazabilidad
-- de su aceptación al crear la tienda. Cumple con la Ley 527 de 1999 (mensajes
-- de datos y firmas electrónicas) al dejar constancia verificable de la aceptación.

ALTER TABLE public.tienda_aceptaciones
  ADD COLUMN IF NOT EXISTS contract_id      VARCHAR(80),
  ADD COLUMN IF NOT EXISTS contract_type    VARCHAR(30),
  ADD COLUMN IF NOT EXISTS contract_version VARCHAR(30);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tienda_aceptaciones_contract_id
  ON public.tienda_aceptaciones(contract_id)
  WHERE contract_id IS NOT NULL;

-- Referencia rápida del contrato vigente de cada tienda (para mostrarlo/consultarlo).
ALTER TABLE public.tiendas
  ADD COLUMN IF NOT EXISTS mandate_contract_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS mandate_version     VARCHAR(30),
  ADD COLUMN IF NOT EXISTS mandate_accepted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tiendas_mandate_contract
  ON public.tiendas(mandate_contract_id);
