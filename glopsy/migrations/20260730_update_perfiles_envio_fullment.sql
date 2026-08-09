-- Actualizar perfiles_envio para reemplazar ciudad_id por fullment_id (relacionado con fullments)
ALTER TABLE perfiles_envio DROP CONSTRAINT IF EXISTS perfiles_envio_ciudad_id_fkey;
ALTER TABLE perfiles_envio DROP COLUMN IF EXISTS ciudad_id;

ALTER TABLE perfiles_envio ADD COLUMN IF NOT EXISTS fullment_id INTEGER REFERENCES fullments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_perfiles_envio_fullment_id ON perfiles_envio(fullment_id);
