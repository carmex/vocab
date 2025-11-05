import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { timer, interval } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { QuizQuestion } from '../models/quiz-question.interface';
import { QuizService } from '../services/quiz.service';
import { StateService } from '../services/state.service';
import { SettingsService } from '../services/settings.service';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule, MatProgressBarModule, MatButtonModule, MatIconModule],
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
  pauseTriggered = false;
  timerProgress = 0;
  
  // Previous word tracking for "Add to Missed Words" feature
  previousWord: QuizQuestion | null = null;
  previousAnswerCorrect = false;

  // Progress Bar Observables
  passProgressPercent!: Observable<number>;
  passProgressCount!: Observable<string>;
  missedProgressPercent!: Observable<number>;
  missedProgressCount!: Observable<string>;
  
  // Will be implemented in the next step
  private timer$: Subject<void> = new Subject();
  private destroy$: Subject<void> = new Subject();
  private timerCompleted = false;
  private currentTimerId = 0;
  private feedbackTimer: any = null;

  // Getter for auto-advance setting
  get autoAdvanceEnabled(): boolean {
    return this.settingsService.getSettings().autoAdvance;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private quizService: QuizService,
    private stateService: StateService,
    private settingsService: SettingsService
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
      map((list: string[]) => (list.length / total) * 100)
    );
    this.passProgressCount = answered$.pipe(
      map((list: string[]) => `${list.length} / ${total}`)
    );

    this.missedProgressPercent = missed$.pipe(
      map((list: string[]) => (list.length / total) * 100)
    );
    this.missedProgressCount = missed$.pipe(
      map((list: string[]) => `${list.length} Missed`)
    );
  }

  private displayNextQuestion() {
    // Reset feedback state
    this.feedbackVisible = false;
    this.selectedAnswer = null;
    this.isCorrect = false;
    this.isPaused = false;
    this.pauseTriggered = false;
    this.timerCompleted = false;
    this.currentTimerId++;
    this.timerProgress = 0;
    this.timer$.next(); // Stop any active timer
    
    // Clear any existing feedback timer
    if (this.feedbackTimer) {
      clearInterval(this.feedbackTimer);
      this.feedbackTimer = null;
    }

    this.currentQuestion = this.quizService.getNextQuestion();

    if (this.currentQuestion === null) {
      // Quiz is over
      this.router.navigate(['/summary']);
    }
  }

  // --- Implement the methods ---
  
  onAnswer(selectedOption: string) {
    if (this.feedbackVisible || !this.currentQuestion) return;

    this.feedbackVisible = true;
    this.selectedAnswer = selectedOption;
    this.isCorrect = (selectedOption === this.currentQuestion.correctAnswer);
    
    // Store the previous word for "Add to Missed Words" feature
    this.previousWord = this.currentQuestion;
    this.previousAnswerCorrect = this.isCorrect;

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

  addToMissedWords() {
    if (this.previousWord && this.previousAnswerCorrect) {
      this.stateService.addToMissedWords(this.previousWord.wordToQuiz);
      // Hide the button section after adding to missed words
      this.previousWord = null;
      this.previousAnswerCorrect = false;
    }
  }

private startFeedbackTimer() {
  const settings = this.settingsService.getSettings();
  const correctTimerMs = settings.correctAnswerTimer * 1000; // Convert seconds to milliseconds
  const incorrectTimerMs = settings.incorrectAnswerTimer * 1000; // Convert seconds to milliseconds
  
  const durationMs = this.isCorrect ? correctTimerMs : incorrectTimerMs;
  const tickMs = 100; // Update progress bar every 100ms for better accuracy
  const totalTicks = durationMs / tickMs;
  
  this.timerProgress = 0;
  this.timerCompleted = false;
  const timerId = this.currentTimerId;
  let currentTick = 0;
  let startTime = Date.now();
  
  if (this.isPaused || this.pauseTriggered) {
    return;
  }
  
  // Use a single interval timer for both progress and completion
  const progressInterval = setInterval(() => {
    if (this.isPaused || this.pauseTriggered) {
      clearInterval(progressInterval);
      return;
    }
    
    const elapsed = Date.now() - startTime;
    this.timerProgress = Math.min((elapsed / durationMs) * 100, 100);
    
    if (elapsed >= durationMs) {
      clearInterval(progressInterval);
      this.completeFeedbackTimer(timerId);
    }
  }, tickMs);
  
  // Store the interval for cleanup
  this.feedbackTimer = progressInterval;
}
  
private completeFeedbackTimer(timerId: number) {
    if (this.destroy$) {
      this.destroy$.next();
    }
    
    const settings = this.settingsService.getSettings();
    
    // Only advance if this timer is still current, not paused, and auto-advance is enabled
    if (timerId === this.currentTimerId && !this.isPaused && !this.pauseTriggered && this.feedbackVisible && this.currentQuestion) {
      if (settings.autoAdvance) {
        this.displayNextQuestion();
      } else {
        // Auto-advance is disabled, just reset the timer progress
        this.timerProgress = 0;
        this.timerCompleted = true;
      }
    } else {
      this.timerProgress = 0;
    }
  }

  onNext() {
    this.timer$.next(); // Stop the timer
    this.displayNextQuestion(); // Advance
  }

  onPause() {
    this.timer$.next(); // Stop the timer
    this.isPaused = true;
    this.pauseTriggered = true;
    this.timerCompleted = true; // Mark timer as completed to prevent auto-advance
    this.timerProgress = 0; // Hide the timer bar
    
    // Clear any existing feedback timer
    if (this.feedbackTimer) {
      clearInterval(this.feedbackTimer);
      this.feedbackTimer = null;
    }
  }

  onBackToMenu() {
    this.router.navigate(['/menu']);
  }

  onOpenSettings() {
    this.router.navigate(['/settings']);
  }
}