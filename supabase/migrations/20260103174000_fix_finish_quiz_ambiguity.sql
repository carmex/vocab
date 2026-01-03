-- Fix for finish_quiz_pass ambiguity (PGRST203)
-- Drop the overloaded version using the enum type explicitely
DROP FUNCTION IF EXISTS finish_quiz_pass(uuid, public.quiz_pass_type, boolean);

-- Drop the text version to be clean and ensure we are replacing it
DROP FUNCTION IF EXISTS finish_quiz_pass(uuid, text, boolean);

-- Recreate the canonical version using TEXT input
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
  -- Explicit cast to enum inside the query
  DELETE FROM quiz_progress 
  WHERE user_id = v_user_id 
  AND list_id = p_list_id 
  AND pass_type = p_pass_type::quiz_pass_type;

END;
$$;
