ALTER TABLE public.bbc_registration_payment_reviews
  ADD COLUMN IF NOT EXISTS confirmation_suffix CHAR(4);

ALTER TABLE public.bbc_registration_payment_reviews
  DROP CONSTRAINT IF EXISTS bbc_review_confirmation_suffix_format;

ALTER TABLE public.bbc_registration_payment_reviews
  ADD CONSTRAINT bbc_review_confirmation_suffix_format
  CHECK (confirmation_suffix IS NULL OR confirmation_suffix ~ '^[A-Z0-9]{4}$');
