-- Create Quests Table (Assignments)
CREATE TABLE IF NOT EXISTS quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid REFERENCES classrooms(id) ON DELETE CASCADE NOT NULL,
  list_id uuid REFERENCES word_lists(id) ON DELETE CASCADE NOT NULL,
  due_date timestamptz,
  instructions text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Teachers can view quests for their own classes
DROP POLICY IF EXISTS "Teachers can view own class quests" ON quests;
CREATE POLICY "Teachers can view own class quests" ON quests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classrooms
      WHERE classrooms.id = quests.classroom_id
      AND classrooms.teacher_id = auth.uid()
    )
  );

-- Teachers can create quests for their own classes
DROP POLICY IF EXISTS "Teachers can create quests" ON quests;
CREATE POLICY "Teachers can create quests" ON quests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM classrooms
      WHERE classrooms.id = quests.classroom_id
      AND classrooms.teacher_id = auth.uid()
    )
  );

-- Teachers can update their own quests
DROP POLICY IF EXISTS "Teachers can update quests" ON quests;
CREATE POLICY "Teachers can update quests" ON quests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM classrooms
      WHERE classrooms.id = quests.classroom_id
      AND classrooms.teacher_id = auth.uid()
    )
  );

-- Teachers can delete their own quests
DROP POLICY IF EXISTS "Teachers can delete quests" ON quests;
CREATE POLICY "Teachers can delete quests" ON quests
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM classrooms
      WHERE classrooms.id = quests.classroom_id
      AND classrooms.teacher_id = auth.uid()
    )
  );

-- Students can view quests for classes they belong to
DROP POLICY IF EXISTS "Students can view assigned quests" ON quests;
CREATE POLICY "Students can view assigned quests" ON quests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classroom_students
      WHERE classroom_students.classroom_id = quests.classroom_id
      AND classroom_students.student_id = auth.uid()
      AND classroom_students.status = 'active'
    )
  );
