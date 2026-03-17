
-- Create enum for supported ad platforms
CREATE TYPE public.ad_platform AS ENUM ('meta', 'google', 'tiktok', 'linkedin', 'pinterest');

-- Create platform_connections table for multi-platform credentials
CREATE TABLE public.platform_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  platform ad_platform NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  platform_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  token_expires_at TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_error TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(profile_id, platform, platform_account_id)
);

-- Enable RLS
ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage own platform connections"
ON public.platform_connections
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_platform_connections_updated_at
BEFORE UPDATE ON public.platform_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create unified_metrics table for cross-platform analytics cache
CREATE TABLE public.unified_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.platform_connections(id) ON DELETE CASCADE,
  platform ad_platform NOT NULL,
  campaign_id TEXT,
  campaign_name TEXT,
  date DATE NOT NULL,
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  conversion_value NUMERIC NOT NULL DEFAULT 0,
  cpm NUMERIC NOT NULL DEFAULT 0,
  ctr NUMERIC NOT NULL DEFAULT 0,
  cpc NUMERIC NOT NULL DEFAULT 0,
  cpa NUMERIC NOT NULL DEFAULT 0,
  roas NUMERIC NOT NULL DEFAULT 0,
  extra_metrics JSONB DEFAULT '{}'::jsonb,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.unified_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage own unified metrics"
ON public.unified_metrics
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_unified_metrics_profile_date ON public.unified_metrics(profile_id, date DESC);
CREATE INDEX idx_unified_metrics_platform ON public.unified_metrics(platform, date DESC);
CREATE INDEX idx_unified_metrics_connection ON public.unified_metrics(connection_id, date DESC);
CREATE INDEX idx_platform_connections_profile ON public.platform_connections(profile_id, platform);
