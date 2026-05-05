CREATE POLICY "cashiers read operational orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.has_role(ARRAY['cashier']));

CREATE POLICY "cashiers read payment queue records"
ON public.payments
FOR SELECT
TO authenticated
USING (public.has_role(ARRAY['cashier']));
