
-- Add unique constraint for upsert to work on follower_snapshots
ALTER TABLE public.follower_snapshots
  ADD CONSTRAINT follower_snapshots_profile_date_unique UNIQUE (profile_id, snapshot_date);

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule daily sync at 09:00 BRT (12:00 UTC)
SELECT cron.schedule(
  'daily-follower-sync',
  '0 12 * * *',
  $$
  SELECT extensions.http(
    (
      'POST',
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/daily-follower-sync',
      ARRAY[
        extensions.http_header('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
        extensions.http_header('Content-Type', 'application/json')
      ],
      'application/json',
      '{}'
    )::extensions.http_request
  );
  $$
);
