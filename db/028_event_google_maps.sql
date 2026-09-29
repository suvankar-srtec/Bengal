ALTER TABLE public.bbc_event_content
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT NOT NULL DEFAULT '';
