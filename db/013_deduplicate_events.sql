-- Merge exact duplicate event records that were created by older deploy-time seeding.
-- Keep the oldest event id, move registrations to it, then remove duplicate rows.
WITH ranked AS (
  SELECT
    id,
    MIN(id) OVER (
      PARTITION BY
        section_label,
        title_bn,
        title_en,
        tagline_line_1,
        tagline_line_2,
        event_date,
        organizer,
        about_title,
        about_paragraph_1,
        about_paragraph_2,
        bengali_paragraph_1,
        bengali_paragraph_2
    ) AS keep_id
  FROM public.bbc_event_content
),
duplicates AS (
  SELECT id, keep_id
  FROM ranked
  WHERE id <> keep_id
)
UPDATE public.bbc_event_registrations AS registration
SET event_id = duplicates.keep_id::text
FROM duplicates
WHERE registration.event_id = duplicates.id::text;

WITH ranked AS (
  SELECT
    id,
    MIN(id) OVER (
      PARTITION BY
        section_label,
        title_bn,
        title_en,
        tagline_line_1,
        tagline_line_2,
        event_date,
        organizer,
        about_title,
        about_paragraph_1,
        about_paragraph_2,
        bengali_paragraph_1,
        bengali_paragraph_2
    ) AS keep_id
  FROM public.bbc_event_content
)
DELETE FROM public.bbc_event_content AS event
USING ranked
WHERE event.id = ranked.id
  AND ranked.id <> ranked.keep_id;
