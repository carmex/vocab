-- Drop the old constraint
ALTER TABLE word_lists DROP CONSTRAINT IF EXISTS word_lists_list_type_check;

-- Add the new constraint including 'sentences'
ALTER TABLE word_lists ADD CONSTRAINT word_lists_list_type_check 
CHECK (list_type IN ('word_definition', 'image_definition', 'sight_words', 'math', 'sentences'));
