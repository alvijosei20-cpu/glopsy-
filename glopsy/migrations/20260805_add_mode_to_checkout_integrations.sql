-- Agregar columna mode a checkout_integrations para distinguir entre prueba y produccion
ALTER TABLE checkout_integrations ADD COLUMN IF NOT EXISTS mode VARCHAR(20) NOT NULL DEFAULT 'prueba';

-- Actualizar registros existentes a 'prueba'
UPDATE checkout_integrations SET mode = 'prueba' WHERE mode IS NULL;

-- Eliminar restricciones anteriores y crear la nueva única por (tienda_id, provider, mode)
ALTER TABLE checkout_integrations DROP CONSTRAINT IF EXISTS unique_tienda_checkout_provider;
ALTER TABLE checkout_integrations DROP CONSTRAINT IF EXISTS unique_tienda_checkout_provider_mode;
ALTER TABLE checkout_integrations ADD CONSTRAINT unique_tienda_checkout_provider_mode UNIQUE (tienda_id, provider, mode);

-- Recrear vista de compatibilidad chackout_inte
DROP VIEW IF EXISTS chackout_inte;
CREATE VIEW chackout_inte AS 
SELECT id, tienda_id, provider, mode, public_key, access_token, created_at, updated_at 
FROM checkout_integrations;
