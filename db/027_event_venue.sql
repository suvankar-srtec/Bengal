ALTER TABLE public.bbc_event_content
  ADD COLUMN IF NOT EXISTS venue VARCHAR(220) NOT NULL DEFAULT 'Venue to be announced';
