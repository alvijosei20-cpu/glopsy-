-- ============================================================
-- Reglas de arancel e IVA de importación por país destino, para la
-- calculadora de aranceles del checkout internacional.
--
-- Son ESTIMADOS informativos: el cliente paga los tributos a la aduana al
-- recibir (DAP). No constituyen liquidación oficial.
--
-- Cada país tiene una tasa de IVA general y reglas de arancel por categoría
-- (scope 'categoria'). Si un producto no cae en ninguna, se usa la regla
-- 'default' del país.
-- ============================================================

CREATE TABLE IF NOT EXISTS tariff_countries (
  pais_iso VARCHAR(2) PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  iva_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  de_minimis_usd NUMERIC(12,2),
  activo BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tariff_rules (
  id SERIAL PRIMARY KEY,
  pais_iso VARCHAR(2) NOT NULL REFERENCES tariff_countries(pais_iso) ON DELETE CASCADE,
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('default', 'categoria')),
  scope_id INTEGER,                     -- categorias.id cuando scope = 'categoria'
  arancel_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (arancel_pct >= 0 AND arancel_pct <= 100),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tariff_rule
  ON tariff_rules (pais_iso, scope, COALESCE(scope_id, 0));

INSERT INTO tariff_countries (pais_iso, nombre, iva_pct, de_minimis_usd) VALUES
  ('CO', 'Colombia', 19.00, 200.00),
  ('VE', 'Venezuela', 16.50, NULL)
ON CONFLICT (pais_iso) DO NOTHING;

-- Reglas por categoría (mapeadas al catálogo global de categorias).
INSERT INTO tariff_rules (pais_iso, scope, scope_id, arancel_pct)
SELECT v.pais_iso, 'categoria', c.id, v.arancel
FROM (VALUES
  ('CO','Tecnología', 5.0), ('CO','Celulares y Telefonía', 0.0), ('CO','Computación', 0.0),
  ('CO','Videojuegos y Consolas', 5.0), ('CO','Electrodomésticos', 5.0),
  ('CO','Hogar y Cocina', 10.0), ('CO','Muebles y Decoración', 10.0),
  ('CO','Herramientas y Construcción', 10.0), ('CO','Moda y Calzado', 15.0),
  ('CO','Belleza y Cuidado Personal', 10.0), ('CO','Deportes', 10.0),
  ('CO','Juguetes y Bebés', 10.0), ('CO','Mascotas', 10.0),
  ('CO','Salud y Equipamiento Médico', 5.0), ('CO','Industria y Oficina', 10.0),
  ('CO','Vehículos y Accesorios', 5.0), ('CO','Supermercado y Alimentos', 15.0),
  ('CO','Libros, Música y Películas', 0.0), ('CO','Instrumentos Musicales', 10.0),
  ('CO','Arte y Manualidades', 10.0), ('CO','Jardín y Aire Libre', 10.0),
  ('CO','Fiestas y Eventos', 10.0), ('CO','Otros', 10.0),
  ('VE','Tecnología', 5.0), ('VE','Celulares y Telefonía', 5.0), ('VE','Computación', 5.0),
  ('VE','Videojuegos y Consolas', 10.0), ('VE','Electrodomésticos', 10.0),
  ('VE','Hogar y Cocina', 10.0), ('VE','Muebles y Decoración', 10.0),
  ('VE','Herramientas y Construcción', 10.0), ('VE','Moda y Calzado', 15.0),
  ('VE','Belleza y Cuidado Personal', 15.0), ('VE','Deportes', 10.0),
  ('VE','Juguetes y Bebés', 10.0), ('VE','Mascotas', 10.0),
  ('VE','Salud y Equipamiento Médico', 5.0), ('VE','Industria y Oficina', 10.0),
  ('VE','Vehículos y Accesorios', 5.0), ('VE','Supermercado y Alimentos', 10.0),
  ('VE','Libros, Música y Películas', 5.0), ('VE','Instrumentos Musicales', 10.0),
  ('VE','Arte y Manualidades', 10.0), ('VE','Jardín y Aire Libre', 10.0),
  ('VE','Fiestas y Eventos', 10.0), ('VE','Otros', 10.0)
) AS v(pais_iso, categoria, arancel)
JOIN categorias c ON c.nombre = v.categoria AND c.tienda_id IS NULL
ON CONFLICT DO NOTHING;

-- Regla de respaldo por país.
INSERT INTO tariff_rules (pais_iso, scope, scope_id, arancel_pct) VALUES
  ('CO', 'default', NULL, 10.0),
  ('VE', 'default', NULL, 10.0)
ON CONFLICT DO NOTHING;
