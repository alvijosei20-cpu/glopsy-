-- Datos aduaneros por producto para envíos internacionales (envia.com).
-- HS code (Sistema Armonizado) y país de fabricación se envían a ENVIA para
-- la clasificación arancelaria, el cálculo de derechos/impuestos (DDP) y la
-- factura comercial.
ALTER TABLE produc
  ADD COLUMN IF NOT EXISTS hs_code VARCHAR(20);

ALTER TABLE produc
  ADD COLUMN IF NOT EXISTS country_of_manufacture VARCHAR(2);

CREATE INDEX IF NOT EXISTS idx_produc_hs_code ON produc(hs_code);
