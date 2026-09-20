-- ============================================================
-- Apariencia de la vitrina (sub-tiendas): plantilla, tema y paleta.
-- La tienda principal (app.glopsy.shop) no usa estos valores.
-- ============================================================

ALTER TABLE tiendas
  ADD COLUMN IF NOT EXISTS storefront_template VARCHAR(20) NOT NULL DEFAULT 'dashboard';
ALTER TABLE tiendas
  ADD COLUMN IF NOT EXISTS storefront_theme VARCHAR(10) NOT NULL DEFAULT 'auto';
ALTER TABLE tiendas
  ADD COLUMN IF NOT EXISTS storefront_palette VARCHAR(30) NOT NULL DEFAULT 'fucsia';
ALTER TABLE tiendas
  ADD COLUMN IF NOT EXISTS storefront_color VARCHAR(9);
ALTER TABLE tiendas
  ADD COLUMN IF NOT EXISTS storefront_banner VARCHAR(500);
