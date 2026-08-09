-- Creación de la tabla ofertas para gestionar promociones y descuentos de las tiendas (globales o por ciudad)
CREATE TABLE IF NOT EXISTS ofertas (
  id SERIAL PRIMARY KEY,
  tienda_id BIGINT NOT NULL REFERENCES tiendas(usrid) ON DELETE CASCADE,
  titulo VARCHAR(150) NOT NULL,
  descripcion TEXT,
  tipo_descuento VARCHAR(20) NOT NULL CHECK (tipo_descuento IN ('porcentaje', 'monto_fijo')),
  valor_descuento NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  alcance VARCHAR(20) NOT NULL CHECK (alcance IN ('global', 'ciudad')),
  ciudad_id INTEGER REFERENCES ciudades(id) ON DELETE CASCADE,
  fecha_inicio TIMESTAMP WITH TIME ZONE,
  fecha_fin TIMESTAMP WITH TIME ZONE,
  estado VARCHAR(50) DEFAULT 'activo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas de ofertas por tienda y ciudad
CREATE INDEX IF NOT EXISTS idx_ofertas_tienda_id ON ofertas(tienda_id);
CREATE INDEX IF NOT EXISTS idx_ofertas_ciudad_id ON ofertas(ciudad_id);
