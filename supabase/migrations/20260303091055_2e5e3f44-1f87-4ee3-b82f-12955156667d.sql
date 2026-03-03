
-- Fix campaign_drafts: policy is RESTRICTIVE (blocks everything without a permissive policy)
DROP POLICY IF EXISTS "Users manage own drafts" ON public.campaign_drafts;
CREATE POLICY "Users manage own drafts"
ON public.campaign_drafts
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fix client_profiles: same issue
DROP POLICY IF EXISTS "Users manage own profiles" ON public.client_profiles;
CREATE POLICY "Users manage own profiles"
ON public.client_profiles
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fix creative_assets: same issue
DROP POLICY IF EXISTS "Users manage own creative assets" ON public.creative_assets;
CREATE POLICY "Users manage own creative assets"
ON public.creative_assets
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fix emergency_logs: same issue
DROP POLICY IF EXISTS "Users manage own emergency logs" ON public.emergency_logs;
CREATE POLICY "Users manage own emergency logs"
ON public.emergency_logs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fix knowledge_base: same issue
DROP POLICY IF EXISTS "Users manage own knowledge base" ON public.knowledge_base;
CREATE POLICY "Users manage own knowledge base"
ON public.knowledge_base
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fix ugc_characters: same issue
DROP POLICY IF EXISTS "Users manage own ugc characters" ON public.ugc_characters;
CREATE POLICY "Users manage own ugc characters"
ON public.ugc_characters
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fix vsl_scripts: same issue
DROP POLICY IF EXISTS "Users manage own vsl scripts" ON public.vsl_scripts;
CREATE POLICY "Users manage own vsl scripts"
ON public.vsl_scripts
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
