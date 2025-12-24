-- Migration script for adding language support to word_lists
-- Run this in your Supabase SQL Editor

-- 1. Add language column to word_lists table
ALTER TABLE word_lists ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';

-- 2. Backfill existing lists to English
UPDATE word_lists SET language = 'en' WHERE language IS NULL;

-- 3. Update the create_new_list function to accept language parameter
CREATE OR REPLACE FUNCTION create_new_list(
  p_name text,
  p_description text,
  p_is_public boolean DEFAULT false,
  p_list_type text DEFAULT 'word_definition',
  p_language text DEFAULT 'en'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_list_id uuid;
BEGIN
  -- Insert into word_lists
  INSERT INTO word_lists (name, description, creator_id, is_public, list_type, language)
  VALUES (p_name, p_description, auth.uid(), p_is_public, p_list_type, p_language)
  RETURNING id INTO v_list_id;

  -- Insert into list_shares for the creator
  INSERT INTO list_shares (word_list_id, user_id)
  VALUES (v_list_id, auth.uid());

  RETURN v_list_id;
END;
$$;
