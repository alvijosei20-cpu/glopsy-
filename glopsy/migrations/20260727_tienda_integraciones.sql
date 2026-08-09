CREATE TABLE IF NOT EXISTS tienda_integraciones (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_provider UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_tienda_integraciones_user_id ON tienda_integraciones(user_id);
CREATE INDEX IF NOT EXISTS idx_tienda_integraciones_provider ON tienda_integraciones(provider);
