
-- 1. knowledge_base table
CREATE TABLE public.knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL,
  user_id UUID NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'file',
  field_key TEXT,
  file_name TEXT,
  file_url TEXT,
  extracted_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own knowledge base"
ON public.knowledge_base
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. avatar_dossier column on client_profiles
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS avatar_dossier TEXT;

-- 3. Storage bucket for knowledge docs (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-docs', 'knowledge-docs', false);

-- 4. Storage RLS policies
CREATE POLICY "Users upload own knowledge docs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'knowledge-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own knowledge docs"
ON storage.objects FOR SELECT
USING (bucket_id = 'knowledge-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own knowledge docs"
ON storage.objects FOR DELETE
USING (bucket_id = 'knowledge-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
