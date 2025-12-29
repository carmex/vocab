-- Allow students to view word lists that are assigned to them via quests
-- Even if the list is private / not shared directly

DROP POLICY IF EXISTS "Students can view assigned lists" ON word_lists;
CREATE POLICY "Students can view assigned lists" ON word_lists
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quests
      JOIN classrooms ON quests.classroom_id = classrooms.id
      JOIN classroom_students ON classrooms.id = classroom_students.classroom_id
      WHERE quests.list_id = word_lists.id
      AND classroom_students.student_id = auth.uid()
      AND classroom_students.status = 'active'
    )
  );

-- Also need to allow viewing list_words for those lists
DROP POLICY IF EXISTS "Students can view assigned list words" ON list_words;
CREATE POLICY "Students can view assigned list words" ON list_words
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quests
      JOIN classrooms ON quests.classroom_id = classrooms.id
      JOIN classroom_students ON classrooms.id = classroom_students.classroom_id
      WHERE quests.list_id = list_words.list_id
      AND classroom_students.student_id = auth.uid()
      AND classroom_students.status = 'active'
    )
  );
