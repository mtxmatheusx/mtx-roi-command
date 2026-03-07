-- Add last_autonomous_run column to client_profiles
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS last_autonomous_run timestamptz;
