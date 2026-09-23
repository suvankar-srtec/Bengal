-- Convert existing registrations to one E.164 phone column, e.g. +917980729034.
ALTER TABLE public.bbc_event_registrations
  DROP CONSTRAINT IF EXISTS bbc_event_registrations_phone_check;

ALTER TABLE public.bbc_event_registrations
  ALTER COLUMN phone TYPE VARCHAR(16);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bbc_event_registrations'
      AND column_name = 'phone_country_code'
  ) THEN
    UPDATE public.bbc_event_registrations
    SET phone = CASE
      WHEN phone LIKE '+%' THEN phone
      ELSE COALESCE(NULLIF(phone_country_code, ''), '+91') || phone
    END;

    ALTER TABLE public.bbc_event_registrations
      DROP COLUMN phone_country_code;
  ELSE
    UPDATE public.bbc_event_registrations
    SET phone = '+91' || phone
    WHERE phone !~ '^\\+';
  END IF;
END
$$;

ALTER TABLE public.bbc_event_registrations
  DROP CONSTRAINT IF EXISTS bbc_event_registrations_phone_check;

ALTER TABLE public.bbc_event_registrations
  ADD CONSTRAINT bbc_event_registrations_phone_check
  CHECK (phone ~ '^\\+[1-9][0-9]{7,14}$');
