CREATE TABLE public.copy_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  draft_id uuid REFERENCES public.campaign_drafts(id) ON DELETE SET NULL,
  copy_type text,
  original_copy text NOT NULL,
  suggested_correction text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.copy_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own copy feedback"
  ON public.copy_feedback
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);