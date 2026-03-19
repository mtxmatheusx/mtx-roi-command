
CREATE TABLE public.team_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'medium',
  assigned_to text DEFAULT NULL,
  due_date date DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own team tasks"
  ON public.team_tasks
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_team_tasks_updated_at
  BEFORE UPDATE ON public.team_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.brand_manuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  visual_dna jsonb DEFAULT '{}',
  instagram_username text DEFAULT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_manuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own brand manuals"
  ON public.brand_manuals
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
