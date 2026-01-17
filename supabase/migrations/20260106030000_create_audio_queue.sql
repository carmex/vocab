-- Create the queue table
create table public.audio_generation_queue (
  id uuid default gen_random_uuid() primary key,
  word text not null,
  language text not null default 'en',
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  attempts int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(word, language)
);

-- Enable RLS
alter table public.audio_generation_queue enable row level security;

-- Policies
-- Authenticated users (teachers) can insert items (when creating lists)
create policy "Authenticated users can insert queue items"
  on public.audio_generation_queue for insert
  with check (auth.role() = 'authenticated');

-- Authenticated users can read queue status (to show progress)
create policy "Authenticated users can read queue items"
  on public.audio_generation_queue for select
  using (auth.role() = 'authenticated');

-- Service Role (Edge Function) has full access (defaults to all if bypass RLS is processing)
