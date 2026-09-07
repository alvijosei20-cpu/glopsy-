-- Autorización de vendedores decidida por el administrador (monitor local).
-- El usuario nace como comprador (can_sell=false); solo quien el admin autorice
-- puede crear/activar una tienda y ve la opción "Vender".
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_sell boolean NOT NULL DEFAULT false;
