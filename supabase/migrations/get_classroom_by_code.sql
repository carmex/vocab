-- Function to get minimal class info by code (Bypassing RLS for public join)
CREATE OR REPLACE FUNCTION get_classroom_by_code(p_code text)
RETURNS TABLE (
  id uuid,
  name text,
  grade_level text,
  teacher_id uuid,
  code text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.grade_level,
    c.teacher_id,
    c.code
  FROM classrooms c
  WHERE c.code = p_code;
END;
$$;
