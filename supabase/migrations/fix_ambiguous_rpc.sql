-- Fix for PGRST203: "Could not choose the best candidate function"
-- This happens because we likely have multiple overloads of update_quiz_progress
-- one taking (uuid, text, text, boolean) and perhaps another taking (uuid, text, uuid, boolean)

-- Drop ALL potential variants to clear the ambiguity
DROP FUNCTION IF EXISTS update_quiz_progress(uuid, text, text, boolean);
DROP FUNCTION IF EXISTS update_quiz_progress(uuid, text, uuid, boolean);

-- Re-create the canonical function
-- We use TEXT for p_word_id to be safe and flexible since it goes into JSONB
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
