ALTER TABLE public.bbc_whatsapp_pass_deliveries
  ADD COLUMN IF NOT EXISTS event_resend_at TIMESTAMPTZ;
