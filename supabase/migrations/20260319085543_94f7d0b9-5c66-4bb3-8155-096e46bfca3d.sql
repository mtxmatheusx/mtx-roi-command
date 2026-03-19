
CREATE TABLE public.follower_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  followers_count integer NOT NULL DEFAULT 0,
  following_count integer NOT NULL DEFAULT 0,
  media_count integer NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, snapshot_date)
);

ALTER TABLE public.follower_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own follower snapshots"
  ON public.follower_snapshots
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
