import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { QuizQuestion } from '../models/quiz-question.interface';
import { ListType } from '../models/list-type.enum';

interface ListWord {
  id: string;
  word: string;
  definition: string;
  image_url?: string;
}

interface QuizProgress {
  state: {
    answered_ids: string[];
    incorrect_ids: string[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private quizQueue: ListWord[] = [];
  private fullList: ListWord[] = [];

  // Current Session State
  public currentListId: string = '';
  public currentQuestId: string | null = null; // For gradebook tracking
  public currentListType: ListType = ListType.WORD_DEFINITION;
  public currentLanguage: string = 'en';
  public currentMode: 'main' | 'review' = 'main';
  public totalWordsInPass: number = 0;
  public answeredCount: number = 0;
  public correctCount: number = 0;

  // Tracking for quiz results
  private startTime: number | null = null;
  private missedWordIds: string[] = [];
  private missedWords: { id: string; word: string }[] = [];

  constructor(private supabase: SupabaseService) { }

  async startQuiz(listId: string, mode: 'main' | 'review', questId?: string | null): Promise<{ listType: ListType }> {
    console.log(`Starting quiz: list=${listId}, mode=${mode}, questId=${questId}`);
    this.currentListId = listId;
    this.currentQuestId = questId || null;
    this.currentMode = mode;
    this.answeredCount = 0;
    this.correctCount = 0;
    this.startTime = Date.now();
    this.missedWordIds = [];
    this.missedWords = [];

    // If starting a quest, check if we should clear stale progress
    // This handles the case where the same list was assigned to a different quest before
    if (questId && mode === 'main') {
      await this.clearStaleProgressIfNeeded(listId, questId);
    }

    // Fetch list type and language first
    const { data: listData, error: listError } = await this.supabase.client
      .from('word_lists')
      .select('list_type, language')
      .eq('id', listId)
      .single();

    if (listError) throw listError;
    this.currentListType = (listData?.list_type as ListType) || ListType.WORD_DEFINITION;
    this.currentLanguage = listData?.language || 'en';

    // 1. Fetch all words for the list
    const { data: words, error: wordsError } = await this.supabase.client
      .from('list_words')
      .select('*')
      .eq('list_id', listId);

    if (wordsError) throw wordsError;
    this.fullList = words || [];

    // 2. Fetch progress
    const { data: progress, error: progressError } = await this.supabase.client
      .from('quiz_progress')
      .select('state')
      .eq('list_id', listId)
      .eq('pass_type', mode)
      .maybeSingle();

    if (progressError) throw progressError;

    const answeredIds = (progress?.state as any)?.answered_ids || [];
    const incorrectIds = (progress?.state as any)?.incorrect_ids || [];

    // Restore counts
    this.answeredCount = answeredIds.length;
    this.correctCount = answeredIds.length - incorrectIds.length;
    console.log(`[DEBUG] Restored progress: answered=${this.answeredCount}, correct=${this.correctCount}`);

    // 3. Filter Queue
    if (mode === 'main') {
      this.quizQueue = this.fullList.filter(w => !answeredIds.includes(w.id));
    } else {
      // Review Mode: Fetch missed words
      const { data: missed } = await this.supabase.client
        .from('user_missed_words')
        .select('word_id')
        .eq('list_id', listId);

      const missedIds = missed?.map((m: any) => m.word_id) || [];
      console.log(`Review mode: found ${missedIds.length} missed words`);

      this.quizQueue = this.fullList
        .filter(w => missedIds.includes(w.id))
        .filter(w => !answeredIds.includes(w.id));
    }

    console.log(`Quiz queue length: ${this.quizQueue.length}`);
    this.totalWordsInPass = this.quizQueue.length + answeredIds.length;
    this.shuffleArray(this.quizQueue);

    return { listType: this.currentListType };
  }

  getNextQuestion(): QuizQuestion | null {
    if (this.quizQueue.length === 0) return null;

    const currentWord = this.quizQueue[0]; // Peek, don't pop yet (wait for answer)

    // Generate Options
    const distractors = this.getDistractors(currentWord);
    // For Sight Words and Sentences, the answer is the word itself. For Defs, it's the definition.
    const answer = (this.currentListType === ListType.SIGHT_WORDS || this.currentListType === ListType.SENTENCES) ? currentWord.word : currentWord.definition;

    // For Sight Words, options are words. For Defs, options are definitions.
    const options = this.shuffleArray([answer, ...distractors]);

    return {
      wordToQuiz: {
        word: currentWord.word,
        definition: currentWord.definition,
        type: '',
        id: currentWord.id,
        imageUrl: currentWord.image_url
      },
      options,
      correctAnswer: answer
    };
  }

  getRemainingWords(): string[] {
    return this.quizQueue.map(w => w.word);
  }

  // Optimistic Update
  async submitAnswer(wordId: string, isCorrect: boolean, wordText?: string) {
    console.log(`[DEBUG] submitAnswer: wordId=${wordId}, isCorrect=${isCorrect}`);
    // 1. Remove from queue immediately (Optimistic UI)
    const wordIndex = this.quizQueue.findIndex(w => w.id === wordId);
    const word = wordIndex > -1 ? this.quizQueue[wordIndex] : null;
    if (wordIndex > -1) {
      this.quizQueue.splice(wordIndex, 1);
    }
    this.answeredCount++;
    if (isCorrect) {
      this.correctCount++;
    } else {
      // Track missed word for gradebook
      const missedWordText = wordText || word?.word || '';
      this.missedWordIds.push(wordId);
      this.missedWords.push({ id: wordId, word: missedWordText });
    }

    // 2. Background RPC Call
    const payload = {
      p_list_id: this.currentListId,
      p_pass_type: this.currentMode,
      p_word_id: wordId,
      p_is_correct: isCorrect
    };
    console.log('[DEBUG] Calling update_quiz_progress with:', payload);

    const { error } = await this.supabase.client.rpc('update_quiz_progress', payload);

    if (error) {
      console.error('[DEBUG] Failed to save progress', error);
      // In a real app, we might revert the UI state or show a toast
    } else {
      console.log('[DEBUG] Progress saved successfully');
    }
  }

  async finishPass(clearMissed: boolean = false) {
    console.log(`Finishing pass: mode=${this.currentMode}, clearMissed=${clearMissed}`);

    // If clearMissed is requested, do it explicitly via client-side delete
    if (clearMissed) {
      await this.clearMissedWords(this.currentListId);
    }

    // Call RPC to finish pass (reset progress, log session)
    // We pass false for p_clear_missed to avoid double-clearing or RPC bugs
    const { error } = await this.supabase.client.rpc('finish_quiz_pass', {
      p_list_id: this.currentListId,
      p_pass_type: this.currentMode,
      p_clear_missed: false
    });

    if (error) throw error;
  }

  async clearMissedWords(listId: string) {
    // Fetch current progress to identify corrected words
    const { data: progress } = await this.supabase.client
      .from('quiz_progress')
      .select('state')
      .eq('list_id', listId)
      .eq('pass_type', 'review')
      .maybeSingle();

    if (!progress) return;

    const answeredIds = (progress.state as any)?.answered_ids || [];
    const incorrectIds = (progress.state as any)?.incorrect_ids || [];

    // Correctly answered words in this pass
    const correctedIds = answeredIds.filter((id: string) => !incorrectIds.includes(id));

    if (correctedIds.length > 0) {
      console.log(`Clearing ${correctedIds.length} corrected words from missed list`);
      const { error } = await this.supabase.client
        .from('user_missed_words')
        .delete()
        .eq('list_id', listId)
        .in('word_id', correctedIds);

      if (error) throw error;
    }
  }

  /**
   * Save quiz result to database for gradebook tracking.
   * Should be called when a quiz pass is completed in the context of a quest.
   */
  async saveQuizResult(): Promise<void> {
    // Only save if we have a quest context
    if (!this.currentQuestId) {
      console.log('[DEBUG] No questId, skipping quiz result save');
      return;
    }

    const scorePercent = this.totalWordsInPass > 0
      ? Math.round((this.correctCount / this.totalWordsInPass) * 100)
      : 0;

    const durationSeconds = this.startTime
      ? Math.round((Date.now() - this.startTime) / 1000)
      : null;

    console.log(`[DEBUG] Saving quiz result: score=${scorePercent}%, duration=${durationSeconds}s, missed=${this.missedWords.length}`);

    try {
      // Get current user ID for RLS
      const userId = (await this.supabase.client.auth.getUser()).data.user?.id;
      if (!userId) {
        console.error('[DEBUG] No user ID available for saving quiz result');
        return;
      }

      // Insert quiz result
      const { data: resultData, error: resultError } = await this.supabase.client
        .from('quiz_results')
        .insert({
          quest_id: this.currentQuestId,
          user_id: userId,
          score: scorePercent,
          total_words: this.totalWordsInPass,
          correct_count: this.correctCount,
          duration_seconds: durationSeconds
        })
        .select('id')
        .single();

      if (resultError) {
        console.error('[DEBUG] Error saving quiz result:', resultError);
        return;
      }

      // Insert missed words if any
      if (this.missedWords.length > 0 && resultData?.id) {
        const missedInserts = this.missedWords.map(mw => ({
          result_id: resultData.id,
          word_id: mw.id,
          word_text: mw.word
        }));

        const { error: missedError } = await this.supabase.client
          .from('quiz_result_missed')
          .insert(missedInserts);

        if (missedError) {
          console.error('[DEBUG] Error saving missed words:', missedError);
        }
      }

      console.log('[DEBUG] Quiz result saved successfully');
    } catch (err) {
      console.error('[DEBUG] Error in saveQuizResult:', err);
    }
  }

  private getDistractors(target: ListWord): string[] {
    const isSightWordLike = this.currentListType === ListType.SIGHT_WORDS || this.currentListType === ListType.SENTENCES;

    // 1. Filter out words that have the SAME answer as the target
    const validCandidates = this.fullList.filter(w => {
      if (w.id === target.id) return false;
      if (isSightWordLike) {
        return w.word !== target.word;
      } else {
        return w.definition !== target.definition;
      }
    });

    this.shuffleArray(validCandidates);

    // 2. Select unique answers
    const selectedAnswers = new Set<string>();
    const distractors: string[] = [];

    for (const candidate of validCandidates) {
      const answer = isSightWordLike ? candidate.word : candidate.definition;
      if (!selectedAnswers.has(answer)) {
        selectedAnswers.add(answer);
        distractors.push(answer);
        if (distractors.length >= 3) break;
      }
    }

    return distractors;
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Check if this is a fresh quest start (no completion record) and clear stale progress.
   * This handles the case where the same list was assigned to a different quest before,
   * or the quest was deleted and reassigned.
   */
  private async clearStaleProgressIfNeeded(listId: string, questId: string): Promise<void> {
    const userId = (await this.supabase.client.auth.getUser()).data.user?.id;
    if (!userId) return;

    // Check if there's already a quiz_result for THIS quest (not just this list)
    const { data: existingResult } = await this.supabase.client
      .from('quiz_results')
      .select('id')
      .eq('quest_id', questId)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    // If user has already attempted THIS specific quest, keep progress (resume mode)
    if (existingResult) {
      console.log('[DEBUG] User has existing quiz_results for this quest, keeping progress');
      return;
    }

    // No prior attempt for this quest - clear any stale progress from previous quests
    console.log('[DEBUG] Fresh quest start - clearing stale quiz_progress for list');

    const { error } = await this.supabase.client
      .from('quiz_progress')
      .delete()
      .eq('list_id', listId)
      .eq('user_id', userId);

    if (error) {
      console.error('[DEBUG] Error clearing stale progress:', error);
    }
  }
}