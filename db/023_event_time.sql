ALTER TABLE public.bbc_event_content
  ADD COLUMN IF NOT EXISTS event_time TIME NOT NULL DEFAULT TIME '18:00';

ALTER TABLE public.bbc_event_content
  ADD COLUMN IF NOT EXISTS event_end_time TIME NOT NULL DEFAULT TIME '20:00';
