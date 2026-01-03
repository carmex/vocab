-- Fix update_quiz_progress to properly track missed words in user_missed_words table
-- This restores functionality for "Review Missed Items" feature

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
  AND pass_type = p_pass_type::quiz_pass_type;

  IF v_state IS NULL THEN
    v_state := '{"answered_ids": [], "incorrect_ids": []}'::jsonb;
  END IF;

  v_answered_ids := v_state->'answered_ids';
  v_incorrect_ids := v_state->'incorrect_ids';

  -- Check if already answered to prevent duplicates in array (though logic should handle it)
  IF NOT (v_answered_ids @> to_jsonb(p_word_id)) THEN
    v_answered_ids := v_answered_ids || to_jsonb(p_word_id);
    
    -- If incorrect, add to incorrect_ids AND user_missed_words
    IF NOT p_is_correct THEN
       v_incorrect_ids := v_incorrect_ids || to_jsonb(p_word_id);
       
       -- KEY FIX: Insert into user_missed_words
       INSERT INTO user_missed_words (user_id, word_id, list_id)
       VALUES (v_user_id, p_word_id::uuid, p_list_id)
       ON CONFLICT (user_id, word_id) DO NOTHING;
    END IF;
    
    -- Update payload
    v_state := jsonb_build_object(
      'answered_ids', v_answered_ids,
      'incorrect_ids', v_incorrect_ids
    );

    -- Upsert quiz_progress
    INSERT INTO quiz_progress (user_id, list_id, pass_type, state, updated_at)
    VALUES (v_user_id, p_list_id, p_pass_type::quiz_pass_type, v_state, now())
    ON CONFLICT (user_id, list_id, pass_type)
    DO UPDATE SET 
      state = EXCLUDED.state,
      updated_at = now();
  END IF;
END;
$$;
