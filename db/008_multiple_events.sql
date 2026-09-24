-- Allow multiple editable event records and preserve creation timestamps.
ALTER TABLE public.bbc_event_content
  DROP CONSTRAINT IF EXISTS bbc_event_content_id_check;

ALTER TABLE public.bbc_event_content
  ALTER COLUMN id TYPE INTEGER;

CREATE SEQUENCE IF NOT EXISTS public.bbc_event_content_id_seq;

ALTER SEQUENCE public.bbc_event_content_id_seq
  OWNED BY public.bbc_event_content.id;

SELECT setval(
  'public.bbc_event_content_id_seq',
  GREATEST(COALESCE((SELECT MAX(id) FROM public.bbc_event_content), 0), 1),
  true
);

ALTER TABLE public.bbc_event_content
  ALTER COLUMN id SET DEFAULT nextval('public.bbc_event_content_id_seq');

ALTER TABLE public.bbc_event_content
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
