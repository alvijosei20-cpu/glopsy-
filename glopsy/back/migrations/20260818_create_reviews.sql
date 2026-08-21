-- Reseñas de productos: solo usuarios que compraron el producto (1 por compra completada)
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES produc(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews(order_id);

-- Una reseña por usuario, producto y compra (order_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_product_user_order ON reviews(product_id, user_id, order_id);
