-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. Tables

-- word_lists
create table if not exists word_lists (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  creator_id uuid references auth.users(id) not null,
  is_public boolean default false,
  list_type text default 'word_definition' check (list_type in ('word_definition', 'image_definition', 'sight_words')),
  created_at timestamp with time zone default now()
);

-- list_words
create table if not exists list_words (
  id uuid primary key default uuid_generate_v4(),
  list_id uuid references word_lists(id) on delete cascade not null,
  word text not null,
  definition text,
  image_url text
);
create index if not exists idx_list_words_list_id on list_words(list_id);

-- list_shares
create table if not exists list_shares (
  id uuid primary key default uuid_generate_v4(),
  word_list_id uuid references word_lists(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  last_accessed timestamp with time zone default now()
);
create index if not exists idx_list_shares_user_accessed on list_shares(user_id, last_accessed);

-- user_missed_words
create table if not exists user_missed_words (
  user_id uuid references auth.users(id) on delete cascade not null,
  word_id uuid references list_words(id) on delete cascade not null,
  list_id uuid references word_lists(id) on delete cascade not null,
  primary key (user_id, word_id)
);

-- quiz_progress
-- Attempt to create type if not exists. 
-- If this block fails in the UI, run: create type quiz_pass_type as enum ('main', 'review'); manually once.
do $$ 
begin
    if not exists (select 1 from pg_type where typname = 'quiz_pass_type') then
        create type quiz_pass_type as enum ('main', 'review');
    end if;
end $$;

create table if not exists quiz_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  list_id uuid references word_lists(id) on delete cascade not null,
  pass_type quiz_pass_type not null,
  state jsonb default '{"answered_ids": [], "incorrect_ids": []}'::jsonb,
  updated_at timestamp with time zone default now(),
  unique(user_id, list_id, pass_type)
);

-- 2. RLS Policies

alter table word_lists enable row level security;
alter table list_words enable row level security;
alter table list_shares enable row level security;
alter table user_missed_words enable row level security;
alter table quiz_progress enable row level security;

