-- Create a function to get audio generation statistics for a list of lists
-- This allows the UI to show progress bars and estimated wait times
create or replace function public.get_lists_audio_stats(p_list_ids uuid[])
returns table (
  list_id uuid,
  total_words bigint,
  completed_words bigint,
  failed_words bigint,
  pending_words bigint,
  queue_position bigint -- How many items are ahead of this list's remaining items globally
)
language plpgsql
security definer
as $$
declare
  v_list_id uuid;
begin
  -- Loop through each list ID requested
  -- Note: This might be slow if querying many lists, but efficiently indexed it should be fine.
  -- A set-based approach would be better but mapping words to lists is tricky without joining the list_items table.
  -- We assume the caller (client) knows which lists they want stats for.
  -- BUT, to link words to lists, we need to join on `list_items`.

  return query
  select
    li.list_id,
    count(distinct lower(trim(li.word))) as total_words,
    count(distinct case when agq.status = 'completed' then lower(trim(li.word)) end) as completed_words,
    count(distinct case when agq.status = 'failed' then lower(trim(li.word)) end) as failed_words,
    count(distinct case when agq.status in ('pending', 'processing') then lower(trim(li.word)) end) as pending_words,
    (
        select count(*) 
        from audio_generation_queue gq 
        where gq.status in ('pending', 'processing')
    ) as queue_position
  from
    list_words li
  join
    word_lists l on l.id = li.list_id
  left join
    audio_generation_queue agq on lower(trim(agq.word)) = lower(trim(li.word)) and agq.language = l.language
  where
    li.list_id = any(p_list_ids)
    and l.list_type = 'sight_words' -- Only relevant for sight words
  group by
    li.list_id;
end;
$$;
