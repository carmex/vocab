-- Enable the pg_cron extension
create extension if not exists pg_cron;

-- Schedule the audio queue processing to run every minute
select cron.schedule(
  'process-audio-queue-every-minute', -- job name
  '* * * * *',                        -- every minute
  $$
    select
      net.http_post(
        url:='https://project-ref.supabase.co/functions/v1/process-audio-queue',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
  $$
);
