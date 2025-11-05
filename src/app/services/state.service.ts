import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { AppState } from '../models/app-state.interface';
import { QuizSummary } from '../models/quiz-summary.interface';
import { Word } from '../models/word.interface';
import { AlertDialogComponent } from '../components/dialogs/alert-dialog/alert-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private readonly STORAGE_KEY = 'vocab_app_state';

  private readonly initialState: AppState = {
    current_pass_answered: [],
    cumulative_missed: [],
    review_pass_answered: [],
    review_pass_correct: [],
    session_missed_main: [],
    session_missed_review: [],
  };

  private state$: BehaviorSubject<AppState>;

  // Public Observables for components to consume
  public currentPassAnswered$: Observable<string[]>;
  public cumulativeMissed$: Observable<string[]>;
  public reviewPassAnswered$: Observable<string[]>;
  public reviewPassCorrect$: Observable<string[]>;
  public sessionMissedMain$: Observable<string[]>;
  public sessionMissedReview$: Observable<string[]>;
  public hasQuizInProgress$: Observable<boolean>;
  public hasMissedWords$: Observable<boolean>;
  public hasReviewInProgress$: Observable<boolean>;
  public isReturningUser$: BehaviorSubject<boolean>;

  // Add this new BehaviorSubject
  public lastSummary$ = new BehaviorSubject<QuizSummary | null>(null);

  // Inject MatDialog in constructor
  constructor(private dialog: MatDialog) {
    const savedState = this.loadState();
    this.state$ = new BehaviorSubject<AppState>(savedState);

    // Initialize public observables
    this.currentPassAnswered$ = this.state$.pipe(map(s => s.current_pass_answered));
    this.cumulativeMissed$ = this.state$.pipe(map(s => s.cumulative_missed));
    this.reviewPassAnswered$ = this.state$.pipe(map(s => s.review_pass_answered));
    this.reviewPassCorrect$ = this.state$.pipe(map(s => s.review_pass_correct));
    this.sessionMissedMain$ = this.state$.pipe(map(s => s.session_missed_main));
    this.sessionMissedReview$ = this.state$.pipe(map(s => s.session_missed_review));
    
    this.hasQuizInProgress$ = this.currentPassAnswered$.pipe(map(list => list.length > 0));
    this.hasMissedWords$ = this.cumulativeMissed$.pipe(map(list => list.length > 0));
    this.hasReviewInProgress$ = this.reviewPassAnswered$.pipe(map(list => list.length > 0));
    this.isReturningUser$ = new BehaviorSubject<boolean>(localStorage.getItem(this.STORAGE_KEY) !== null);
  }

  // --- Private Methods ---

  private loadState(): AppState {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Basic validation and migration for new properties
        if (parsed.current_pass_answered && parsed.cumulative_missed && parsed.review_pass_answered && parsed.review_pass_correct) {
          // Add new fields if they don't exist
          parsed.session_missed_main = parsed.session_missed_main || [];
          parsed.session_missed_review = parsed.session_missed_review || [];
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to load state from localStorage", e);
    }
    return { ...this.initialState };
  }

  private saveState(state: AppState) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
      this.isReturningUser$.next(true);
    } catch (e) {
      console.error("Failed to save state to localStorage", e);
    }
  }

  // --- Public Methods ---

  /**
   * Processes a user's answer, updates state, and saves.
   * This is the core logic method.
   */
  public answerWord(word: Word, isCorrect: boolean, quizMode: 'main' | 'review', totalWordsInPass: number) {
    const state = this.getCurrentState();
    const wordName = word.word;
    
    let newPassAnswered: string[];
    let newCorrectAnswered: string[] = [...state.review_pass_correct];
    let newCumulativeMissed: string[] = [...state.cumulative_missed];
    let newSessionMissedMain: string[] = [...state.session_missed_main];
    let newSessionMissedReview: string[] = [...state.session_missed_review];

    if (quizMode === 'main') {
      newPassAnswered = [...state.current_pass_answered, wordName];
    } else { // 'review' mode
      newPassAnswered = [...state.review_pass_answered, wordName];
      if (isCorrect) {
        newCorrectAnswered.push(wordName);
      }
    }

    if (!isCorrect) {
      if (!newCumulativeMissed.includes(wordName)) {
        newCumulativeMissed.push(wordName);
      }
      if (quizMode === 'main' && !newSessionMissedMain.includes(wordName)) {
        newSessionMissedMain.push(wordName);
      } else if (quizMode === 'review' && !newSessionMissedReview.includes(wordName)) {
        newSessionMissedReview.push(wordName);
      }
    }
    
    const isPassComplete = newPassAnswered.length === totalWordsInPass;
    let newState: AppState;

    if (isPassComplete) {
      let correctCount = 0;
      let missedCount = 0;
      
      if (quizMode === 'main') {
        missedCount = newSessionMissedMain.length;
        correctCount = totalWordsInPass - missedCount;
        
        this.lastSummary$.next({
          total: totalWordsInPass,
          correct: correctCount,
          missed: missedCount,
          score: (correctCount / totalWordsInPass) * 100,
          quizMode: 'main'
        });
        
        // Set state for clearing pass
        newState = {
          ...state,
          cumulative_missed: newCumulativeMissed,
          current_pass_answered: [], // CLEAR
          session_missed_main: [], // CLEAR
          // Persist review lists
          review_pass_answered: state.review_pass_answered,
          review_pass_correct: state.review_pass_correct,
          session_missed_review: state.session_missed_review,
        };
        
      } else { // 'review' mode
        correctCount = newCorrectAnswered.length;
        missedCount = totalWordsInPass - correctCount;
        
        this.lastSummary$.next({
          total: totalWordsInPass,
          correct: correctCount,
          missed: missedCount,
          score: (correctCount / totalWordsInPass) * 100,
          quizMode: 'review'
        });
        
        // Set state for clearing pass, but keep review_pass_correct for summary screen
        newState = {
           ...state,
          cumulative_missed: newCumulativeMissed,
          review_pass_answered: [], // CLEAR
          session_missed_review: [], // CLEAR
          review_pass_correct: newCorrectAnswered, // KEEP THIS for summary screen
          // Persist main lists
          current_pass_answered: state.current_pass_answered,
          session_missed_main: state.session_missed_main,
        };
      }
    } else {
      // Not pass complete, just update lists
      newState = {
        current_pass_answered: (quizMode === 'main') ? newPassAnswered : state.current_pass_answered,
        cumulative_missed: newCumulativeMissed,
        review_pass_answered: (quizMode === 'review') ? newPassAnswered : state.review_pass_answered,
        review_pass_correct: newCorrectAnswered,
        session_missed_main: (quizMode === 'main') ? newSessionMissedMain : state.session_missed_main,
        session_missed_review: (quizMode === 'review') ? newSessionMissedReview : state.session_missed_review
      };
    }
    
    this.state$.next(newState);
    this.saveState(newState);
  }

  public clearCurrentPass() {
    const state = this.getCurrentState();
    // Clear pass list AND session missed list
    const newState = { ...state, current_pass_answered: [], session_missed_main: [] };
    this.state$.next(newState);
    this.saveState(newState);
  }

  public clearReviewPass() {
    const state = this.getCurrentState();
    // Clear pass list, correct list, AND session missed list
    const newState = { ...state, review_pass_answered: [], review_pass_correct: [], session_missed_review: [] };
    this.state$.next(newState);
    this.saveState(newState);
  }

  public clearCorrectedFromCumulative() {
    const state = this.getCurrentState();
    const correctWords = state.review_pass_correct;
    const newCumulativeMissed = state.cumulative_missed.filter(word => !correctWords.includes(word));
    
    const newState = {
      ...state,
      cumulative_missed: newCumulativeMissed,
      review_pass_answered: [],
      review_pass_correct: [],
      session_missed_review: [] // Clear this too
    };
    this.state$.next(newState);
    this.saveState(newState);
  }

  // Method to get the current state value (for non-observable logic)
  public getCurrentState(): AppState {
    return this.state$.getValue();
  }

  // --- Import / Export Methods ---

  public exportState() {
    try {
      const state = this.getCurrentState();
      const json = JSON.stringify(state, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vocab_progress.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to export state", e);
      this.showDialog('Export Failed', 'An unknown error occurred while exporting your progress.');
    }
  }

  public importState(file: File) {
    if (!file || file.type !== 'application/json') {
      this.showDialog('Import Failed', 'Invalid file type. Please select a .json file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const importedState = JSON.parse(text);
        
        // Validate the imported state
        if (
          importedState.current_pass_answered !== undefined &&
          importedState.cumulative_missed !== undefined &&
          importedState.review_pass_answered !== undefined &&
          importedState.review_pass_correct !== undefined
        ) {
          // Check for session_missed properties and add if missing (for backward compatibility)
          const finalState: AppState = {
            current_pass_answered: importedState.current_pass_answered,
            cumulative_missed: importedState.cumulative_missed,
            review_pass_answered: importedState.review_pass_answered,
            review_pass_correct: importedState.review_pass_correct,
            session_missed_main: importedState.session_missed_main || [],
            session_missed_review: importedState.session_missed_review || []
          };
          
          this.state$.next(finalState); // Overwrite state
          this.saveState(finalState);     // Save to localStorage
          this.showDialog('Import Successful', 'Your progress has been loaded.');
        } else {
          throw new Error('Invalid file structure.');
        }
      } catch (err) {
        this.showDialog('Import Failed', 'The selected file is not valid JSON or has an incorrect format.');
      }
    };
    reader.onerror = () => {
      this.showDialog('Import Failed', 'Could not read the selected file.');
    };
    reader.readAsText(file);
  }

  private showDialog(title: string, message: string) {
    this.dialog.open(AlertDialogComponent, {
      data: { title, message }
    });
  }

  /**
   * Manually adds a word to the cumulative missed list.
   * Used when users want to study a word they got correct.
   */
  public addToMissedWords(word: Word): void {
    const state = this.getCurrentState();
    const wordName = word.word;
    
    if (!state.cumulative_missed.includes(wordName)) {
      const newState = {
        ...state,
        cumulative_missed: [...state.cumulative_missed, wordName]
      };
      
      this.state$.next(newState);
      this.saveState(newState);
    }
  }
}