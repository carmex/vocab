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
  public currentListType: ListType = ListType.WORD_DEFINITION;
  public currentLanguage: string = 'en';
  public currentMode: 'main' | 'review' = 'main';
  public totalWordsInPass: number = 0;
  public answeredCount: number = 0;
  public correctCount: number = 0;

  constructor(private supabase: SupabaseService) { }

  async startQuiz(listId: string, mode: 'main' | 'review'): Promise<{ listType: ListType }> {
    console.log(`Starting quiz: list=${listId}, mode=${mode}`);
    this.currentListId = listId;
    this.currentMode = mode;
    this.answeredCount = 0;
    this.correctCount = 0;

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
    const options = this.shuffleArray([currentWord.definition, ...distractors]);

    return {
      wordToQuiz: {
        word: currentWord.word,
        definition: currentWord.definition,
        type: '',
        id: currentWord.id,
        imageUrl: currentWord.image_url
      },
      options,
      correctAnswer: currentWord.definition
    };
  }

  // Optimistic Update
  async submitAnswer(wordId: string, isCorrect: boolean) {
    console.log(`[DEBUG] submitAnswer: wordId=${wordId}, isCorrect=${isCorrect}`);
    // 1. Remove from queue immediately (Optimistic UI)
    const index = this.quizQueue.findIndex(w => w.id === wordId);
    if (index > -1) {
      this.quizQueue.splice(index, 1);
    }
    this.answeredCount++;
    if (isCorrect) this.correctCount++;

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

  private getDistractors(target: ListWord): string[] {
    const others = this.fullList.filter(w => w.id !== target.id);
    this.shuffleArray(others);
    return others.slice(0, 3).map(w => w.definition);
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}