-- ============================================
-- Sprint 3: Quiz Results Schema for Gradebook
-- ============================================

-- Table to track each quiz attempt with score details
CREATE TABLE IF NOT EXISTS quiz_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id uuid REFERENCES quests(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100), -- Percentage 0-100
  total_words integer NOT NULL,
  correct_count integer NOT NULL,
  duration_seconds integer, -- Time spent on this attempt (optional)
  created_at timestamptz DEFAULT now()
);

-- Table to track missed words per attempt
CREATE TABLE IF NOT EXISTS quiz_result_missed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid REFERENCES quiz_results(id) ON DELETE CASCADE NOT NULL,
  word_id uuid REFERENCES list_words(id) ON DELETE CASCADE NOT NULL,
  word_text text NOT NULL -- Denormalized for quick display
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_results_quest_user ON quiz_results(quest_id, user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_quest ON quiz_results(quest_id);
CREATE INDEX IF NOT EXISTS idx_quiz_result_missed_result ON quiz_result_missed(result_id);

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_result_missed ENABLE ROW LEVEL SECURITY;

-- Students can insert their own results
DROP POLICY IF EXISTS "Users can insert own results" ON quiz_results;
CREATE POLICY "Users can insert own results" ON quiz_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Students can view their own results
DROP POLICY IF EXISTS "Users can view own results" ON quiz_results;
CREATE POLICY "Users can view own results" ON quiz_results
  FOR SELECT USING (auth.uid() = user_id);

-- Teachers can view results for quests in their classrooms
DROP POLICY IF EXISTS "Teachers can view class results" ON quiz_results;
CREATE POLICY "Teachers can view class results" ON quiz_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quests
      JOIN classrooms ON quests.classroom_id = classrooms.id
      WHERE quests.id = quiz_results.quest_id
      AND classrooms.teacher_id = auth.uid()
    )
  );

-- Teachers can delete results for quests in their classrooms (for reset)
DROP POLICY IF EXISTS "Teachers can delete class results" ON quiz_results;
CREATE POLICY "Teachers can delete class results" ON quiz_results
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM quests
      JOIN classrooms ON quests.classroom_id = classrooms.id
      WHERE quests.id = quiz_results.quest_id
      AND classrooms.teacher_id = auth.uid()
    )
  );

-- Missed words follow parent result access
DROP POLICY IF EXISTS "Users can view own missed words" ON quiz_result_missed;
CREATE POLICY "Users can view own missed words" ON quiz_result_missed
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quiz_results
      WHERE quiz_results.id = quiz_result_missed.result_id
      AND quiz_results.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own missed words" ON quiz_result_missed;
CREATE POLICY "Users can insert own missed words" ON quiz_result_missed
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_results
      WHERE quiz_results.id = quiz_result_missed.result_id
      AND quiz_results.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can view class missed words" ON quiz_result_missed;
CREATE POLICY "Teachers can view class missed words" ON quiz_result_missed
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quiz_results
      JOIN quests ON quiz_results.quest_id = quests.id
      JOIN classrooms ON quests.classroom_id = classrooms.id
      WHERE quiz_results.id = quiz_result_missed.result_id
      AND classrooms.teacher_id = auth.uid()
    )
  );

-- ============================================
-- Helper Functions for Gradebook Aggregates
-- ============================================

-- Get best score and attempt count for a student on a quest
CREATE OR REPLACE FUNCTION get_student_quest_stats(
  p_quest_id uuid,
  p_user_id uuid
)
RETURNS TABLE(
  best_score integer,
  attempt_count bigint,
  total_time_seconds bigint,
  last_attempt_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    MAX(qr.score) as best_score,
    COUNT(*) as attempt_count,
    COALESCE(SUM(qr.duration_seconds), 0) as total_time_seconds,
    (SELECT qr2.id FROM quiz_results qr2 
     WHERE qr2.quest_id = p_quest_id AND qr2.user_id = p_user_id 
     ORDER BY qr2.created_at DESC LIMIT 1) as last_attempt_id
  FROM quiz_results qr
  WHERE qr.quest_id = p_quest_id AND qr.user_id = p_user_id;
END;
$$;

-- Get the most missed word for a quest across all students
CREATE OR REPLACE FUNCTION get_quest_most_missed_word(
  p_quest_id uuid
)
RETURNS TABLE(
  word_text text,
  miss_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qrm.word_text,
    COUNT(*) as miss_count
  FROM quiz_result_missed qrm
  JOIN quiz_results qr ON qrm.result_id = qr.id
  WHERE qr.quest_id = p_quest_id
  GROUP BY qrm.word_text
  ORDER BY miss_count DESC
  LIMIT 1;
END;
$$;

-- Reset student progress for a quest (called by teachers)
CREATE OR REPLACE FUNCTION reset_student_quest_progress(
  p_quest_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_teacher_id uuid := auth.uid();
  v_list_id uuid;
BEGIN
  -- Verify the caller is the teacher of this quest's classroom
  IF NOT EXISTS (
    SELECT 1 FROM quests
    JOIN classrooms ON quests.classroom_id = classrooms.id
    WHERE quests.id = p_quest_id
    AND classrooms.teacher_id = v_teacher_id
  ) THEN
    RAISE EXCEPTION 'Not authorized to reset this student''s progress';
  END IF;

  -- Get the list_id for the quest to clear user_missed_words
  SELECT list_id INTO v_list_id FROM quests WHERE id = p_quest_id;

  -- Delete quiz results (cascade deletes quiz_result_missed)
  DELETE FROM quiz_results 
  WHERE quest_id = p_quest_id AND user_id = p_user_id;

  -- Clear quest completion status
  DELETE FROM quest_completions 
  WHERE quest_id = p_quest_id AND user_id = p_user_id;

  -- Clear user_missed_words for this list
  IF v_list_id IS NOT NULL THEN
    DELETE FROM user_missed_words 
    WHERE list_id = v_list_id AND user_id = p_user_id;
  END IF;

  -- Clear quiz_progress for this list
  IF v_list_id IS NOT NULL THEN
    DELETE FROM quiz_progress 
    WHERE list_id = v_list_id AND user_id = p_user_id;
  END IF;
END;
$$;
