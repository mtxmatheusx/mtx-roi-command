
-- Add automation columns to client_profiles
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS cpa_max_toleravel numeric NOT NULL DEFAULT 0;
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS roas_min_escala numeric NOT NULL DEFAULT 0;
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS teto_diario_escala numeric NOT NULL DEFAULT 0;

-- Create emergency_logs table
CREATE TABLE public.emergency_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.emergency_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own emergency logs"
  ON public.emergency_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create vsl_scripts table
CREATE TABLE public.vsl_scripts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  angle text NOT NULL DEFAULT '',
  duration text NOT NULL DEFAULT '',
  tone text NOT NULL DEFAULT '',
  script_content text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vsl_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own vsl scripts"
  ON public.vsl_scripts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
