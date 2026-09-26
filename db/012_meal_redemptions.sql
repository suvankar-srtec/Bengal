CREATE TABLE IF NOT EXISTS public.bbc_meal_redemptions (
  pass_id TEXT NOT NULL,
  registration_id UUID NOT NULL
    REFERENCES public.bbc_event_registrations(id)
    ON DELETE CASCADE,
  participant_number INTEGER NOT NULL CHECK (participant_number > 0),
  participant_name TEXT NOT NULL,
  meal_choice TEXT NOT NULL CHECK (meal_choice IN ('snacks', 'lunch', 'dinner')),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pass_id, meal_choice)
);

CREATE UNIQUE INDEX IF NOT EXISTS bbc_meal_redemptions_registration_participant_meal_uidx
  ON public.bbc_meal_redemptions (registration_id, participant_number, meal_choice);
