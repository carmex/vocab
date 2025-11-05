We are building an Angular vocabulary study app using Angular Material. Please follow each step precisely.

**Step 1: Project Setup and Angular Material**

1.  Create a new Angular project named `vocab` in the current project directory with SCSS and standalone components set to `false` (we will use modules).
2.  Add Angular Material to the project, selecting the "Indigo/Pink" theme and setting up browser animations.
3.  Create a new module `shared-material.module.ts`.
4.  In this module, import and export the following Angular Material modules:
    * `MatButtonModule`
    * `MatProgressBarModule`
    * `MatDialogModule`
5.  Import the `SharedMaterialModule` and `HttpClientModule` into `app.module.ts`.
6.  Replace the content of `app.component.html` with just `<router-outlet></router-outlet>`.


**Step 2: Data Structures and Vocabulary Service**

1.  Create `src/assets/words.json`. Populate it with this example data:
    ```json
    [
      {
        "word": "abase",
        "type": "v.",
        "definition": "To lower in position, estimation, or the like; degrade."
      },
      {
        "word": "abbess",
        "type": "n.",
        "definition": "The lady superior of a nunnery."
      },
      {
        "word": "abbey",
        "type": "n.",
        "definition": "The group of buildings which collectively form the dwelling-place of a society of monks or nuns."
      },
      {
        "word": "abbreviate",
        "type": "v.",
        "definition": "To make shorter."
      },
      {
        "word": "abdicate",
        "type": "v.",
        "definition": "To give up (royal power or the like)."
      },
      {
        "word": "aberration",
        "type": "n.",
        "definition": "A deviation from the normal or typical."
      },
      {
        "word": "abet",
        "type": "v.",
        "definition": "To aid, promote, or encourage the commission of (an offense)."
      },
      {
        "word": "abeyance",
        "type": "n.",
        "definition": "A state of suspension or temporary inaction."
      }
    ]
    ```
2.  Create `src/app/models/word.interface.ts`:
    ```typescript
    export interface Word {
      word: string;
      type: string;
      definition: string;
    }
    ```
3.  Create `src/app/models/app-state.interface.ts`:
    ```typescript
    export interface AppState {
      current_pass_answered: string[];
      cumulative_missed: string[];
      review_pass_answered: string[];
      review_pass_correct: string[];
    }
    ```
4.  Generate a service `src/app/services/vocabulary.service.ts`.
5.  In `VocabularyService`, inject `HttpClient`. Create a method `getWords(): Observable<Word[]>` that performs an HTTP GET request for `/assets/words.json` and caches the result using `shareReplay(1)`.


**Step 3: Core State Management Service**

1.  Generate a service `src/app/services/state.service.ts`.
2.  This service will manage loading and saving state to `localStorage`.
3.  Implement the following in `state.service.ts`:

    ```typescript
    import { Injectable } from '@angular/core';
    import { BehaviorSubject, Observable } from 'rxjs';
    import { map } from 'rxjs/operators';
    import { AppState } from '../models/app-state.interface';

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
      };

      private state$: BehaviorSubject<AppState>;

      // Public Observables for components to consume
      public currentPassAnswered$: Observable<string[]>;
      public cumulativeMissed$: Observable<string[]>;
      public reviewPassAnswered$: Observable<string[]>;
      public reviewPassCorrect$: Observable<string[]>;
      public hasQuizInProgress$: Observable<boolean>;
      public hasMissedWords$: Observable<boolean>;
      public hasReviewInProgress$: Observable<boolean>;
      public isReturningUser$: Observable<boolean>;

      constructor() {
        const savedState = this.loadState();
        this.state$ = new BehaviorSubject<AppState>(savedState);

        // Initialize public observables
        this.currentPassAnswered$ = this.state$.pipe(map(s => s.current_pass_answered));
        this.cumulativeMissed$ = this.state$.pipe(map(s => s.cumulative_missed));
        this.reviewPassAnswered$ = this.state$.pipe(map(s => s.review_pass_answered));
        this.reviewPassCorrect$ = this.state$.pipe(map(s => s.review_pass_correct));
        
        this.hasQuizInProgress$ = this.currentPassAnswered$.pipe(map(list => list.length > 0));
        this.hasMissedWords$ = this.cumulativeMissed$.pipe(map(list => list.length > 0));
        this.hasReviewInProgress$ = this.reviewPassAnswered$.pipe(map(list => list.length > 0));
        this.isReturningUser$ = new BehaviorSubject<boolean>(this.loadState() !== this.initialState);
      }

      // --- Private Methods ---

      private loadState(): AppState {
        try {
          const saved = localStorage.getItem(this.STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            // Basic validation
            if (parsed.current_pass_answered && parsed.cumulative_missed && parsed.review_pass_answered && parsed.review_pass_correct) {
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

      // --- Public Methods (to be added later) ---
      
      // Method to get the current state value (for non-observable logic)
      public getCurrentState(): AppState {
        return this.state$.getValue();
      }
    }
    ```
	
