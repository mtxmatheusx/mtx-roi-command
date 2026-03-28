-- Report Portal: tables for client-facing report access

-- Snapshot of dashboard data per profile per day (written by cron edge function)
CREATE TABLE IF NOT EXISTS report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, snapshot_date)
);

-- Maps a Supabase Auth user to a profile they can view as a client
CREATE TABLE IF NOT EXISTS client_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id, profile_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_snapshots_profile_date ON report_snapshots(profile_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_client_access_user ON client_access(user_id);

-- RLS
ALTER TABLE report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_access ENABLE ROW LEVEL SECURITY;

-- report_snapshots: clients read their profiles, admins read theirs
CREATE POLICY "Clients can read their snapshots"
  ON report_snapshots FOR SELECT
  USING (
    profile_id IN (SELECT profile_id FROM client_access WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can read their profile snapshots"
  ON report_snapshots FOR SELECT
  USING (
    profile_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid())
  );

-- client_access: admins manage, clients read own
CREATE POLICY "Admins manage client access for their profiles"
  ON client_access FOR ALL
  USING (
    profile_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Clients can read their own access"
  ON client_access FOR SELECT
  USING (user_id = auth.uid());
