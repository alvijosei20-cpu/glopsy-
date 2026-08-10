-- Agregar perfil_envio_id a la tabla produc para asociar un perfil de envío individual a cada producto
ALTER TABLE produc ADD COLUMN IF NOT EXISTS perfil_envio_id INTEGER REFERENCES perfiles_envio(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_produc_perfil_envio_id ON produc(perfil_envio_id);
