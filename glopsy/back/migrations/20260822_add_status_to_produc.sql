-- Agregar estado al producto para pausar/eliminar sin borrar físicamente
ALTER TABLE produc ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_produc_status ON produc(status);
