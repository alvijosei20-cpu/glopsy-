-- ============================================================
-- Pasarela predeterminada del checkout + solicitud de tienda en USD.
--
-- MP y Bold son para tiendas colombianas (COP). Un proveedor que
-- quiera vender al exterior solicita la activación de su tienda en USD.
-- ============================================================

ALTER TABLE checkout_integrations
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Solo una pasarela predeterminada por tienda (la principal de la plataforma).
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkout_default_per_tienda
  ON checkout_integrations(tienda_id) WHERE is_default;

ALTER TABLE tiendas
  ADD COLUMN IF NOT EXISTS usd_activation_status VARCHAR(20) NOT NULL DEFAULT 'none';
ALTER TABLE tiendas
  ADD COLUMN IF NOT EXISTS usd_activation_requested_at TIMESTAMPTZ;
ALTER TABLE tiendas
  ADD COLUMN IF NOT EXISTS usd_activation_note TEXT;
