ALTER TABLE public.client_profiles 
ADD COLUMN IF NOT EXISTS hourly_optimizer_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS business_hours_start integer NOT NULL DEFAULT 8,
ADD COLUMN IF NOT EXISTS business_hours_end integer NOT NULL DEFAULT 23;