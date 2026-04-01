CREATE TABLE public.client_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'client',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, profile_id)
);

ALTER TABLE public.client_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage client access"
ON public.client_access FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_profiles cp
    WHERE cp.id = client_access.profile_id
    AND cp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.client_profiles cp
    WHERE cp.id = client_access.profile_id
    AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Client can read own access"
ON public.client_access FOR SELECT TO authenticated
USING (user_id = auth.uid());