-- Legacy one-way hashes remain valid. Their original passwords cannot be recovered.
ALTER TABLE public.bbc_managers ADD COLUMN IF NOT EXISTS password_encrypted TEXT;
