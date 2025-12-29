-- Fix for PGRST203: "Could not choose the best candidate function"
-- We have to be very precise with types when dropping overloaded functions.

-- 1. Drop the version with custom Enum type and UUID
-- (p_list_id => uuid, p_pass_type => public.quiz_pass_type, p_word_id => uuid, p_is_correct => boolean)
DROP FUNCTION IF EXISTS update_quiz_progress(uuid, public.quiz_pass_type, uuid, boolean);

-- 2. Drop the version with Text and Text
-- (p_list_id => uuid, p_pass_type => text, p_word_id => text, p_is_correct => boolean)
DROP FUNCTION IF EXISTS update_quiz_progress(uuid, text, text, boolean);

-- 3. Drop any other potential variants just in case
DROP FUNCTION IF EXISTS update_quiz_progress(uuid, text, uuid, boolean);

-- 4. Re-create the canonical function using TEXT for maximum compatibility
-- We cast types inside the function if needed.
CREATE OR REPLACE FUNCTION update_quiz_progress(
  p_list_id uuid,
  p_pass_type text,
  p_word_id text,
  p_is_correct boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_state jsonb;
  v_answered_ids jsonb;
  v_incorrect_ids jsonb;
BEGIN
  -- Simple validation
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- fetch existing state or default
  SELECT state INTO v_state 
  FROM quiz_progress 
  WHERE user_id = v_user_id 
  AND list_id = p_list_id 
  AND pass_type = p_pass_type;

  IF v_state IS NULL THEN
    v_state := '{"answered_ids": [], "incorrect_ids": []}'::jsonb;
  END IF;

  v_answered_ids := v_state->'answered_ids';
  v_incorrect_ids := v_state->'incorrect_ids';

  -- Check if already answered
  IF NOT (v_answered_ids @> to_jsonb(p_word_id)) THEN
    v_answered_ids := v_answered_ids || to_jsonb(p_word_id);
    
    -- If incorrect, add to incorrect_ids
    IF NOT p_is_correct THEN
       v_incorrect_ids := v_incorrect_ids || to_jsonb(p_word_id);
    END IF;
    
    -- Update payload
    v_state := jsonb_build_object(
      'answered_ids', v_answered_ids,
      'incorrect_ids', v_incorrect_ids
    );

    -- Upsert
    INSERT INTO quiz_progress (user_id, list_id, pass_type, state, updated_at)
    VALUES (v_user_id, p_list_id, p_pass_type, v_state, now())
    ON CONFLICT (user_id, list_id, pass_type)
    DO UPDATE SET 
      state = EXCLUDED.state,
      updated_at = now();
  END IF;
END;
$$;
