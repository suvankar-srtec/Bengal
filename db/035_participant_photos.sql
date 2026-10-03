CREATE TABLE IF NOT EXISTS public.bbc_participant_photos (
  id UUID PRIMARY KEY,
  registration_id UUID NOT NULL REFERENCES public.bbc_event_registrations(id) ON DELETE CASCADE,
  participant_number INTEGER NOT NULL CHECK (participant_number BETWEEN 1 AND 20),
  token_nonce CHAR(64) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  photo_data BYTEA,
  photo_mime TEXT,
  photo_uploaded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending','sending','accepted','failed','unknown')),
  whatsapp_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (whatsapp_status IN ('pending','sending','accepted','failed','unknown')),
  email_error TEXT,
  whatsapp_error TEXT,
  email_message_id TEXT,
  whatsapp_message_id TEXT,
  UNIQUE (registration_id, participant_number),
  CHECK (photo_mime IS NULL OR photo_mime = 'image/jpeg'),
  CHECK (photo_data IS NULL OR octet_length(photo_data) <= 1048576)
);

CREATE INDEX IF NOT EXISTS bbc_participant_photos_registration_idx
  ON public.bbc_participant_photos (registration_id, participant_number);

CREATE INDEX IF NOT EXISTS bbc_participant_photos_token_idx
  ON public.bbc_participant_photos (token_hash);

CREATE INDEX IF NOT EXISTS bbc_participant_photos_expiry_idx
  ON public.bbc_participant_photos (expires_at);
