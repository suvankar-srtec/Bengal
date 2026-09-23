-- Convert existing registrations to one E.164 phone column, e.g. +917980729034.
-- Existing rows are normalized best-effort. The final constraint is NOT VALID so
-- legacy data cannot block deployment, while all new/updated rows must be valid.

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
      WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^91[6-9][0-9]{9}$'
        THEN '+' || regexp_replace(phone, '[^0-9]', '', 'g')
      WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[6-9][0-9]{9}$'
        THEN '+91' || regexp_replace(phone, '[^0-9]', '', 'g')
      ELSE '+' ||
        regexp_replace(COALESCE(NULLIF(phone_country_code, ''), '+91'), '[^0-9]', '', 'g') ||
        regexp_replace(phone, '[^0-9]', '', 'g')
    END;

    ALTER TABLE public.bbc_event_registrations
      DROP COLUMN phone_country_code;
  ELSE
    UPDATE public.bbc_event_registrations
    SET phone = CASE
      WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^91[6-9][0-9]{9}$'
        THEN '+' || regexp_replace(phone, '[^0-9]', '', 'g')
      WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[6-9][0-9]{9}$'
        THEN '+91' || regexp_replace(phone, '[^0-9]', '', 'g')
      ELSE phone
    END;
  END IF;
END
$$;

ALTER TABLE public.bbc_event_registrations
  DROP CONSTRAINT IF EXISTS bbc_event_registrations_phone_check;

ALTER TABLE public.bbc_event_registrations
  ADD CONSTRAINT bbc_event_registrations_phone_check
  CHECK (phone ~ '^[+][1-9][0-9]{7,14}$')
  NOT VALID;
