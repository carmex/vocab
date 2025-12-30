-- Add UPDATE policy for quest_completions to support upsert
-- Users can update their own completions (for repeat attempts)

DROP POLICY IF EXISTS "Users can update own completions" ON quest_completions;
CREATE POLICY "Users can update own completions" ON quest_completions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
