ALTER TABLE public.bbc_event_registrations
  ADD COLUMN IF NOT EXISTS lunch_dinner_selected BOOLEAN NOT NULL DEFAULT FALSE;
