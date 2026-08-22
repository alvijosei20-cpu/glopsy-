-- Agregar delivered_at a order_shipments para controlar la ventana de devolución (5 días hábiles)
ALTER TABLE order_shipments ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_order_shipments_delivered_at ON order_shipments(delivered_at);
