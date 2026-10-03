ALTER TABLE public.bbc_event_registrations
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_approved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.bbc_contact_verifications (
  id UUID PRIMARY KEY,
  session_hash CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'phone')),
  destination TEXT NOT NULL,
  code_hash CHAR(64) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'unknown')),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  verified_at TIMESTAMPTZ,
  consumed_submission_id UUID
);
CREATE INDEX IF NOT EXISTS bbc_contact_verifications_created_idx ON public.bbc_contact_verifications(created_at);
CREATE INDEX IF NOT EXISTS bbc_contact_verifications_destination_idx ON public.bbc_contact_verifications(channel,destination,created_at);
CREATE INDEX IF NOT EXISTS bbc_contact_verifications_session_idx ON public.bbc_contact_verifications(session_hash,created_at);
CREATE INDEX IF NOT EXISTS bbc_contact_verifications_ip_idx ON public.bbc_contact_verifications(ip_hash,created_at);

CREATE TABLE IF NOT EXISTS public.bbc_registration_payment_reviews (
  id UUID PRIMARY KEY,
  registration_id UUID NOT NULL REFERENCES public.bbc_event_registrations(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('cash','bank')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
  receipt_data BYTEA,
  receipt_mime TEXT,
  receipt_name TEXT,
  receipt_hash CHAR(64),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  CHECK ((method = 'cash' AND receipt_data IS NULL) OR (method = 'bank' AND receipt_data IS NOT NULL)),
  CHECK (receipt_data IS NULL OR octet_length(receipt_data) <= 5242880)
);
CREATE UNIQUE INDEX IF NOT EXISTS bbc_payment_review_active_idx ON public.bbc_registration_payment_reviews(registration_id) WHERE status IN ('pending','approved');
CREATE INDEX IF NOT EXISTS bbc_payment_review_created_idx ON public.bbc_registration_payment_reviews(created_at DESC);

CREATE TABLE IF NOT EXISTS public.bbc_email_pass_deliveries (
  registration_id UUID PRIMARY KEY REFERENCES public.bbc_event_registrations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','accepted','failed','unknown')),
  attempts INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  error_code TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);
