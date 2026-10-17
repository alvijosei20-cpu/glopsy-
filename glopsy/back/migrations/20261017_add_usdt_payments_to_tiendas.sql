-- Cobro en USDT con Glopsy Pay habilitado por la propia tienda (self-service).
ALTER TABLE tiendas
  ADD COLUMN IF NOT EXISTS usdt_payments_enabled BOOLEAN NOT NULL DEFAULT false;

-- Las tiendas ya aprobadas para vender en USD conservan el cobro en USDT.
UPDATE tiendas SET usdt_payments_enabled = true WHERE usd_activation_status = 'approved';
