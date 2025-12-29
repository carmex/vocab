-- Fix for finish_quiz_pass RPC - explicit casting for Enum type
-- Matches the fix we did for update_quiz_progress

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
  -- Explicitly cast p_pass_type to quiz_pass_type
  DELETE FROM quiz_progress 
  WHERE user_id = v_user_id 
  AND list_id = p_list_id 
  AND pass_type = p_pass_type::quiz_pass_type;

  -- 2. If review pass and clear_missed is true (optional logic)
  -- Note: p_clear_missed is currently unused in this basic implementation 
  -- because frontend handles clearing missed words separately via delete(),
  -- but we leave the param for future server-side consolidation.
END;
$$;
