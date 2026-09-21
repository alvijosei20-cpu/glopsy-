-- Datos de contacto de la tienda (correo y teléfono), sensibles al país de operación.
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS contacto_email VARCHAR(160);
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS contacto_telefono VARCHAR(30);
