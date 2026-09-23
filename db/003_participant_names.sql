ALTER TABLE public.bbc_event_registrations
  ADD COLUMN IF NOT EXISTS participant_names TEXT[];

-- Older registrations only recorded the primary member's name. Preserve that
-- known name without inventing names for previously unrecorded participants.
UPDATE public.bbc_event_registrations
  SET participant_names = ARRAY[member_name]
  WHERE participant_names IS NULL;

ALTER TABLE public.bbc_event_registrations
  ALTER COLUMN participant_names SET NOT NULL;
