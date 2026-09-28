ALTER TABLE public.bbc_event_registrations
  ADD COLUMN IF NOT EXISTS amount_paid_paise INTEGER;

UPDATE public.bbc_event_registrations
SET amount_paid_paise = total_paise
WHERE payment_status = 'paid'
  AND amount_paid_paise IS NULL;

ALTER TABLE public.bbc_event_registrations
  DROP CONSTRAINT IF EXISTS bbc_event_registrations_amount_paid_paise_check;

ALTER TABLE public.bbc_event_registrations
  ADD CONSTRAINT bbc_event_registrations_amount_paid_paise_check
  CHECK (amount_paid_paise IS NULL OR amount_paid_paise >= 0);
