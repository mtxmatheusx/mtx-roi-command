
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS instagram_username text DEFAULT NULL;
