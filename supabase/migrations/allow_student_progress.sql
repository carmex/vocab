-- Allow students to view/update their own quiz progress for assigned quests
-- This ensures that progress is saved even if the list is private

DROP POLICY IF EXISTS "Students can access progress for assigned lists" ON quiz_progress;
CREATE POLICY "Students can access progress for assigned lists" ON quiz_progress
  FOR ALL USING (
    auth.uid() = user_id AND (
      EXISTS (
        SELECT 1 FROM quests
        JOIN classrooms ON quests.classroom_id = classrooms.id
        JOIN classroom_students ON classrooms.id = classroom_students.classroom_id
        WHERE quests.list_id = quiz_progress.list_id
        AND classroom_students.student_id = auth.uid()
        AND classroom_students.status = 'active'
      )
    )
  );
