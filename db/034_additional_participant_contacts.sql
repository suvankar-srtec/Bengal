-- Contacts align with participant_names starting at the second participant.
-- Existing registrations and name-only imports retain an empty contact list.
ALTER TABLE public.bbc_event_registrations
  ADD COLUMN IF NOT EXISTS additional_participant_contacts JSONB NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(additional_participant_contacts) = 'array');
