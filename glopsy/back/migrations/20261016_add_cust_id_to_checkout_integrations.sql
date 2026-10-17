-- ePayco: Customer ID (p_cust_id_cliente) para la firma del webhook de confirmación.
ALTER TABLE public.checkout_integrations ADD COLUMN IF NOT EXISTS cust_id text;
