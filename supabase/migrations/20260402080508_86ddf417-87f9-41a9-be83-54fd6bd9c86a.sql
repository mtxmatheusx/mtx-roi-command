SELECT cron.schedule(
  'mtx-daily-report-morning',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wuuwifyuxyizjxltznsu.supabase.co/functions/v1/send-daily-report',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1dXdpZnl1eHlpemp4bHR6bnN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTc5MzcsImV4cCI6MjA4NzY3MzkzN30.31PjY-ZbYkiRrVWpH1cFy30KD5Dw2qYDzBOxAe7KMbY"}'::jsonb,
    body := '{"report_type": "morning"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'mtx-daily-report-midday',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wuuwifyuxyizjxltznsu.supabase.co/functions/v1/send-daily-report',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1dXdpZnl1eHlpemp4bHR6bnN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTc5MzcsImV4cCI6MjA4NzY3MzkzN30.31PjY-ZbYkiRrVWpH1cFy30KD5Dw2qYDzBOxAe7KMbY"}'::jsonb,
    body := '{"report_type": "midday"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'mtx-daily-report-evening',
  '0 19 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wuuwifyuxyizjxltznsu.supabase.co/functions/v1/send-daily-report',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1dXdpZnl1eHlpemp4bHR6bnN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTc5MzcsImV4cCI6MjA4NzY3MzkzN30.31PjY-ZbYkiRrVWpH1cFy30KD5Dw2qYDzBOxAe7KMbY"}'::jsonb,
    body := '{"report_type": "evening"}'::jsonb
  ) AS request_id;
  $$
);