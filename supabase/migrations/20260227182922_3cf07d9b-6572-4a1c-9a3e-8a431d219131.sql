
ALTER TABLE public.vsl_scripts
ADD COLUMN title text NOT NULL DEFAULT '',
ADD COLUMN content_json jsonb;
