CREATE TABLE IF NOT EXISTS returns (
  id SERIAL PRIMARY KEY,
  return_number VARCHAR(40) NOT NULL UNIQUE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  order_ref VARCHAR(100),
  tienda_id BIGINT REFERENCES tiendas(usrid) ON DELETE CASCADE,
  product_id INTEGER REFERENCES produc(id) ON DELETE SET NULL,
  product_sku VARCHAR(100),
  quantity INTEGER NOT NULL DEFAULT 1,
  reason VARCHAR(500),
  customer_notes TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'RETURN_REQUESTED',
  mastershop_status VARCHAR(60),
  mastershop_tracking VARCHAR(200),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_order_id ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_return_number ON returns(return_number);
CREATE INDEX IF NOT EXISTS idx_returns_order_ref ON returns(order_ref);
