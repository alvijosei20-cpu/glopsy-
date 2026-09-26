-- Operación bajo mandato (intermediación): identifica al tercero (mandante)
-- por cuya cuenta la tienda factura y recauda. Soporta el "blindaje" DIAN del
-- dinero de terceros que llega a la cuenta de pagos de la plataforma.
ALTER TABLE tienda_dian
  ADD COLUMN IF NOT EXISTS mandato_activo BOOLEAN DEFAULT FALSE;
ALTER TABLE tienda_dian
  ADD COLUMN IF NOT EXISTS mandato_tercero_nombre VARCHAR(150);
ALTER TABLE tienda_dian
  ADD COLUMN IF NOT EXISTS mandato_tercero_tipo_documento VARCHAR(10);
ALTER TABLE tienda_dian
  ADD COLUMN IF NOT EXISTS mandato_tercero_documento VARCHAR(20);