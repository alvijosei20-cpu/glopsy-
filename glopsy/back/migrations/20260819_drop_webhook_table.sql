-- La tabla webhook quedó sin uso: el webhook_secret vive ahora en checkout_integrations (cifrado)
DROP TABLE IF EXISTS webhook;

-- webhook_tienda_integraciones también sin uso y sin datos (equivalente para mastershop)
DROP TABLE IF EXISTS webhook_tienda_integraciones;
