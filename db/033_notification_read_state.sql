ALTER TABLE public.bbc_registration_payment_reviews
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS bbc_payment_review_unread_idx ON public.bbc_registration_payment_reviews(id)
  WHERE read_at IS NULL AND status='pending';
CREATE INDEX IF NOT EXISTS bbc_payment_review_pending_idx ON public.bbc_registration_payment_reviews(id)
  WHERE status='pending';
