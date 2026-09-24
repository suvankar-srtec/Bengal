ALTER TABLE public.bbc_event_content
  ADD COLUMN IF NOT EXISTS meal_option TEXT NOT NULL DEFAULT 'lunch',
  ADD COLUMN IF NOT EXISTS snacks_unit_paise INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lunch_unit_paise INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dinner_unit_paise INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.bbc_event_content
  DROP CONSTRAINT IF EXISTS bbc_event_content_meal_option_check,
  DROP CONSTRAINT IF EXISTS bbc_event_content_snacks_price_check,
  DROP CONSTRAINT IF EXISTS bbc_event_content_lunch_price_check,
  DROP CONSTRAINT IF EXISTS bbc_event_content_dinner_price_check;

ALTER TABLE public.bbc_event_content
  ADD CONSTRAINT bbc_event_content_meal_option_check
    CHECK (meal_option IN ('snacks', 'lunch', 'dinner')),
  ADD CONSTRAINT bbc_event_content_snacks_price_check
    CHECK (snacks_unit_paise >= 0),
  ADD CONSTRAINT bbc_event_content_lunch_price_check
    CHECK (lunch_unit_paise >= 0),
  ADD CONSTRAINT bbc_event_content_dinner_price_check
    CHECK (dinner_unit_paise >= 0);

ALTER TABLE public.bbc_event_registrations
  ADD COLUMN IF NOT EXISTS meal_unit_paise INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.bbc_event_registrations
  DROP CONSTRAINT IF EXISTS bbc_event_registrations_meal_choice_check;

ALTER TABLE public.bbc_event_registrations
  ADD CONSTRAINT bbc_event_registrations_meal_choice_check
    CHECK (meal_choice IS NULL OR meal_choice IN ('snacks', 'lunch', 'dinner'));

ALTER TABLE public.bbc_meal_redemptions
  DROP CONSTRAINT IF EXISTS bbc_meal_redemptions_meal_choice_check;

ALTER TABLE public.bbc_meal_redemptions
  ADD CONSTRAINT bbc_meal_redemptions_meal_choice_check
    CHECK (meal_choice IN ('snacks', 'lunch', 'dinner'));


ALTER TABLE public.bbc_event_registrations
  DROP CONSTRAINT IF EXISTS bbc_event_registrations_total_paise_check;

ALTER TABLE public.bbc_event_registrations
  ADD CONSTRAINT bbc_event_registrations_total_paise_check
  CHECK (
    total_paise = participation_quantity * participation_unit_paise
      + standee_quantity * standee_unit_paise
      + CASE WHEN meal_choice IS NOT NULL THEN participation_quantity * meal_unit_paise ELSE 0 END
      + CASE WHEN presentation_selected THEN presentation_unit_paise ELSE 0 END
  );
