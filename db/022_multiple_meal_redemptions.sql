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
  DROP CONSTRAINT IF EXISTS bbc_meal_redemptions_pkey;

DROP INDEX IF EXISTS public.bbc_meal_redemptions_registration_participant_uidx;

ALTER TABLE public.bbc_meal_redemptions
  ADD CONSTRAINT bbc_meal_redemptions_meal_choice_check
  CHECK (meal_choice IN ('snacks', 'lunch', 'dinner'));

ALTER TABLE public.bbc_meal_redemptions
  ADD CONSTRAINT bbc_meal_redemptions_pkey
  PRIMARY KEY (pass_id, meal_choice);

CREATE UNIQUE INDEX IF NOT EXISTS bbc_meal_redemptions_registration_participant_meal_uidx
  ON public.bbc_meal_redemptions (registration_id, participant_number, meal_choice);
