-- CLEANUP SCRIPT
-- Deletes all file records from the 'user-recordings' bucket.
-- WARNING: This will remove all references to the files in that bucket.
-- Run this in your Supabase SQL Editor.

DELETE FROM storage.objects
WHERE bucket_id = 'user-recordings';
