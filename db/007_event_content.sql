CREATE TABLE IF NOT EXISTS public.bbc_event_content (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  section_label VARCHAR(100) NOT NULL,
  title_bn VARCHAR(160) NOT NULL,
  title_en VARCHAR(160) NOT NULL,
  tagline_line_1 VARCHAR(180) NOT NULL,
  tagline_line_2 VARCHAR(180) NOT NULL,
  event_date DATE NOT NULL,
  organizer VARCHAR(160) NOT NULL,
  about_title VARCHAR(220) NOT NULL,
  about_paragraph_1 TEXT NOT NULL,
  about_paragraph_2 TEXT NOT NULL,
  bengali_paragraph_1 TEXT NOT NULL,
  bengali_paragraph_2 TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Important:
-- This migration intentionally does not insert a default event.
-- The migration runner executes SQL files on every deployment, so inserting
-- seed data here would recreate an event after an administrator deletes it.
-- Events must only be created through the application.
