-- check the last 10 runs of the cron job
select 
  jobid, 
  runid, 
  job_pid, 
  database, 
  username, 
  command, 
  status, 
  return_message, 
  start_time, 
  end_time 
from 
  cron.job_run_details 
order by 
  start_time desc 
limit 10;