-- word_lists policies
drop policy if exists "Users can view public lists or their own shared lists" on word_lists;
create policy "Users can view public lists or their own shared lists"
  on word_lists for select
  using (
    is_public = true
    or exists (
      select 1 from list_shares
      where list_shares.word_list_id = word_lists.id
      and list_shares.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert their own lists" on word_lists;
create policy "Users can insert their own lists"
  on word_lists for insert
  with check (auth.uid() = creator_id);

drop policy if exists "Users can update their own lists" on word_lists;
create policy "Users can update their own lists"
  on word_lists for update
  using (auth.uid() = creator_id);

-- list_words policies
drop policy if exists "Users can view words of accessible lists" on list_words;
create policy "Users can view words of accessible lists"
  on list_words for select
  using (
    exists (
      select 1 from word_lists
      where word_lists.id = list_words.list_id
      and (
        word_lists.is_public = true
        or exists (
          select 1 from list_shares
          where list_shares.word_list_id = word_lists.id
          and list_shares.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "Users can insert words into their own lists" on list_words;
create policy "Users can insert words into their own lists"
  on list_words for insert
  with check (
    exists (
      select 1 from word_lists
      where word_lists.id = list_id
      and word_lists.creator_id = auth.uid()
    )
  );

drop policy if exists "Users can update words in their own lists" on list_words;
create policy "Users can update words in their own lists"
  on list_words for update
  using (
    exists (
      select 1 from word_lists
      where word_lists.id = list_words.list_id
      and word_lists.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from word_lists
      where word_lists.id = list_id
      and word_lists.creator_id = auth.uid()
    )
  );

drop policy if exists "Users can delete words in their own lists" on list_words;
create policy "Users can delete words in their own lists"
  on list_words for delete
  using (
    exists (
      select 1 from word_lists
      where word_lists.id = list_words.list_id
      and word_lists.creator_id = auth.uid()
    )
  );

-- list_shares policies
drop policy if exists "Users can view their own list shares" on list_shares;
create policy "Users can view their own list shares"
  on list_shares for select
  using (user_id = auth.uid());

-- user_missed_words policies
drop policy if exists "Users can view their own missed words" on user_missed_words;
create policy "Users can view their own missed words"
  on user_missed_words for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own missed words" on user_missed_words;
create policy "Users can insert their own missed words"
  on user_missed_words for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own missed words" on user_missed_words;
create policy "Users can delete their own missed words"
  on user_missed_words for delete
  using (user_id = auth.uid());

-- quiz_progress policies
drop policy if exists "Users can view their own quiz progress" on quiz_progress;
create policy "Users can view their own quiz progress"
  on quiz_progress for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert/update their own quiz progress" on quiz_progress;
create policy "Users can insert/update their own quiz progress"
  on quiz_progress for all
  using (user_id = auth.uid());


-- 3. RPC Functions

-- create_new_list
-- create_new_list
create or replace function create_new_list(
  p_name text,
  p_description text,
  p_is_public boolean default false,
  p_list_type text default 'word_definition'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_list_id uuid;
begin
  -- Insert into word_lists
  insert into word_lists (name, description, creator_id, is_public, list_type)
  values (p_name, p_description, auth.uid(), p_is_public, p_list_type)
  returning id into v_list_id;

  -- Insert into list_shares for the creator
  insert into list_shares (word_list_id, user_id)
  values (v_list_id, auth.uid());

  return v_list_id;
end;
$$;

-- subscribe_to_list
create or replace function subscribe_to_list(p_list_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from list_shares where word_list_id = p_list_id and user_id = auth.uid()) then
      insert into list_shares (word_list_id, user_id)
      values (p_list_id, auth.uid());
  end if;
end;
$$;

-- update_quiz_progress
create or replace function update_quiz_progress(
  p_list_id uuid,
  p_pass_type quiz_pass_type,
  p_word_id uuid,
  p_is_correct boolean
)
returns void
language plpgsql
security definer
as $$
declare
  v_state jsonb;
begin
  -- 1. Upsert quiz_progress
  insert into quiz_progress (user_id, list_id, pass_type)
  values (auth.uid(), p_list_id, p_pass_type)
  on conflict (user_id, list_id, pass_type) do nothing;

  -- Fetch current state (now guaranteed to exist)
  select state into v_state from quiz_progress
  where user_id = auth.uid() and list_id = p_list_id and pass_type = p_pass_type;

  -- 2. Append to answered_ids
  v_state := jsonb_set(
      v_state, 
      '{answered_ids}', 
      (v_state->'answered_ids') || to_jsonb(p_word_id)
  );

  -- 3. If incorrect, append to incorrect_ids and upsert user_missed_words
  if not p_is_correct then
      v_state := jsonb_set(
          v_state, 
          '{incorrect_ids}', 
          (v_state->'incorrect_ids') || to_jsonb(p_word_id)
      );

      insert into user_missed_words (user_id, word_id, list_id)
      values (auth.uid(), p_word_id, p_list_id)
      on conflict (user_id, word_id) do nothing;
  end if;

  -- Update the row
  update quiz_progress
  set state = v_state, updated_at = now()
  where user_id = auth.uid() and list_id = p_list_id and pass_type = p_pass_type;

end;
$$;

-- finish_quiz_pass
create or replace function finish_quiz_pass(
  p_list_id uuid,
  p_pass_type quiz_pass_type,
  p_clear_missed boolean
)
returns void
language plpgsql
security definer
as $$
declare
  v_state jsonb;
  v_answered jsonb;
  v_incorrect jsonb;
  v_word_id text; 
begin
  -- 1. If review pass and clear_missed is true
  if p_pass_type = 'review' and p_clear_missed then
      select state into v_state from quiz_progress
      where user_id = auth.uid() and list_id = p_list_id and pass_type = p_pass_type;
      
      if v_state is not null then
          v_answered := v_state->'answered_ids';
          v_incorrect := v_state->'incorrect_ids';
          
          -- Iterate over answered words
          for v_word_id in select jsonb_array_elements_text(v_answered)
          loop
              -- If word is NOT in incorrect list, it was mastered
              if not (v_incorrect @> to_jsonb(v_word_id)) then
                  delete from user_missed_words
                  where user_id = auth.uid() and word_id = v_word_id::uuid;
              end if;
          end loop;
      end if;
  end if;

  -- 2. Delete row from quiz_progress
  delete from quiz_progress
  where user_id = auth.uid() and list_id = p_list_id and pass_type = p_pass_type;
end;
$$;



-- user_settings
create table if not exists user_settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  settings jsonb not null,
  updated_at timestamp with time zone default now()
);

alter table user_settings enable row level security;

drop policy if exists "Users can manage their own settings" on user_settings;
create policy "Users can manage their own settings"
  on user_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- upsert_settings
create or replace function upsert_settings(p_settings jsonb)
returns void
language plpgsql
security definer
as $$
begin
  insert into user_settings (user_id, settings)
  values (auth.uid(), p_settings)
  on conflict (user_id) do update
  set settings = p_settings, updated_at = now();
end;
$$;

-- get_user_settings
create or replace function get_user_settings()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_settings jsonb;
begin
  select settings into v_settings
  from user_settings
  where user_id = auth.uid();
  
  return v_settings;
end;
$$;
