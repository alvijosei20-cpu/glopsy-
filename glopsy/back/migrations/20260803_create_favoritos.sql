-- Creación de la tabla favoritos para que los usuarios puedan marcar sus productos favoritos
CREATE TABLE IF NOT EXISTS favoritos (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES tiendas(usrid) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES produc(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_product_favorite UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_favoritos_user_id ON favoritos(user_id);
CREATE INDEX IF NOT EXISTS idx_favoritos_product_id ON favoritos(product_id);
