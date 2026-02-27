
CREATE TABLE public.campaign_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft',
  objective TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  daily_budget NUMERIC NOT NULL DEFAULT 0,
  copy_options JSONB DEFAULT '[]'::jsonb,
  targeting_suggestion JSONB DEFAULT '{}'::jsonb,
  ai_reasoning TEXT,
  meta_campaign_id TEXT,
  meta_adset_id TEXT,
  meta_ad_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own drafts" ON public.campaign_drafts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_campaign_drafts_updated_at
  BEFORE UPDATE ON public.campaign_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
