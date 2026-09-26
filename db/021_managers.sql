CREATE TABLE IF NOT EXISTS public.bbc_managers (
  id UUID PRIMARY KEY,
  user_id VARCHAR(80) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  event_id INTEGER NOT NULL
    REFERENCES public.bbc_event_content(id)
    ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bbc_managers_event_idx
  ON public.bbc_managers (event_id);
