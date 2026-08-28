-- Índices para acelerar el catálogo (searchQueryProducts) y sus subconsultas correlacionadas

-- Filtrado por estado + categoría (catálogo y contador de resultados)
CREATE INDEX IF NOT EXISTS idx_produc_status_categoria ON produc(status, categoria_id);

-- Gestión de productos por tienda
CREATE INDEX IF NOT EXISTS idx_produc_status_tienda ON produc(status, tienda_id);

-- Orden por más recientes
CREATE INDEX IF NOT EXISTS idx_produc_status_created ON produc(status, created_at DESC);

-- Subconsultas de reseñas (review_count / avg_rating / min_rating)
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);

-- Subconsultas de ofertas activas (catálogo y detalle)
CREATE INDEX IF NOT EXISTS idx_ofertas_tienda_estado ON ofertas(tienda_id, estado);
CREATE INDEX IF NOT EXISTS idx_oferta_productos_oferta ON oferta_productos(oferta_id, producto_id);

-- Envío gratis / perfiles de envío (freeShippingExpr y freeShippingCostoExpr)
CREATE INDEX IF NOT EXISTS idx_perfiles_envio_tienda ON perfiles_envio(tienda_id, tipo_envio, estado);
CREATE INDEX IF NOT EXISTS idx_perfiles_envio_ciudad ON perfiles_envio(ciudad_id);

-- Búsqueda por texto con pg_trgm (ILIKE '%...%'). Se omite si el rol no tiene permisos.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS idx_produc_name_trgm ON produc USING gin (name gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_produc_description_trgm ON produc USING gin (description gin_trgm_ops);
EXCEPTION WHEN insufficient_privilege OR undefined_file THEN
  RAISE NOTICE 'pg_trgm no disponible; se omiten los índices trigram del catálogo.';
END $$;
