ALTER TABLE public.bbc_event_registrations
  ADD COLUMN IF NOT EXISTS admin_import_key CHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS bbc_event_registrations_admin_import_key_uidx
  ON public.bbc_event_registrations (admin_import_key)
  WHERE admin_import_key IS NOT NULL;

ALTER TABLE public.bbc_whatsapp_pass_deliveries
  DROP CONSTRAINT IF EXISTS bbc_whatsapp_pass_deliveries_status_check;

ALTER TABLE public.bbc_whatsapp_pass_deliveries
  ADD CONSTRAINT bbc_whatsapp_pass_deliveries_status_check
  CHECK (status IN ('pending', 'sending', 'accepted', 'failed', 'unknown', 'manual'));
