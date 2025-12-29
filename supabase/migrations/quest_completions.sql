-- Create Quest Completions Table
CREATE TABLE IF NOT EXISTS quest_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id uuid REFERENCES quests(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  completed_at timestamptz DEFAULT now(),
  score integer, -- Optional percentage or raw score
  
  -- Ensure one completion per quest per user (for now, unless we want to track attempts)
  -- If we want multiple attempts, we might want a separate attempts table or just PK on id.
  -- For MVP: One completion record "status". If they play again, maybe we value update it? 
  -- Or just let them duplicate?
  -- Requirement says "The card is now marked 'Completed'".
  -- Let's stick to unique completion for simplicity of querying status.
  CONSTRAINT unique_quest_completion UNIQUE (quest_id, user_id)
);

-- Enable RLS
ALTER TABLE quest_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own completions
DROP POLICY IF EXISTS "Users can view own completions" ON quest_completions;
CREATE POLICY "Users can view own completions" ON quest_completions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own completions (when they finish a quest)
DROP POLICY IF EXISTS "Users can record completion" ON quest_completions;
CREATE POLICY "Users can record completion" ON quest_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Teachers can view completions for quests in their classes
DROP POLICY IF EXISTS "Teachers can view class completions" ON quest_completions;
CREATE POLICY "Teachers can view class completions" ON quest_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quests
      JOIN classrooms ON quests.classroom_id = classrooms.id
      WHERE quests.id = quest_completions.quest_id
      AND classrooms.teacher_id = auth.uid()
    )
  );
