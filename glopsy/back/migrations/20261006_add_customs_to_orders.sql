-- Documento de exportación: URL de la factura comercial generada con envia.com
-- y snapshot de los datos aduaneros usados (HS codes, valores declarados,
-- customsSettings) para trazabilidad y auditoría del pedido internacional.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS commercial_invoice_url TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customs_payload JSONB;
