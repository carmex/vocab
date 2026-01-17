-- Create a new public bucket for quiz audio
insert into storage.buckets (id, name, public)
values ('quiz-audio', 'quiz-audio', true);

-- Allow public access to read files
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'quiz-audio' );

-- Allow authenticated users (and service role) to upload
-- Depending on how the Edge Function calls it, it might be service role (bypassing RLS)
-- but having this doesn't hurt.
create policy "Authenticated Insert"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'quiz-audio' );
