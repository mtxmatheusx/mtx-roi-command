
-- Add product context columns to client_profiles
ALTER TABLE public.client_profiles
ADD COLUMN product_context TEXT,
ADD COLUMN product_urls TEXT[] DEFAULT '{}';

-- Create creative_assets table
CREATE TABLE public.creative_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.creative_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own creative assets"
ON public.creative_assets
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for creative assets
INSERT INTO storage.buckets (id, name, public) VALUES ('creative-assets', 'creative-assets', true);

CREATE POLICY "Anyone can view creative assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'creative-assets');

CREATE POLICY "Authenticated users upload creative assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'creative-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Users delete own creative assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'creative-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
