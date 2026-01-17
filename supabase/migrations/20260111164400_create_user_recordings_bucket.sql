-- Create the 'user-recordings' storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-recordings', 'user-recordings', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload files to their own folder (or any folder for now, let's restrict to authenticated)
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'user-recordings' );

-- Policy: Allow authenticated users to read files (or public if needed for analysis tools later)
-- For now, authenticated read access
CREATE POLICY "Allow authenticated reads"
ON storage.objects
FOR SELECT
TO authenticated
USING ( bucket_id = 'user-recordings' );

-- Optional: Allow users to delete their own files
CREATE POLICY "Allow individual delete"
ON storage.objects
FOR DELETE
TO authenticated
USING ( bucket_id = 'user-recordings' AND (auth.uid() = owner) );
