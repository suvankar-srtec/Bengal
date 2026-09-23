-- Keep registration payment status aligned with a successful saved payment attempt.
UPDATE public.bbc_event_registrations AS r
SET payment_status = 'paid'
WHERE payment_status <> 'paid'
  AND EXISTS (
    SELECT 1
    FROM public.bbc_payment_attempts AS p
    WHERE p.registration_id = r.id
      AND p.status = 'succeeded'
  );
