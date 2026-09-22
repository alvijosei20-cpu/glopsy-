-- ============================================================
-- Catálogo de categorías de la plataforma + comisiones por categoría.
--
-- Modelo inspirado en Mercado Libre: comisión (%) por categoría sobre el
-- precio de venta, con una regla global de respaldo. Rango base 13.5%-16.5%
-- (ML Colombia cobra entre 8% y 19% según categoría).
--
-- Las reglas son GLOBALES (tienda_id NULL) para toda la plataforma y se
-- pueden ajustar luego desde el panel admin. Idempotente.
-- ============================================================

-- 1) Categorías globales de la plataforma (tienda_id NULL).
INSERT INTO categorias (nombre, descripcion)
SELECT v.nombre, v.descripcion
FROM (VALUES
  ('Tecnología',                  'Gadgets, electrónicos y accesorios'),
  ('Celulares y Telefonía',       'Celulares, accesorios y telefonía'),
  ('Computación',                 'Portátiles, PCs, componentes y periféricos'),
  ('Videojuegos y Consolas',      'Consolas, juegos y accesorios gamer'),
  ('Electrodomésticos',           'Línea blanca y pequeños electrodomésticos'),
  ('Hogar y Cocina',              'Artículos para el hogar y cocina'),
  ('Muebles y Decoración',        'Muebles, decoración e iluminación'),
  ('Herramientas y Construcción', 'Herramientas, ferretería y construcción'),
  ('Moda y Calzado',              'Ropa, zapatos y accesorios'),
  ('Belleza y Cuidado Personal',  'Cosméticos y cuidado personal'),
  ('Deportes',                    'Equipamiento y ropa deportiva'),
  ('Juguetes y Bebés',            'Juguetes, bebés y maternidad'),
  ('Mascotas',                    'Alimento, accesorios y cuidado de mascotas'),
  ('Salud y Equipamiento Médico', 'Salud, ortopedia y equipos médicos'),
  ('Industria y Oficina',         'Insumos, papelería y equipos de oficina'),
  ('Vehículos y Accesorios',      'Repuestos, accesorios y vehículos'),
  ('Supermercado y Alimentos',    'Alimentos, bebidas y abarrotes'),
  ('Libros, Música y Películas',  'Libros, música, películas y coleccionables'),
  ('Instrumentos Musicales',      'Instrumentos y equipo de audio'),
  ('Arte y Manualidades',         'Arte, manualidades y materiales'),
  ('Jardín y Aire Libre',         'Jardinería, camping y aire libre'),
  ('Fiestas y Eventos',           'Fiesta, eventos y decoración'),
  ('Otros',                       'Varios y otros productos')
) AS v(nombre, descripcion)
WHERE NOT EXISTS (
  SELECT 1 FROM categorias c WHERE c.nombre = v.nombre AND c.tienda_id IS NULL
);

-- 2) Reglas de comisión por categoría (globales, tienda_id NULL).
INSERT INTO commission_rules (scope, scope_id, tienda_id, porcentaje)
SELECT 'categoria', c.id, NULL, v.porcentaje
FROM (VALUES
  ('Tecnología',                  13.5),
  ('Celulares y Telefonía',       13.5),
  ('Computación',                 13.5),
  ('Videojuegos y Consolas',      13.5),
  ('Electrodomésticos',           13.5),
  ('Hogar y Cocina',              15.0),
  ('Muebles y Decoración',        15.0),
  ('Herramientas y Construcción', 15.0),
  ('Moda y Calzado',              16.5),
  ('Belleza y Cuidado Personal',  16.5),
  ('Deportes',                    15.0),
  ('Juguetes y Bebés',            16.5),
  ('Mascotas',                    15.0),
  ('Salud y Equipamiento Médico', 15.0),
  ('Industria y Oficina',         15.0),
  ('Vehículos y Accesorios',      13.5),
  ('Supermercado y Alimentos',    13.5),
  ('Libros, Música y Películas',  13.5),
  ('Instrumentos Musicales',      15.0),
  ('Arte y Manualidades',         16.5),
  ('Jardín y Aire Libre',         15.0),
  ('Fiestas y Eventos',           16.5),
  ('Otros',                       15.0)
) AS v(nombre, porcentaje)
JOIN categorias c ON c.nombre = v.nombre AND c.tienda_id IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM commission_rules r
  WHERE r.scope = 'categoria' AND r.scope_id = c.id AND r.tienda_id IS NULL
);

-- 3) Regla global de respaldo (si un producto no cae en ninguna categoría).
INSERT INTO commission_rules (scope, scope_id, tienda_id, porcentaje)
SELECT 'global', NULL, NULL, 15.0
WHERE NOT EXISTS (
  SELECT 1 FROM commission_rules
  WHERE scope = 'global' AND scope_id IS NULL AND tienda_id IS NULL
);
