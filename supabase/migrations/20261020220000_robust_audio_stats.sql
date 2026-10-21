-- Enable pgcrypto if not already enabled (needed for digest)
create extension if not exists pgcrypto with schema extensions;

-- Replace get_lists_audio_stats with a robust version that joins storage.objects
create or replace function public.get_lists_audio_stats(p_list_ids uuid[])
returns table (
  list_id uuid,
  total_words bigint,
  completed_words bigint,
  failed_words bigint,
  pending_words bigint,
  queue_position bigint
)
language plpgsql
security definer
set search_path = public, extensions, storage
as $$
begin
  return query
  select
    li.list_id,
    count(distinct lower(trim(li.word))) as total_words,
    count(distinct case 
      when so.id is not null or agq.status = 'completed' then lower(trim(li.word)) 
    end) as completed_words,
    count(distinct case 
      when so.id is null and agq.status = 'failed' then lower(trim(li.word)) 
    end) as failed_words,
    count(distinct case 
      when so.id is null and (
        agq.status = 'pending' 
        or (agq.status = 'processing' and agq.updated_at >= now() - interval '5 minutes')
      ) then lower(trim(li.word)) 
    end) as pending_words,
    (
      select count(*) 
      from audio_generation_queue gq 
      left join storage.objects gso 
        on gso.bucket_id = 'quiz-audio' 
        and gso.name = 'audio/' || gq.language || '-' || encode(extensions.digest(lower(trim(gq.word)), 'sha256'), 'hex') || '.wav'
      where gso.id is null
        and (
          gq.status = 'pending' 
          or (gq.status = 'processing' and gq.updated_at >= now() - interval '5 minutes')
        )
    ) as queue_position
  from
    list_words li
  join
    word_lists l on l.id = li.list_id
  left join
    audio_generation_queue agq on lower(trim(agq.word)) = lower(trim(li.word)) and agq.language = l.language
  left join
    storage.objects so on so.bucket_id = 'quiz-audio' and so.name = 'audio/' || l.language || '-' || encode(extensions.digest(lower(trim(li.word)), 'sha256'), 'hex') || '.wav'
  where
    li.list_id = any(p_list_ids)
    and l.list_type in ('sight_words', 'sentences')
  group by
    li.list_id;
end;
$$;

grant execute on function public.get_lists_audio_stats(uuid[]) to authenticated, anon, service_role;

-- Clean up any queue items whose audio already exists in storage
update audio_generation_queue agq
set status = 'completed', updated_at = now()
from storage.objects so
where so.bucket_id = 'quiz-audio'
  and so.name = 'audio/' || agq.language || '-' || encode(extensions.digest(lower(trim(agq.word)), 'sha256'), 'hex') || '.wav'
  and agq.status != 'completed';

-- Reset any stale processing items older than 5 minutes to pending
update audio_generation_queue
set status = 'pending', attempts = coalesce(attempts, 0) + 1, updated_at = now()
where status = 'processing'
  and updated_at < now() - interval '5 minutes';
