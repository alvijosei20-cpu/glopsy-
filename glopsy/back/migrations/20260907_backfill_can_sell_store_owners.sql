-- Los dueños de tiendas existentes (incluida la principal) conservan la autorización
-- para vender; solo los usuarios nuevos nacen como compradores (can_sell=false).
UPDATE public.users SET can_sell = true
WHERE can_sell = false
  AND EXISTS (SELECT 1 FROM public.tiendas t WHERE t.usrid = public.users.id);
