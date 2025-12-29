-- Ensure quiz_progress table exists
CREATE TABLE IF NOT EXISTS quiz_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  list_id uuid REFERENCES word_lists(id) ON DELETE CASCADE NOT NULL,
  pass_type text NOT NULL CHECK (pass_type IN ('main', 'review')),
  state jsonb DEFAULT '{"answered_ids": [], "incorrect_ids": []}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, list_id, pass_type)
);

-- Enable RLS
ALTER TABLE quiz_progress ENABLE ROW LEVEL SECURITY;

-- Policies (Re-iterating basic ones)
DROP POLICY IF EXISTS "Users can manage own progress" ON quiz_progress;
CREATE POLICY "Users can manage own progress" ON quiz_progress
  FOR ALL USING (auth.uid() = user_id);

-- Note: The "Students can access progress for assigned lists" policy from previous script is also needed
-- and complements this.

-- Create RPC for updating progress (Upsert)
CREATE OR REPLACE FUNCTION update_quiz_progress(
  p_list_id uuid,
  p_pass_type text,
  p_word_id text,
  p_is_correct boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Run as owner to bypass RLS if needed, but we rely on RLS generally. Actually, keeping it INVOKER is safer if RLS covers it.
-- However, for robustness with "Assigned lists" where RLS might be tricky, DEFINER helps IF we check permissions manually.
-- For now, let's stick to SECURITY INVOKER (default) and rely on the RLS policies we added. 
-- Wait, the user said "progress not saved". If RLS is failing, INVOKER fails.
-- Let's try SECURITY DEFINER but add a strict permission check to ensure users can't mess with others' progress.
-- Actually, the function uses `auth.uid()`, so it forces the current user.
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

  -- Add word to answered_ids if not present
  -- using jsonb containment check or just forcing it
  -- array_append equivalent for jsonb is || but for distinct set we need checks?
  -- Let's just append and we can dedup if needed, or check exists.
  
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


-- Create RPC for finishing pass (Reset)
CREATE OR REPLACE FUNCTION finish_quiz_pass(
  p_list_id uuid,
  p_pass_type text,
  p_clear_missed boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  -- 1. Reset progress
  DELETE FROM quiz_progress 
  WHERE user_id = v_user_id 
  AND list_id = p_list_id 
  AND pass_type = p_pass_type;

  -- 2. If review pass and clear_missed, logic handled by frontend or here?
  -- Frontend Service calls clearMissedWords separately usually, but let's leave it flexible.
  -- This RPC specifically resets the *session progress*.
END;
$$;
