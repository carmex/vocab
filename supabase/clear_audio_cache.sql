-- This script clears the metadata for the 'quiz-audio' bucket in Supabase Storage.
-- Run this if you have manually deleted files from the disk/bucket but Supabase still thinks they exist.

DELETE FROM storage.objects
WHERE bucket_id = 'quiz-audio';
