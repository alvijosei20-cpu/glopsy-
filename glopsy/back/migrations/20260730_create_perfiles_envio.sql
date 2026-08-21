-- Creación de la tabla perfiles_envio para gestionar los perfiles de envío de las tiendas
CREATE TABLE IF NOT EXISTS perfiles_envio (
  id SERIAL PRIMARY KEY,
  tienda_id BIGINT NOT NULL REFERENCES tiendas(usrid) ON DELETE CASCADE,
  nombre VARCHAR(150) NOT NULL,
  tipo_envio VARCHAR(20) NOT NULL CHECK (tipo_envio IN ('gratis', 'cobro')),
  alcance VARCHAR(20) NOT NULL CHECK (alcance IN ('global', 'ciudad')),
  ciudad_id INTEGER REFERENCES ciudades(id) ON DELETE CASCADE,
  costo NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  estado VARCHAR(50) DEFAULT 'activo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas de perfiles de envío por tienda y ciudad
CREATE INDEX IF NOT EXISTS idx_perfiles_envio_tienda_id ON perfiles_envio(tienda_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_envio_ciudad_id ON perfiles_envio(ciudad_id);
