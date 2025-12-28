-- Migration to add share_code and related functions

-- 1. Add share_code column to word_lists
BEGIN;
ALTER TABLE word_lists ADD COLUMN IF NOT EXISTS share_code text UNIQUE;
CREATE UNIQUE INDEX IF NOT EXISTS word_lists_share_code_idx ON word_lists (share_code);
COMMIT;

-- 2. Function to generate a unique share code
CREATE OR REPLACE FUNCTION generate_share_code(p_list_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_code text := '';
  i integer;
  v_exists boolean;
  v_retry integer := 0;
BEGIN
  -- Check if list already has a code
  SELECT share_code INTO v_code FROM word_lists WHERE id = p_list_id;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  -- Generate new code
  LOOP
    v_code := '';
    FOR i IN 1..8 LOOP
      v_code := v_code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;

    -- Check for collision
    SELECT EXISTS(SELECT 1 FROM word_lists WHERE share_code = v_code) INTO v_exists;
    
    IF NOT v_exists THEN
      -- Update the list with the new code
      UPDATE word_lists SET share_code = v_code WHERE id = p_list_id;
      EXIT;
    END IF;

    v_retry := v_retry + 1;
    IF v_retry > 10 THEN
      RAISE EXCEPTION 'Failed to generate unique share code after 10 retries';
    END IF;
  END LOOP;

  RETURN v_code;
END;
$$;

-- 3. Function to get list details by share code (Bypassing RLS for preview)
CREATE OR REPLACE FUNCTION get_list_by_share_code(p_code text)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  creator_id uuid,
  is_public boolean,
  list_type text,
  language text,
  created_at timestamptz,
  creator_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wl.id,
    wl.name,
    wl.description,
    wl.creator_id,
    wl.is_public,
    wl.list_type,
    wl.language,
    wl.created_at,
    'Unknown' as creator_name -- Placeholder, could join with profiles if exists
  FROM word_lists wl
  WHERE wl.share_code = p_code;
END;
$$;

-- 4. Function to subscribe to a list by share code (similar to subscribe_to_list but lookup by code first)
CREATE OR REPLACE FUNCTION subscribe_by_share_code(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_list_id uuid;
BEGIN
  SELECT id INTO v_list_id FROM word_lists WHERE share_code = p_code;
  
  IF v_list_id IS NULL THEN
    RAISE EXCEPTION 'Invalid share code';
  END IF;

  -- Insert into list_shares
  INSERT INTO list_shares (word_list_id, user_id)
  VALUES (v_list_id, auth.uid())
  ON CONFLICT (word_list_id, user_id) DO NOTHING;

  RETURN v_list_id;
END;
$$;
