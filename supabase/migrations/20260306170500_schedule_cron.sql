-- Enable pg_cron and schedule the autonomous traffic manager
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the autonomous manager to run every hour
-- We use net.http_post to call the Edge Function
-- Note: Replace with your actual project URL and service role key if needed locally, 
-- but in Supabase Cloud this can be done via the vault or direct URL.
-- For this implementation, we assume the dashboard/CLI will handle the actual URL mapping,
-- but we provide the core SQL logic.

SELECT cron.schedule(
  'autonomous-traffic-manager-hourly', -- name of the job
  '0 * * * *',                         -- every hour
  $$
  SELECT
    net.http_post(
      url:='https://wuuwifyuxyizjxltznsu.supabase.co/functions/v1/autonomous-traffic-manager',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('vault.service_role_key') || '"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
