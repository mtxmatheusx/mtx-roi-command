ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS rollback_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rollback_roas_threshold numeric NOT NULL DEFAULT 10;