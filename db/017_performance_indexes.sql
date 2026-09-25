CREATE INDEX IF NOT EXISTS bbc_event_registrations_event_id_created_at_idx
  ON public.bbc_event_registrations (event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS bbc_event_registrations_payment_status_idx
  ON public.bbc_event_registrations (payment_status);

CREATE INDEX IF NOT EXISTS bbc_event_content_created_at_idx
  ON public.bbc_event_content (created_at DESC, id DESC);
