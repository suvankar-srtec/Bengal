CREATE TABLE IF NOT EXISTS public.bbc_whatsapp_pass_deliveries (
  registration_id UUID PRIMARY KEY REFERENCES public.bbc_event_registrations(id) ON DELETE CASCADE,
  media_token CHAR(64) NOT NULL UNIQUE,
  media_expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'accepted', 'failed', 'unknown')),
  attempts INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  error_code TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);