**Step 4: App Routing and Placeholder Components**

1.  Generate `app-routing.module.ts`.
2.  Generate the following components:
    * `components/main-menu/main-menu.component`
    * `components/quiz/quiz.component`
    * `components/summary/summary.component`
3.  Add `MainMenuComponent`, `QuizComponent`, and `SummaryComponent` to the `declarations` in `app.module.ts`.
4.  Set up `app-routing.module.ts` with the following routes:

    ```typescript
    import { NgModule } from '@angular/core';
    import { RouterModule, Routes } from '@angular/router';
    import { MainMenuComponent } from './components/main-menu/main-menu.component';
    import { QuizComponent } from './components/quiz/quiz.component';
    import { SummaryComponent } from './components/summary/summary.component';

    const routes: Routes = [
      { path: 'menu', component: MainMenuComponent },
      { path: 'quiz/:mode', component: QuizComponent }, // :mode will be 'main' or 'review'
      { path: 'summary', component: SummaryComponent },
      { path: '', redirectTo: '/menu', pathMatch: 'full' },
      { path: '**', redirectTo: '/menu' }
    ];

    @NgModule({
      imports: [RouterModule.forRoot(routes)],
      exports: [RouterModule]
    })
    export class AppRoutingModule { }
    ```
5.  Import `AppRoutingModule` into `app.module.ts`.


**Step 5: Build Main Menu Component**

1.  Update `main-menu.component.ts` to inject `StateService` and expose its observables to the template.

    ```typescript
    import { Component } from '@angular/core';
    import { StateService } from '../../services/state.service';

    @Component({
      selector: 'app-main-menu',
      templateUrl: './main-menu.component.html',
      styleUrls: ['./main-menu.component.scss']
    })
    export class MainMenuComponent {
      // Expose observables for the template
      hasQuizInProgress$ = this.stateService.hasQuizInProgress$;
      hasMissedWords$ = this.stateService.hasMissedWords$;
      hasReviewInProgress$ = this.stateService.hasReviewInProgress$;
      isReturningUser$ = this.stateService.isReturningUser$;

      constructor(private stateService: StateService) { }
    }
    ```
2.  Update `main-menu.component.html` to display the conditional buttons.

    ```html
    <div class="menu-container">
      <button *ngIf="(hasQuizInProgress$ | async) === false; else continueQuiz" mat-raised-button color="primary" class="menu-button green" routerLink="/quiz/main">
        Start Quiz
      </button>
      <ng-template #continueQuiz>
        <button mat-raised-button color="primary" class="menu-button green" routerLink="/quiz/main">
          Continue Quiz
        </button>
      </ng-template>

      <ng-container *ngIf="hasMissedWords$ | async">
        <button *ngIf="(hasReviewInProgress$ | async) === false; else continueReview" mat-raised-button color="accent" class="menu-button yellow" routerLink="/quiz/review">
          Review Missed Words
        </button>
        <ng-template #continueReview>
          <button mat-raised-button color="accent" class="menu-button yellow" routerLink="/quiz/review">
            Continue Missed Words
          </button>
        </ng-template>
      </ng-container>

      <button mat-raised-button class="menu-button blue">
        Import Progress
      </button>
      <button *ngIf="isReturningUser$ | async" mat-raised-button color="warn" class="menu-button gray">
        Export Progress
      </button>
    </div>
    ```
