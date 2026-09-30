-- Form submissions do not collect payment. Uploaded payment records retain their status.
-- This also runs after the legacy payment-status sync when migrations are replayed.
UPDATE public.bbc_event_registrations
SET payment_status = 'unpaid', amount_paid_paise = 0
WHERE admin_import_key IS NULL
  AND (payment_status <> 'unpaid' OR COALESCE(amount_paid_paise, 0) <> 0);
