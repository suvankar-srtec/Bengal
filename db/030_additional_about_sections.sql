ALTER TABLE public.bbc_event_content
  ADD COLUMN IF NOT EXISTS additional_about_sections JSONB NOT NULL DEFAULT '[]'::jsonb;
