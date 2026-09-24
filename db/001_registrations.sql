CREATE TABLE IF NOT EXISTS public.bbc_event_registrations (
  id UUID PRIMARY KEY,
  submission_id UUID NOT NULL UNIQUE,
  request_hash CHAR(64) NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  member_name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(16) NOT NULL CHECK (phone ~ '^[+][1-9][0-9]{7,14}$'),
  billing_details VARCHAR(15) NOT NULL,
  participation_quantity INTEGER NOT NULL CHECK (participation_quantity BETWEEN 1 AND 20),
  standee_quantity INTEGER NOT NULL CHECK (standee_quantity BETWEEN 0 AND 10),
  meal_choice TEXT CHECK (meal_choice IN ('snacks', 'lunch', 'dinner')),
  presentation_selected BOOLEAN NOT NULL DEFAULT FALSE,
  participation_unit_paise INTEGER NOT NULL CHECK (participation_unit_paise > 0),
  standee_unit_paise INTEGER NOT NULL CHECK (standee_unit_paise > 0),
  presentation_unit_paise INTEGER NOT NULL CHECK (presentation_unit_paise > 0),
  meal_unit_paise INTEGER NOT NULL DEFAULT 0 CHECK (meal_unit_paise >= 0),
  total_paise INTEGER NOT NULL CHECK (
    total_paise = participation_quantity * participation_unit_paise
      + standee_quantity * standee_unit_paise
      + CASE WHEN meal_choice IS NOT NULL THEN participation_quantity * meal_unit_paise ELSE 0 END
      + CASE WHEN presentation_selected THEN presentation_unit_paise ELSE 0 END
  ),
  currency CHAR(3) NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bbc_event_registrations_event_created_idx
  ON public.bbc_event_registrations (event_id, created_at DESC);
