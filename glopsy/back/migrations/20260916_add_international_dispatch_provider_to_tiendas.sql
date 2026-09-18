-- Tiendas de Venezuela pueden despachar envíos internacionales con MasterShop.
-- El valor indica el proveedor de despacho internacional; NULL = deshabilitado.
-- Requiere tener configurada la API key de MasterShop en tienda_integraciones.
ALTER TABLE tiendas
  ADD COLUMN IF NOT EXISTS international_dispatch_provider VARCHAR(30);