3.  Add styles in `main-menu.component.scss`.

    ```scss
    .menu-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 20px;
      gap: 15px;
      max-width: 500px;
      margin: 40px auto;
    }

    .menu-button {
      width: 100%;
      min-height: 60px;
      font-size: 1.2rem;
      border-radius: 12px;
      // We will use standard Material colors for now and override later if needed.
      // Custom colors require more setup. Let's use `color` attribute.
    }
    
    // Override Material button colors based on spec
    .green {
      background-color: #4CAF50; // Green
      color: white;
    }
    
    .yellow {
      background-color: #FFEB3B; // Yellow
      color: #333;
    }
    
    .blue {
      background-color: #2196F3; // Blue
      color: white;
    }
    
    .gray {
      background-color: #9E9E9E; // Gray
      color: white;
    }
    ```
*(Self-correction: Using `color="primary"` and `class="green"` is redundant. Let's simplify the HTML and just use the classes.)*

Update `main-menu.component.html` again to remove the `color` attributes, as the CSS classes are handling it:

```html
<div class="menu-container">
  <button *ngIf="(hasQuizInProgress$ | async) === false; else continueQuiz" mat-raised-button class="menu-button green" routerLink="/quiz/main">
    Start Quiz
  </button>
  <ng-template #continueQuiz>
    <button mat-raised-button class="menu-button green" routerLink="/quiz/main">
      Continue Quiz
    </button>
  </ng-template>

  <ng-container *ngIf="hasMissedWords$ | async">
    <button *ngIf="(hasReviewInProgress$ | async) === false; else continueReview" mat-raised-button class="menu-button yellow" routerLink="/quiz/review">
      Review Missed Words
    </button>
    <ng-template #continueReview>
      <button mat-raised-button class="menu-button yellow" routerLink="/quiz/review">
        Continue Missed Words
      </button>
    </ng-template>
  </ng-container>

  <button mat-raised-button class="menu-button blue" id="import-btn">
    Import Progress
  </button>
  <button *ngIf="isReturningUser$ | async" mat-raised-button class="menu-button gray" id="export-btn">
    Export Progress
  </button>
</div>
```

**Step 6: State Service (Mutation Logic)**

1.  Create `src/app/models/quiz-summary.interface.ts`:
    ```typescript
    export interface QuizSummary {
      total: number;
      correct: number;
      missed: number;
      score: number;
      quizMode: 'main' | 'review';
    }
    ```
2.  Update `state.service.ts` to add the state mutation logic. We will add the new properties and methods.

    ```typescript
    // Add these imports at the top
    import { MatDialog } from '@angular/material/dialog';
    import { QuizSummary } from '../models/quiz-summary.interface';
    import { Word } from '../models/word.interface';
    // Add this import as well (will be used for dialogs)
    import { AlertDialogComponent } from '../components/dialogs/alert-dialog/alert-dialog.component';


    // ... inside StateService class ...

    // Add this new BehaviorSubject
    public lastSummary$ = new BehaviorSubject<QuizSummary | null>(null);

    // Inject MatDialog in constructor
    constructor(private dialog: MatDialog) {
      // ... existing constructor code ...
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
      }
      
      const isPassComplete = newPassAnswered.length === totalWordsInPass;
      let correctCount = 0;

      if (isPassComplete) {
        // Calculate summary and clear pass list
        if (quizMode === 'main') {
          // For main quiz, we need to diff against the full list, which is complex.
          // Let's defer session stat tracking. The spec only tracks *missed* count.
          // Let's add a simple session missed count.
          // TODO: Add session missed count
          this.lastSummary$.next({
            total: totalWordsInPass,
            correct: 0, // TODO
            missed: 0, // TODO
            score: 0, // TODO
            quizMode: 'main'
          });
          this.clearCurrentPass(); // Clear as soon as last question is answered
        } else { // 'review' mode
          correctCount = newCorrectAnswered.length;
          const missedCount = totalWordsInPass - correctCount;
          this.lastSummary$.next({
            total: totalWordsInPass,
            correct: correctCount,
            missed: missedCount,
            score: (correctCount / totalWordsInPass) * 100,
            quizMode: 'review'
          });
          this.clearReviewPass(); // Clear as soon as last question is answered
        }
      }

      // Commit the new state
      this.state$.next({
        current_pass_answered: (quizMode === 'main' && !isPassComplete) ? newPassAnswered : state.current_pass_answered,
        cumulative_missed: newCumulativeMissed,
        review_pass_answered: (quizMode === 'review' && !isPassComplete) ? newPassAnswered : state.review_pass_answered,
        review_pass_correct: newCorrectAnswered
      });
      
      this.saveState(this.state$.getValue());
    }

    public clearCurrentPass() {
      const state = this.getCurrentState();
      this.state$.next({ ...state, current_pass_answered: [] });
      this.saveState(this.state$.getValue());
    }
    
    public clearReviewPass() {
      const state = this.getCurrentState();
      this.state$.next({ ...state, review_pass_answered: [], review_pass_correct: [] });
      this.saveState(this.state$.getValue());
    }

    public clearCorrectedFromCumulative() {
      const state = this.getCurrentState();
      const correctWords = state.review_pass_correct;
      const newCumulativeMissed = state.cumulative_missed.filter(word => !correctWords.includes(word));
      
      this.state$.next({
        ...state,
        cumulative_missed: newCumulativeMissed,
        review_pass_answered: [], // Also clear these lists on summary action
        review_pass_correct: []
      });
      this.saveState(this.state$.getValue());
    }
    
    // --- Private Methods (for dialogs, to be used later) ---
    private showDialog(title: string, message: string) {
      this.dialog.open(AlertDialogComponent, {
        data: { title, message }
      });
    }

    // ... (keep existing private methods: loadState, saveState, getCurrentState) ...
    ```

*Refinement:* The spec says the "Second Bar (Red)" tracks words missed *so far in this session*. This requires adding state. Let's add `session_missed_main` and `session_missed_review` arrays to the `AppState`.

**Update `app-state.interface.ts`:**
```typescript
export interface AppState {
  current_pass_answered: string[];
  cumulative_missed: string[];
  review_pass_answered: string[];
  review_pass_correct: string[];
  session_missed_main: string[]; // NEW
  session_missed_review: string[]; // NEW
}
```

Update state.service.ts:

    * Add session_missed_main: [] and session_missed_review: [] to initialState.

    * Update the loadState validation to check for these new properties and add them if they are missing from an older save file.

    * Create public observables: public sessionMissedMain$: Observable<string[]>; public sessionMissedReview$: Observable<string[]>;

    * Initialize them in the constructor: this.sessionMissedMain$ = this.state$.pipe(map(s => s.session_missed_main)); this.sessionMissedReview$ = this.state$.pipe(map(s => s.session_missed_review));

    * Implement the revised answerWord, clearCurrentPass, clearReviewPass, and clearCorrectedFromCumulative methods:

``` typescript
// Add these imports at the top
import { MatDialog } from '@angular/material/dialog';
import { QuizSummary } from '../models/quiz-summary.interface';
import { Word } from '../models/word.interface';
// Add this import as well (will be used for dialogs)
import { AlertDialogComponent } from '../components/dialogs/alert-dialog/alert-dialog.component';

// ... inside StateService class ...

// Add this new BehaviorSubject
public lastSummary$ = new BehaviorSubject<QuizSummary | null>(null);

// Add these new Observables
public sessionMissedMain$: Observable<string[]>;
public sessionMissedReview$: Observable<string[]>;

// Inject MatDialog in constructor
constructor(private dialog: MatDialog) {
  const savedState = this.loadState();
  this.state$ = new BehaviorSubject<AppState>(savedState);

  // Initialize public observables
  this.currentPassAnswered$ = this.state$.pipe(map(s => s.current_pass_answered));
  this.cumulativeMissed$ = this.state$.pipe(map(s => s.cumulative_missed));
  this.reviewPassAnswered$ = this.state$.pipe(map(s => s.review_pass_answered));
  this.reviewPassCorrect$ = this.state$.pipe(map(s => s.review_pass_correct));
  this.sessionMissedMain$ = this.state$.pipe(map(s => s.session_missed_main)); // NEW
  this.sessionMissedReview$ = this.state$.pipe(map(s => s.session_missed_review)); // NEW
  
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

// ... (keep saveState and getCurrentState) ...

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

// --- Private Methods (for dialogs, to be used later) ---
private showDialog(title: string, message: string) {
  // This will be implemented fully in Step 11
  // For now, we just need it to compile
  this.dialog.open(AlertDialogComponent, {
    data: { title, message }
  });
}
```


**Step 7: Quiz Generation Service**

1.  Create `src/app/models/quiz-question.interface.ts`:
    ```typescript
    import { Word } from "./word.interface";
    
    export interface QuizQuestion {
      wordToQuiz: Word;
      options: string[]; // Just the definition strings
      correctAnswer: string; // The correct definition string
    }
    ```
2.  Generate a service `src/app/services/quiz.service.ts`.
3.  Implement the following in `quiz.service.ts`:

    ```typescript
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
    ```
	
	
**Step 8: Quiz Component (UI & Setup)**

1.  Update `quiz.component.html` with the UI layout:
    ```html
    <div class="quiz-container" *ngIf="currentQuestion">
      <div class="progress-bar-container">
        <mat-progress-bar
          mode="determinate"
          [value]="passProgressPercent | async"
        ></mat-progress-bar>
        <div class="progress-label">{{ passProgressCount | async }}</div>
      </div>

      <div class="progress-bar-container red">
        <mat-progress-bar
          mode="determinate"
          color="warn"
          [value]="missedProgressPercent | async"
        ></mat-progress-bar>
        <div class="progress-label">{{ missedProgressCount | async }}</div>
      </div>

      <div class="word-display">
        {{ currentQuestion.wordToQuiz.word }}
      </div>

      <div class="answer-options">
        <button
          *ngFor="let option of currentQuestion.options"
          mat-raised-button
          class="answer-button"
          (click)="!feedbackVisible && onAnswer(option)"
          [ngClass]="{
            'correct': feedbackVisible && option === currentQuestion.correctAnswer,
            'incorrect': feedbackVisible && option === selectedAnswer && option !== currentQuestion.correctAnswer
          }"
        >
          {{ option }}
        </button>
      </div>

      <div class="feedback-controls" *ngIf="feedbackVisible">
        <mat-progress-bar
          mode="determinate"
          [value]="timerProgress"
          [color]="isCorrect ? 'primary' : 'warn'"
          *ngIf="!isPaused"
        ></mat-progress-bar>

        <div class="feedback-buttons">
          <button mat-flat-button (click)="onPause()" *ngIf="!isPaused">Pause</button>
          <button mat-flat-button color="primary" (click)="onNext()">Next</button>
        </div>
      </div>
    </div>
    ```
2.  Add styles in `quiz.component.scss`:
    ```scss
    .quiz-container {
      display: flex;
      flex-direction: column;
      padding: 10px;
      max-width: 600px;
      margin: 0 auto;
    }
    
    .progress-bar-container {
      position: relative;
      width: 100%;
      margin-bottom: 10px;
      
      &.red {
        margin-bottom: 20px;
      }
    
      .mat-progress-bar {
        height: 30px;
        border-radius: 8px;
      }
    
      .progress-label {
        position: absolute;
        width: 100%;
        top: 0;
        left: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 30px;
        font-weight: bold;
        color: #333;
        font-size: 0.9rem;
      }
    }
    
    .word-display {
      font-size: 2.5rem;
      font-weight: bold;
      text-align: center;
      margin: 30px 0;
    }
    
    .answer-options {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .answer-button {
      width: 100%;
      min-height: 50px;
      border-radius: 12px;
      padding: 10px;
      white-space: normal;
      line-height: 1.4;
      font-size: 1rem;
      text-align: left;
      justify-content: flex-start;

      // Feedback Colors
      &.correct {
        background-color: #4CAF50 !important;
        color: white !important;
      }
      &.incorrect {
        background-color: #F44336 !important;
        color: white !important;
      }
    }
    
    .feedback-controls {
      margin-top: 30px;
      .mat-progress-bar {
        height: 10px;
        border-radius: 5px;
      }
      .feedback-buttons {
        display: flex;
        justify-content: space-between;
        margin-top: 10px;
        gap: 10px;

        button {
          flex-grow: 1;
        }
      }
    }
    ```
3.  Update `quiz.component.ts` with the setup logic:
    ```typescript
    import { Component, OnDestroy, OnInit } from '@angular/core';
    import { ActivatedRoute, Router } from '@angular/router';
    import { Observable, Subject } from 'rxjs';
    import { map } from 'rxjs/operators';
    import { QuizQuestion } from '../../models/quiz-question.interface';
    import { QuizService } from '../../services/quiz.service';
    import { StateService } from '../../services/state.service';
    
    @Component({
      selector: 'app-quiz',
      templateUrl: './quiz.component.html',
      styleUrls: ['./quiz.component.scss']
    })
    export class QuizComponent implements OnInit, OnDestroy {
      quizMode: 'main' | 'review' = 'main';
      currentQuestion: QuizQuestion | null = null;
      
      // Feedback UI State
      feedbackVisible = false;
      selectedAnswer: string | null = null;
      isCorrect = false;
      isPaused = false;
      timerProgress = 0;
    
      // Progress Bar Observables
      passProgressPercent!: Observable<number>;
      passProgressCount!: Observable<string>;
      missedProgressPercent!: Observable<number>;
      missedProgressCount!: Observable<string>;
      
      // Will be implemented in the next step
      private timer$: Subject<void> = new Subject();
      private destroy$: Subject<void> = new Subject();
    
      constructor(
        private route: ActivatedRoute,
        private router: Router,
        private quizService: QuizService,
        private stateService: StateService
      ) { }
    
      async ngOnInit(): Promise<void> {
        this.quizMode = this.route.snapshot.paramMap.get('mode') as 'main' | 'review';
        if (!this.quizMode) {
          this.router.navigate(['/menu']);
          return;
        }
    
        await this.quizService.startQuiz(this.quizMode);
        this.setupProgressBars();
        this.displayNextQuestion();
      }
    
      ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.timer$.complete();
      }
    
      private setupProgressBars() {
        const total = this.quizService.totalWordsInPass;
        const answered$ = (this.quizMode === 'main') 
          ? this.stateService.currentPassAnswered$ 
          : this.stateService.reviewPassAnswered$;
          
        const missed$ = (this.quizMode === 'main')
          ? this.stateService.sessionMissedMain$
          : this.stateService.sessionMissedReview$;
    
        this.passProgressPercent = answered$.pipe(
          map(list => (list.length / total) * 100)
        );
        this.passProgressCount = answered$.pipe(
          map(list => `${list.length} / ${total}`)
        );
    
        this.missedProgressPercent = missed$.pipe(
          map(list => (list.length / total) * 100)
        );
        this.missedProgressCount = missed$.pipe(
          map(list => `${list.length} Missed`)
        );
      }
    
      private displayNextQuestion() {
        // Reset feedback state
        this.feedbackVisible = false;
        this.selectedAnswer = null;
        this.isCorrect = false;
        this.isPaused = false;
        this.timerProgress = 0;
        this.timer$.next(); // Stop any active timer
    
        this.currentQuestion = this.quizService.getNextQuestion();
    
        if (this.currentQuestion === null) {
          // Quiz is over
          this.router.navigate(['/summary']);
        }
      }
    
      // --- To be implemented in next step ---
      onAnswer(selectedOption: string) { }
      onNext() { }
      onPause() { }
    }    
    ```
	
	
**Step 9: Quiz Component (Answer & Feedback Flow)**

1.  Update `quiz.component.ts` by adding the answer and feedback logic.
2.  We need to import `timer` and `takeUntil` from `rxjs`.

    ```typescript
    // Add these imports at the top
    import { timer, interval } from 'rxjs';
    import { takeUntil, tap } from 'rxjs/operators';
    
    // ... inside QuizComponent class ...

    // --- Implement the methods ---
    
    onAnswer(selectedOption: string) {
      if (this.feedbackVisible || !this.currentQuestion) return;
    
      this.feedbackVisible = true;
      this.selectedAnswer = selectedOption;
      this.isCorrect = (selectedOption === this.currentQuestion.correctAnswer);
    
      // Call StateService to record the answer
      this.stateService.answerWord(
        this.currentQuestion.wordToQuiz,
        this.isCorrect,
        this.quizMode,
        this.quizService.totalWordsInPass
      );
    
      // Start the feedback timer
      this.startFeedbackTimer();
    }
    
    private startFeedbackTimer() {
      const durationMs = this.isCorrect ? 1000 : 5000;
      const tickMs = 50; // Update progress bar every 50ms
      const totalTicks = durationMs / tickMs;
      
      this.timerProgress = 0;
      
      interval(tickMs).pipe(
        tap(tick => {
          this.timerProgress = ((tick + 1) / totalTicks) * 100;
        }),
        takeUntil(timer(durationMs + tickMs)), // Auto-advance
        takeUntil(this.timer$), // Manual "Next" or "Pause"
        takeUntil(this.destroy$) // Component destroyed
      ).subscribe({
        complete: () => {
          if (!this.isPaused) {
            this.displayNextQuestion();
          }
        }
      });
    }
    
    onNext() {
      this.timer$.next(); // Stop the timer
      this.displayNextQuestion(); // Advance
    }
    
    onPause() {
      this.timer$.next(); // Stop the timer
      this.isPaused = true;
      this.timerProgress = 0; // Hide the timer bar
    }
    ```
	
	
**Step 10: Summary Component**

1.  Update `summary.component.ts` to display the summary and handle final actions.
    ```typescript
    import { Component, OnInit } from '@angular/core';
    import { Router } from '@angular/router';
    import { Observable } from 'rxjs';
    import { filter, map } from 'rxjs/operators';
    import { QuizSummary } from '../../models/quiz-summary.interface';
    import { StateService } from '../../services/state.service';

    @Component({
      selector: 'app-summary',
      templateUrl: './summary.component.html',
      styleUrls: ['./summary.component.scss']
    })
    export class SummaryComponent implements OnInit {
      summary$: Observable<QuizSummary>;
      showReviewActions$: Observable<boolean>;
    
      constructor(private stateService: StateService, private router: Router) {
        this.summary$ = this.stateService.lastSummary$.pipe(
          filter((s): s is QuizSummary => s !== null)
        );

        this.showReviewActions$ = this.summary$.pipe(
          map(s => s.quizMode === 'review' && s.correct > 0)
        );
      }
    
      ngOnInit(): void {
        // If user reloads this page, summary will be null, send to menu
        if (this.stateService.lastSummary$.getValue() === null) {
          this.router.navigate(['/menu']);
        }
      }
    
      onClearCorrected() {
        this.stateService.clearCorrectedFromCumulative();
        this.router.navigate(['/menu']);
      }
    
      onLeaveUnchanged() {
        // Lists were already cleared on last answer, just need to clear review session
        this.stateService.clearReviewPass();
        this.router.navigate(['/menu']);
      }
    
      onFinish() {
        // Main quiz list was already cleared on last answer
        this.router.navigate(['/menu']);
      }
    }
    ```
2.  Update `summary.component.html`:
    ```html
    <div class="summary-container" *ngIf="summary$ | async as summary">
      <h1>Quiz Complete!</h1>
      
      <div class="stats">
        <div>Total Words: <span>{{ summary.total }}</span></div>
        <div>Correct: <span class="correct">{{ summary.correct }}</span></div>
        <div>Missed: <span class="missed">{{ summary.missed }}</span></div>
        <div class="score">Final Score: <span>{{ summary.score | number:'1.0-0' }}%</span></div>
      </div>
      
      <div class="actions">
        <button *ngIf="summary.quizMode === 'main'" mat-raised-button color="primary" (click)="onFinish()">
          Finish
        </button>
        
        <ng-container *ngIf="showReviewActions$ | async; else noReviewActions">
          <button mat-raised-button color="primary" (click)="onClearCorrected()">
            Clear Corrected Words
          </button>
          <button mat-raised-button (click)="onLeaveUnchanged()">
            Leave List Unchanged
          </button>
        </ng-container>

        <ng-template #noReviewActions>
          <button *ngIf="summary.quizMode === 'review'" mat-raised-button color="primary" (click)="onLeaveUnchanged()">
            Finish
          </button>
        </ng-template>
      </div>
    </div>
    ```
3.  Add styles in `summary.component.scss`:
    ```scss
    .summary-container {
      max-width: 500px;
      margin: 40px auto;
      padding: 20px;
      text-align: center;
    }
    
    .stats {
      font-size: 1.5rem;
      margin: 30px 0;
      line-height: 2.2;
    
      span {
        font-weight: bold;
      }
    
      .correct { color: #4CAF50; }
      .missed { color: #F44336; }
      .score {
        font-size: 1.8rem;
        margin-top: 20px;
        border-top: 1px solid #ccc;
        padding-top: 20px;
      }
    }
    
    .actions {
      display: flex;
      flex-direction: column;
      gap: 15px;
    
      button {
        min-height: 50px;
        font-size: 1.1rem;
      }
    }
    ```
	
**Step 11: Import/Export Functionality**

1.  Create a simple alert dialog component. Generate `components/dialogs/alert-dialog/alert-dialog.component`.
2.  Update `alert-dialog.component.ts`:
    ```typescript
    import { Component, Inject } from '@angular/core';
    import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
    
    @Component({
      selector: 'app-alert-dialog',
      template: `
        <h1 mat-dialog-title>{{ data.title }}</h1>
        <div mat-dialog-content>
          <p>{{ data.message }}</p>
        </div>
        <div mat-dialog-actions align="end">
          <button mat-button [mat-dialog-close]="true" cdkFocusInitial>OK</button>
        </div>
      `
    })
    export class AlertDialogComponent {
      constructor(
        public dialogRef: MatDialogRef<AlertDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { title: string, message: string }
      ) { }
    }
    ```
3.  Add `AlertDialogComponent` to `declarations` and `entryComponents` in `app.module.ts`.
4.  Update `state.service.ts` to add the import/export methods:
    ```typescript
    // ... inside StateService class ...

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
      this.dialog.open(AlertDialogComponent, { // Add AlertDialogComponent import
        data: { title, message }
      });
    }

    // Add this import at the top of state.service.ts
    import { AlertDialogComponent } from '../components/dialogs/alert-dialog/alert-dialog.component';
    ```
5.  Update `main-menu.component.html` to add the file input and wire up the buttons:
    ```html
    <button mat-raised-button class="menu-button blue" (click)="importInput.click()">
      Import Progress
    </button>
    <button *ngIf="isReturningUser$ | async" mat-raised-button class="menu-button gray" (click)="onExport()">
      Export Progress
    </button>
    
    <input
      type="file"
      hidden
      #importInput
      accept=".json"
      (change)="onFileSelected($event)"
    />
    ```
6.  Update `main-menu.component.ts` with the click handlers:
    ```typescript
    // ... inside MainMenuComponent class ...

    onExport() {
      this.stateService.exportState();
    }
    
    onFileSelected(event: Event) {
      const input = event.target as HTMLInputElement;
      if (input.files && input.files.length > 0) {
        const file = input.files[0];
        this.stateService.importState(file);
        
        // Reset the input value so the (change) event fires even if
        // the same file is selected again
        input.value = '';
      }
    }
    ```
This completes the 11-step implementation of your project spec.

