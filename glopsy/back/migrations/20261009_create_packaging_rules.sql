-- ============================================================
-- Reglas de empaque por categoría para optimizar el volumen cotizado.
--
-- El courier cobra por PESO VOLUMÉTRICO (LxWxH / 5000). Cajas demasiado
-- grandes encarecen el envío. Estas reglas definen el tamaño típico de
-- empaque por categoría para no sobrefacturar. Editables en el panel.
--
-- product_peso_factor: multiplicador del peso del producto para incluir el
-- empaque (ej. 1.15 = +15%).
-- ============================================================

CREATE TABLE IF NOT EXISTS packaging_rules (
  id SERIAL PRIMARY KEY,
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('default', 'categoria')),
  scope_id INTEGER,               -- categorias.id cuando scope = 'categoria'
  largo_cm NUMERIC(8,2) NOT NULL,
  ancho_cm NUMERIC(8,2) NOT NULL,
  alto_cm NUMERIC(8,2) NOT NULL,
  peso_min_kg NUMERIC(8,2) NOT NULL DEFAULT 1,
  product_peso_factor NUMERIC(5,2) NOT NULL DEFAULT 1.15,
  activo BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_packaging_rule
  ON packaging_rules (scope, COALESCE(scope_id, 0));

-- Reglas por categoría (caja ajustada + peso mínimo realista).
INSERT INTO packaging_rules (scope, scope_id, largo_cm, ancho_cm, alto_cm, peso_min_kg, product_peso_factor)
SELECT 'categoria', c.id, v.l, v.a, v.h, v.pmin, v.factor
FROM (VALUES
  ('Moda y Calzado',              35.0, 25.0, 15.0, 0.8, 1.20),
  ('Tecnología',                  30.0, 20.0, 10.0, 0.5, 1.15),
  ('Celulares y Telefonía',       20.0, 15.0,  8.0, 0.4, 1.15),
  ('Computación',                 40.0, 30.0, 10.0, 1.5, 1.15),
  ('Videojuegos y Consolas',      30.0, 25.0, 12.0, 0.8, 1.15),
  ('Electrodomésticos',           50.0, 40.0, 30.0, 2.0, 1.20),
  ('Hogar y Cocina',              35.0, 30.0, 20.0, 1.0, 1.20),
  ('Muebles y Decoración',        60.0, 50.0, 40.0, 3.0, 1.25),
  ('Herramientas y Construcción', 40.0, 30.0, 20.0, 1.5, 1.20),
  ('Belleza y Cuidado Personal',  20.0, 15.0, 10.0, 0.4, 1.20),
  ('Deportes',                    40.0, 30.0, 20.0, 1.0, 1.20),
  ('Juguetes y Bebés',            30.0, 25.0, 15.0, 0.6, 1.20),
  ('Mascotas',                    35.0, 30.0, 20.0, 1.0, 1.20),
  ('Salud y Equipamiento Médico', 30.0, 25.0, 15.0, 0.6, 1.15),
  ('Industria y Oficina',         35.0, 30.0, 20.0, 1.0, 1.20),
  ('Vehículos y Accesorios',      40.0, 30.0, 20.0, 1.5, 1.20),
  ('Supermercado y Alimentos',    35.0, 30.0, 25.0, 1.5, 1.15),
  ('Libros, Música y Películas',  25.0, 20.0,  8.0, 0.5, 1.10),
  ('Instrumentos Musicales',      60.0, 40.0, 25.0, 2.5, 1.20),
  ('Arte y Manualidades',         30.0, 25.0, 15.0, 0.6, 1.15),
  ('Jardín y Aire Libre',         40.0, 30.0, 25.0, 1.5, 1.20),
  ('Fiestas y Eventos',           35.0, 30.0, 20.0, 1.0, 1.20),
  ('Otros',                       35.0, 30.0, 20.0, 1.0, 1.15)
) AS v(categoria, l, a, h, pmin, factor)
JOIN categorias c ON c.nombre = v.categoria AND c.tienda_id IS NULL
ON CONFLICT DO NOTHING;

-- Respaldo general.
INSERT INTO packaging_rules (scope, scope_id, largo_cm, ancho_cm, alto_cm, peso_min_kg, product_peso_factor)
VALUES ('default', NULL, 35.0, 30.0, 20.0, 1.0, 1.15)
ON CONFLICT DO NOTHING;
