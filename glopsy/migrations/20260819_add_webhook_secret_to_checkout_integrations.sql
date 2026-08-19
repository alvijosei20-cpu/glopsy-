-- Agregar webhook_secret a checkout_integrations para mantener todas las credenciales de pasarela en la misma tabla
ALTER TABLE checkout_integrations ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- Recrear vista de compatibilidad chackout_inte
DROP VIEW IF EXISTS chackout_inte;
CREATE VIEW chackout_inte AS 
SELECT id, tienda_id, provider, mode, public_key, access_token, webhook_secret, created_at, updated_at 
FROM checkout_integrations;
