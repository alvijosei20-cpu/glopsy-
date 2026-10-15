-- Permite dejar en 0 la cantidad de ítems cancelados (antes CHECK quantity > 0
-- rompía la cancelación de pedidos). Los ítems cancelados se conservan con
-- quantity=0 y line_total=0 para preservar el historial.
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_quantity_check;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_quantity_check CHECK (quantity >= 0);
