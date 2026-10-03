ALTER TABLE public.bbc_contact_verifications
  ADD COLUMN IF NOT EXISTS registration_id UUID REFERENCES public.bbc_event_registrations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS actor_id TEXT,
  ADD COLUMN IF NOT EXISTS previous_destination TEXT,
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS bbc_contact_verifications_actor_idx ON public.bbc_contact_verifications(actor_id,created_at);
