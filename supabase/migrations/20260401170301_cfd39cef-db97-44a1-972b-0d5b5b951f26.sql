SELECT cron.unschedule('autonomous-traffic-manager-30min');
SELECT cron.unschedule('mtx-autonomous-agent-3h');

SELECT cron.schedule(
  'mtx-autonomous-agent-12h',
  '0 */12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wuuwifyuxyizjxltznsu.supabase.co/functions/v1/autonomous-traffic-manager',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1dXdpZnl1eHlpemp4bHR6bnN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTc5MzcsImV4cCI6MjA4NzY3MzkzN30.31PjY-ZbYkiRrVWpH1cFy30KD5Dw2qYDzBOxAe7KMbY"}'::jsonb,
    body := concat('{"time": "', now(), '", "source": "cron"}')::jsonb
  ) AS request_id;
  $$
);