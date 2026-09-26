-- Venta al exterior: las exportaciones de bienes están excluidas de IVA
-- (art. 481 E.T.). Se marca por pedido cuando el checkout cobra en USD
-- (comprador exterior) en una tienda habilitada en USD.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS es_exportacion BOOLEAN NOT NULL DEFAULT FALSE;

-- Estados de liquidación extendidos para el flujo de liberación con
-- verificación de disputas/contracargos en la pasarela antes de dispersar.
ALTER TABLE payouts
  DROP CONSTRAINT IF EXISTS payouts_estado_check;
ALTER TABLE payouts
  ADD CONSTRAINT payouts_estado_check
  CHECK (estado IN ('pendiente', 'retenido', 'enviando', 'pagado', 'fallido'));