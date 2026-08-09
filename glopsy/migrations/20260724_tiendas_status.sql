-- La relación por usuario ya cuenta con un índice único (tiendas.usrid),
-- por lo que no se requiere un índice adicional para la consulta del panel.
ALTER TABLE tiendas
  ADD COLUMN IF NOT EXISTS activa boolean NOT NULL DEFAULT true;
