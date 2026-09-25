CREATE TABLE IF NOT EXISTS public.bbc_members (
  id UUID PRIMARY KEY,
  primary_name VARCHAR(120) NOT NULL,
  participant_names TEXT[] NOT NULL DEFAULT '{}',
  email VARCHAR(254) NOT NULL UNIQUE,
  phone VARCHAR(16) NOT NULL,
  billing_details VARCHAR(15) NOT NULL,
  photo_data_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bbc_members_updated_at_idx
  ON public.bbc_members (updated_at DESC);
