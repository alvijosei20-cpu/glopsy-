-- Moneda real de cobro de la orden (puede diferir de la moneda de la tienda:
-- tiendas habilitadas en USD cobran COP a visitantes del mismo país).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency VARCHAR(3);
