-- 1. Backfill Profiles for existing users
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT 
  id, 
  raw_user_meta_data->>'full_name', 
  raw_user_meta_data->>'avatar_url'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- 2. Fix RLS Recursion by using SECURITY DEFINER functions

-- Function to check if user is teacher of a class (bypasses RLS)
CREATE OR REPLACE FUNCTION is_teacher_of_classroom(p_classroom_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM classrooms
    WHERE id = p_classroom_id
    AND teacher_id = auth.uid()
  );
END;
$$;

-- Drop problematic policies on classroom_students
DROP POLICY IF EXISTS "Teachers can view roster" ON classroom_students;
DROP POLICY IF EXISTS "Teachers can manage roster" ON classroom_students;
DROP POLICY IF EXISTS "Students can view own membership" ON classroom_students;
DROP POLICY IF EXISTS "Students can update own membership" ON classroom_students;

-- Re-create policies using the function (Breaks recursion) and adding Email support

-- Teachers can view roster
CREATE POLICY "Teachers can view roster" ON classroom_students
  FOR SELECT USING ( is_teacher_of_classroom(classroom_id) );

-- Teachers can manage roster
CREATE POLICY "Teachers can manage roster" ON classroom_students
  FOR ALL USING ( is_teacher_of_classroom(classroom_id) );

-- Students can view own membership (ID match OR Email match)
CREATE POLICY "Students can view own membership" ON classroom_students
  FOR SELECT USING (
    (student_id = auth.uid()) OR 
    (invited_email = auth.jwt()->>'email')
  );

-- Students can update own membership (Accept invite)
CREATE POLICY "Students can update own membership" ON classroom_students
  FOR UPDATE USING (
    (student_id = auth.uid()) OR 
    (invited_email = auth.jwt()->>'email')
  );
  
-- 3. Fix "Students can view classes they belong to" on classrooms to be safer?
-- The current policy queries classroom_students. 
-- Now that classroom_students policies are safe (don't query classrooms via RLS), 
-- the loop should be broken.
-- But we need to ensure "Students can view classes" allows viewing if they are pending?
-- No, normally only 'active' students see the class in their list.
-- The "Join Class" component uses `get_classroom_by_code` (RPC) so it doesn't rely on RLS.
-- The "Pending Invite" check queries `classroom_students` direct (fixed above).
-- So the `classrooms` policy for students:
-- "Students can view classes they belong to" -> active only.
-- This remains fine: 
-- SELECT 1 FROM classroom_students WHERE classroom_id = classrooms.id AND student_id = auth.uid() AND status = 'active'
