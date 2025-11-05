import { Injectable } from '@angular/core';
import { StateService } from './state.service';
import { VocabularyService } from './vocabulary.service';
import { Word } from '../models/word.interface';
import { QuizQuestion } from '../models/quiz-question.interface';
import { AppState } from '../models/app-state.interface';
import { first, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class QuizService {

  private fullWordList: Word[] = [];
  private quizWordPool: Word[] = [];
  
  public totalWordsInPass: number = 0;

  constructor(
    private vocabService: VocabularyService,
    private stateService: StateService
  ) { }

  public async startQuiz(mode: 'main' | 'review'): Promise<void> {
    this.fullWordList = await this.vocabService.getWords().pipe(first()).toPromise() ?? [];
    const state = this.stateService.getCurrentState();
    
    let wordPool: Word[] = [];
    let answeredWords: string[] = [];

    if (mode === 'main') {
      wordPool = [...this.fullWordList];
      answeredWords = state.current_pass_answered;
    } else { // 'review'
      const missedWordNames = state.cumulative_missed;
      wordPool = this.fullWordList.filter(w => missedWordNames.includes(w.word));
      answeredWords = state.review_pass_answered;
    }

    // Filter out words already answered in this pass
    const wordsToQuiz = wordPool.filter(w => !answeredWords.includes(w.word));
    
    this.quizWordPool = this.shuffleArray(wordsToQuiz);
    this.totalWordsInPass = wordPool.length; // Total for this pass
  }

  public getNextQuestion(): QuizQuestion | null {
    if (this.quizWordPool.length === 0) {
      return null;
    }

    const wordToQuiz = this.quizWordPool.pop()!; // Get a word from the shuffled list
    const correctAnswer = wordToQuiz.definition;

    // Get 3 random distractor definitions
    const distractors: string[] = [];
    const allDefinitions = this.fullWordList.map(w => w.definition);
    
    while (distractors.length < 3) {
      const randDef = allDefinitions[Math.floor(Math.random() * allDefinitions.length)];
      if (randDef !== correctAnswer && !distractors.includes(randDef)) {
        distractors.push(randDef);
      }
    }

    const options = this.shuffleArray([correctAnswer, ...distractors]);

    return {
      wordToQuiz,
      options,
      correctAnswer
    };
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}