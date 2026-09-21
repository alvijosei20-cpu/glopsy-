-- Tipo de proveedor de la tienda y su condición frente al IVA.
-- Persona natural: el vendedor declara si es responsable de IVA.
-- Persona jurídica: se asume responsable de IVA.
ALTER TABLE tiendas
  ADD COLUMN IF NOT EXISTS tipo_proveedor VARCHAR(20);
ALTER TABLE tiendas
  ADD COLUMN IF NOT EXISTS responsable_iva BOOLEAN;
