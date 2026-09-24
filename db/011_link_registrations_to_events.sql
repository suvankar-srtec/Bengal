UPDATE public.bbc_event_registrations AS registration
SET event_id = (
  SELECT content.id::text
  FROM public.bbc_event_content AS content
  WHERE lower(content.title_en) = lower(registration.event_name)
    AND content.event_date = registration.event_date
  ORDER BY content.created_at DESC, content.id DESC
  LIMIT 1
)
WHERE registration.event_id !~ '^[0-9]+$'
  AND EXISTS (
    SELECT 1
    FROM public.bbc_event_content AS content
    WHERE lower(content.title_en) = lower(registration.event_name)
      AND content.event_date = registration.event_date
  );
