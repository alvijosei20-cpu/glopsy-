-- Google Analytics por tienda: cada tienda reporta a SU propiedad GA4 (no global).
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS ga_id VARCHAR(40);
