-- Desglose por línea de cada venta en el ledger: costo base (proveedor),
-- costo de venta, tarifa de Glopsy, tarifa de pasarela, IVA (si aplica) y neto
-- al proveedor. Permite el control completo de lo vendido.

CREATE TABLE IF NOT EXISTS ledger_sale_lines (
  id            BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT REFERENCES ledger_transactions(id) ON DELETE CASCADE,
  order_id      BIGINT,
  order_item_id BIGINT,
  product_id    BIGINT,
  provider_ref  TEXT,
  tienda_id     BIGINT,
  moneda        VARCHAR(10) NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 1,
  base_cost     NUMERIC(14,2) NOT NULL DEFAULT 0,
  sale_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
  glopsy_fee    NUMERIC(14,2) NOT NULL DEFAULT 0,
  gateway_fee   NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva           NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva_rate      NUMERIC(5,2) NOT NULL DEFAULT 0,
  provider_net  NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_sale_lines_tx ON ledger_sale_lines(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_sale_lines_order ON ledger_sale_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_ledger_sale_lines_provider ON ledger_sale_lines(provider_ref, moneda);
CREATE INDEX IF NOT EXISTS idx_ledger_sale_lines_tienda ON ledger_sale_lines(tienda_id, moneda, created_at);
