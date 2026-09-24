ALTER TABLE public.bbc_event_registrations
  ADD COLUMN IF NOT EXISTS meal_choice TEXT;

ALTER TABLE public.bbc_event_registrations
  DROP CONSTRAINT IF EXISTS bbc_event_registrations_meal_choice_check;

ALTER TABLE public.bbc_event_registrations
  ADD CONSTRAINT bbc_event_registrations_meal_choice_check
  CHECK (meal_choice IS NULL OR meal_choice IN ('lunch', 'dinner'));
