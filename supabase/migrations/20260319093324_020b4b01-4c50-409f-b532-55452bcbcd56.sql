
-- Add engagement metrics to follower_snapshots
ALTER TABLE public.follower_snapshots
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_rate numeric NOT NULL DEFAULT 0;

-- Add a follower_alerts table for drop notifications
CREATE TABLE IF NOT EXISTS public.follower_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  alert_type text NOT NULL DEFAULT 'drop',
  previous_count integer NOT NULL DEFAULT 0,
  current_count integer NOT NULL DEFAULT 0,
  change_pct numeric NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.follower_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own follower alerts"
  ON public.follower_alerts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
