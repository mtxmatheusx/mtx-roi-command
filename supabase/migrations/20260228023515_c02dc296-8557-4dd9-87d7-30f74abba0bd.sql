
CREATE TABLE public.ugc_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fixed_description TEXT NOT NULL DEFAULT '',
  image_references TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ugc_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ugc characters" 
ON public.ugc_characters 
FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER ugc_characters_updated_at 
BEFORE UPDATE ON public.ugc_characters 
FOR EACH ROW 
EXECUTE FUNCTION public.update_updated_at();
