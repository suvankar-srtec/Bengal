ALTER TABLE public.bbc_event_content
  ADD COLUMN IF NOT EXISTS participation_unit_paise INTEGER NOT NULL DEFAULT 118000,
  ADD COLUMN IF NOT EXISTS standee_unit_paise INTEGER NOT NULL DEFAULT 295000,
  ADD COLUMN IF NOT EXISTS presentation_unit_paise INTEGER NOT NULL DEFAULT 3540000;

ALTER TABLE public.bbc_event_content
  DROP CONSTRAINT IF EXISTS bbc_event_content_participation_price_check,
  DROP CONSTRAINT IF EXISTS bbc_event_content_standee_price_check,
  DROP CONSTRAINT IF EXISTS bbc_event_content_presentation_price_check;

ALTER TABLE public.bbc_event_content
  ADD CONSTRAINT bbc_event_content_participation_price_check
    CHECK (participation_unit_paise >= 0),
  ADD CONSTRAINT bbc_event_content_standee_price_check
    CHECK (standee_unit_paise >= 0),
  ADD CONSTRAINT bbc_event_content_presentation_price_check
    CHECK (presentation_unit_paise >= 0);
