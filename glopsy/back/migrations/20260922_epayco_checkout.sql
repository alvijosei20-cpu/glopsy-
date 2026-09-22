-- ePayco reemplaza a Bold como pasarela de pago colombiana.
-- Se eliminan las credenciales de Bold; ePayco se configura desde el panel
-- (proveedor 'epayco') sin necesidad de migración de esquema.
DELETE FROM checkout_integrations WHERE provider = 'bold';
