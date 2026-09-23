-- Convert existing registrations to one E.164 phone column, e.g. +917980729034.
ALTER TABLE public.bbc_event_registrations
  DROP CONSTRAINT IF EXISTS bbc_event_registrations_phone_check;

ALTER TABLE public.bbc_event_registrations
  ALTER COLUMN phone TYPE VARCHAR(16);

UPDATE public.bbc_event_registrations
SET phone = CASE
  WHEN phone LIKE '+%' THEN phone
  ELSE COALESCE(NULLIF(phone_country_code, ''), '+91') || phone
END;

ALTER TABLE public.bbc_event_registrations
  ADD CONSTRAINT bbc_event_registrations_phone_check
  CHECK (phone ~ '^\+[1-9][0-9]{7,14}$');

ALTER TABLE public.bbc_event_registrations
  DROP COLUMN IF EXISTS phone_country_code;
