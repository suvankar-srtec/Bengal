ALTER TABLE public.bbc_event_content
  ADD COLUMN IF NOT EXISTS included_meals TEXT[] NOT NULL DEFAULT ARRAY['lunch']::TEXT[];

UPDATE public.bbc_event_content
SET included_meals = ARRAY[meal_option]::TEXT[]
WHERE included_meals IS NULL
   OR cardinality(included_meals) = 0;

ALTER TABLE public.bbc_event_registrations
  ADD COLUMN IF NOT EXISTS included_meals TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE public.bbc_event_registrations r
SET included_meals = COALESCE(e.included_meals, ARRAY[]::TEXT[])
FROM public.bbc_event_content e
WHERE r.event_id = e.id::TEXT
  AND cardinality(r.included_meals) = 0;

UPDATE public.bbc_event_registrations
SET included_meals = ARRAY[meal_choice]::TEXT[]
WHERE cardinality(included_meals) = 0
  AND meal_choice IS NOT NULL;

DO $$
DECLARE
  constraint_row RECORD;
BEGIN
  FOR constraint_row IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.bbc_event_registrations'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%total_paise%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.bbc_event_registrations DROP CONSTRAINT IF EXISTS %I',
      constraint_row.conname
    );
  END LOOP;
END
$$;

ALTER TABLE public.bbc_event_registrations
  ADD CONSTRAINT bbc_event_registrations_total_paise_check
  CHECK (
    total_paise = participation_quantity * participation_unit_paise
      + standee_quantity * standee_unit_paise
      + CASE
          WHEN presentation_selected
            THEN presentation_unit_paise
          ELSE 0
        END
  );
