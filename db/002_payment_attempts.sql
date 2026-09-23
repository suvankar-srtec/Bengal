CREATE TABLE IF NOT EXISTS public.bbc_payment_attempts (
  id UUID PRIMARY KEY,
  registration_id UUID NOT NULL REFERENCES public.bbc_event_registrations(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('demo', 'razorpay_test')),
  provider_order_id TEXT NOT NULL UNIQUE,
  provider_payment_id TEXT UNIQUE,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  currency CHAR(3) NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'succeeded', 'failed', 'cancelled')),
  method VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS bbc_payment_attempts_active_idx
  ON public.bbc_payment_attempts (registration_id, mode)
  WHERE status IN ('created', 'succeeded');
