-- ============================================================
-- Ajuste de aranceles de Venezuela conforme a la normativa 2026:
--   - Régimen de bajo valor (courier/puerta a puerta): envíos con valor
--     declarado <= USD 100 por guía están EXENTOS de aranceles e IVA (uso
--     personal). Por eso el de_minimis de VE se fija en 100 USD.
--   - Tramo alto (101-1999 USD): paga tributos; las tasas por categoría se
--     alinean a datos públicos (ropa/calzado 35%, electrónica ~15%, etc.).
-- Idempotente: actualiza las filas existentes.
-- ============================================================

UPDATE tariff_countries SET de_minimis_usd = 100.00, updated_at = NOW() WHERE pais_iso = 'VE';

-- Arancel default del tramo alto (respaldo si no hay categoría).
UPDATE tariff_rules SET arancel_pct = 30.00, updated_at = NOW()
WHERE pais_iso = 'VE' AND scope = 'default';

-- Tasas por categoría alineadas a la banda real de VE.
UPDATE tariff_rules r
SET arancel_pct = v.arancel, updated_at = NOW()
FROM (VALUES
  ('Tecnología', 15.0), ('Celulares y Telefonía', 15.0), ('Computación', 15.0),
  ('Videojuegos y Consolas', 20.0), ('Electrodomésticos', 20.0),
  ('Hogar y Cocina', 20.0), ('Muebles y Decoración', 20.0),
  ('Herramientas y Construcción', 15.0), ('Moda y Calzado', 35.0),
  ('Belleza y Cuidado Personal', 20.0), ('Deportes', 20.0),
  ('Juguetes y Bebés', 20.0), ('Mascotas', 15.0),
  ('Salud y Equipamiento Médico', 15.0), ('Industria y Oficina', 15.0),
  ('Vehículos y Accesorios', 15.0), ('Supermercado y Alimentos', 20.0),
  ('Libros, Música y Películas', 5.0), ('Instrumentos Musicales', 15.0),
  ('Arte y Manualidades', 20.0), ('Jardín y Aire Libre', 20.0),
  ('Fiestas y Eventos', 20.0), ('Otros', 20.0)
) AS v(categoria, arancel)
JOIN categorias c ON c.nombre = v.categoria AND c.tienda_id IS NULL
WHERE r.pais_iso = 'VE' AND r.scope = 'categoria' AND r.scope_id = c.id;
