-- Actualizar la tabla fullments para relacionarla con tiendas y perfiles_envio
ALTER TABLE fullments DROP CONSTRAINT IF EXISTS unique_ciudad_fullment;

ALTER TABLE fullments ADD COLUMN IF NOT EXISTS tienda_id BIGINT REFERENCES tiendas(usrid) ON DELETE CASCADE;
ALTER TABLE fullments ADD COLUMN IF NOT EXISTS perfil_envio_id INTEGER REFERENCES perfiles_envio(id) ON DELETE SET NULL;
ALTER TABLE fullments ADD COLUMN IF NOT EXISTS estado VARCHAR(50) DEFAULT 'activo';

CREATE INDEX IF NOT EXISTS idx_fullments_tienda_id ON fullments(tienda_id);
CREATE INDEX IF NOT EXISTS idx_fullments_perfil_envio_id ON fullments(perfil_envio_id);
CREATE INDEX IF NOT EXISTS idx_fullments_ciudad_id ON fullments(ciudad_id);
