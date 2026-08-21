-- Agregar columna public_id (hash seguro) a la tabla produc para ocultar el ID numérico secuencial en la URL
ALTER TABLE produc ADD COLUMN IF NOT EXISTS public_id VARCHAR(64) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_produc_public_id ON produc(public_id);

-- Generar un hash MD5/aleatorio para los productos que aún no tengan public_id
UPDATE produc 
SET public_id = md5(random()::text || id::text || clock_timestamp()::text)
WHERE public_id IS NULL;
