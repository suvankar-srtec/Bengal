UPDATE public.bbc_event_registrations AS registration
SET event_id = matched.id::text
FROM LATERAL (
  SELECT content.id
  FROM public.bbc_event_content AS content
  WHERE lower(content.title_en) = lower(registration.event_name)
    AND content.event_date = registration.event_date
  ORDER BY content.created_at DESC, content.id DESC
  LIMIT 1
) AS matched
WHERE registration.event_id !~ '^[0-9]+$';
