-- Migration for Classroom Foundation & Roster Management

-- 1. Create User Role Enum
BEGIN;
  DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('teacher', 'student');
  EXCEPTION
      WHEN duplicate_object THEN null;
  END $$;
COMMIT;

-- 2. Add role to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role user_role DEFAULT NULL;

-- 3. Create Classrooms Table
CREATE TABLE IF NOT EXISTS classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES profiles(id) NOT NULL,
  name text NOT NULL,
  grade_level text,
  code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 4. Create Classroom Students Table (Roster)
CREATE TABLE IF NOT EXISTS classroom_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid REFERENCES classrooms(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES profiles(id) ON DELETE SET NULL, -- Can be null if invited by email
  invited_email text, -- relevant if student_id is null
  status text CHECK (status IN ('active', 'pending')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  -- Ensure unique participation per class
  CONSTRAINT unique_student_per_class UNIQUE (classroom_id, student_id),
  -- Ensure unique invite per class
  CONSTRAINT unique_invite_per_class UNIQUE (classroom_id, invited_email)
);

-- 5. Enable RLS
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_students ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies

-- Classrooms:
-- Teachers can see their own classes
CREATE POLICY "Teachers can view own classes" ON classrooms
  FOR SELECT USING (auth.uid() = teacher_id);

-- Teachers can insert their own classes
CREATE POLICY "Teachers can create classes" ON classrooms
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

-- Teachers can update their own classes
CREATE POLICY "Teachers can update own classes" ON classrooms
  FOR UPDATE USING (auth.uid() = teacher_id);

-- Teachers can delete their own classes
CREATE POLICY "Teachers can delete own classes" ON classrooms
  FOR DELETE USING (auth.uid() = teacher_id);
  
-- Students can view classes they are in (via classroom_students)
CREATE POLICY "Students can view classes they belong to" ON classrooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classroom_students 
      WHERE classroom_students.classroom_id = classrooms.id 
      AND classroom_students.student_id = auth.uid()
      AND classroom_students.status = 'active'
    )
  );

-- Classroom Students:
-- Teachers can view their class rosters
CREATE POLICY "Teachers can view roster" ON classroom_students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classrooms 
      WHERE classrooms.id = classroom_students.classroom_id 
      AND classrooms.teacher_id = auth.uid()
    )
  );

-- Teachers can manage their class rosters (insert/update/delete)
CREATE POLICY "Teachers can manage roster" ON classroom_students
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM classrooms 
      WHERE classrooms.id = classroom_students.classroom_id 
      AND classrooms.teacher_id = auth.uid()
    )
  );

-- Students can view their own membership
CREATE POLICY "Students can view own membership" ON classroom_students
  FOR SELECT USING (auth.uid() = student_id);
  
-- Students can join (update status to active) - this might need refinement depending on flow
-- For now, we'll likely handle joining via RPC or explicit inserts/updates where permitted. 
-- Let's allow students to generic "update" for now if it is their record, 
-- but we might restrict columns later.
CREATE POLICY "Students can update own membership" ON classroom_students
  FOR UPDATE USING (auth.uid() = student_id);

-- 7. Functions for Class Code Generation (similar to share code)
CREATE OR REPLACE FUNCTION generate_class_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_code text := '';
  v_exists boolean;
BEGIN
  LOOP
    v_code := '';
    -- Generate 6 char code
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    SELECT EXISTS(SELECT 1 FROM classrooms WHERE code = v_code) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;

-- Trigger to auto-assign class code on insert
CREATE OR REPLACE FUNCTION set_classroom_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := generate_class_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_classroom_code
BEFORE INSERT ON classrooms
FOR EACH ROW
EXECUTE FUNCTION set_classroom_code();
