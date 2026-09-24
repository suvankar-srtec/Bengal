-- Normalize legacy registration constraints left by older deployments.
-- Constraint names may vary, so identify them by their definitions rather than
-- relying only on PostgreSQL's generated names.
DO $$
DECLARE
  constraint_row RECORD;
BEGIN
  FOR constraint_row IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.bbc_event_registrations'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) ILIKE '%total_paise%'
        OR pg_get_constraintdef(oid) ILIKE '%meal_choice%'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.bbc_event_registrations DROP CONSTRAINT IF EXISTS %I',
      constraint_row.conname
    );
  END LOOP;
END
$$;

ALTER TABLE public.bbc_event_registrations
  ADD CONSTRAINT bbc_event_registrations_meal_choice_check
  CHECK (meal_choice IS NULL OR meal_choice IN ('snacks', 'lunch', 'dinner'));

ALTER TABLE public.bbc_event_registrations
  ADD CONSTRAINT bbc_event_registrations_total_paise_check
  CHECK (
    total_paise = participation_quantity * participation_unit_paise
      + standee_quantity * standee_unit_paise
      + CASE
          WHEN meal_choice IS NOT NULL
            THEN participation_quantity * meal_unit_paise
          ELSE 0
        END
      + CASE
          WHEN presentation_selected
            THEN presentation_unit_paise
          ELSE 0
        END
  );

DO $$
DECLARE
  constraint_row RECORD;
BEGIN
  FOR constraint_row IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.bbc_meal_redemptions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%meal_choice%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.bbc_meal_redemptions DROP CONSTRAINT IF EXISTS %I',
      constraint_row.conname
    );
  END LOOP;
END
$$;

ALTER TABLE public.bbc_meal_redemptions
  ADD CONSTRAINT bbc_meal_redemptions_meal_choice_check
  CHECK (meal_choice IN ('snacks', 'lunch', 'dinner'));
