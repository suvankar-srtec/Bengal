ALTER TABLE public.bbc_event_content
  DROP COLUMN IF EXISTS impact_label,
  DROP COLUMN IF EXISTS impact_value,
  DROP COLUMN IF EXISTS impact_copy,
  DROP COLUMN IF EXISTS value_1,
  DROP COLUMN IF EXISTS value_2;
