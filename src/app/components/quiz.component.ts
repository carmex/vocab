import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { QuizQuestion } from '../models/quiz-question.interface';
import { QuizService } from '../services/quiz.service';
import { SettingsService } from '../services/settings.service';
import { TopNavComponent } from './top-nav/top-nav.component';
import { TwemojiPipe } from '../pipes/twemoji.pipe';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule, MatProgressBarModule, MatButtonModule, MatIconModule, TopNavComponent, TwemojiPipe],
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.scss']
})
export class QuizComponent implements OnInit, OnDestroy {
  quizMode: 'main' | 'review' = 'main';
  listId: string = '';
  currentQuestion: QuizQuestion | null = null;

  // Feedback UI State
  feedbackVisible = false;
  selectedAnswer: string | null = null;
  isCorrect = false;

  // Progress
  progressPercent = 0;
  missedPercent = 0;
  progressLabel = '';
  missedLabel = '';

  // Timer State
  timerProgress = 0;
  isPaused = false;
  private timerInterval: any = null;
  private remainingTime = 0;
  private totalTime = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private quizService: QuizService,
    private settingsService: SettingsService
  ) { }

  async ngOnInit(): Promise<void> {
    this.listId = this.route.snapshot.paramMap.get('listId') || '';
    this.quizMode = this.route.snapshot.paramMap.get('mode') as 'main' | 'review';

    if (!this.listId || !this.quizMode) {
      this.router.navigate(['/dashboard']);
      return;
    }

    try {
      await this.quizService.startQuiz(this.listId, this.quizMode);
      this.updateProgress();
      this.displayNextQuestion();
    } catch (err) {
      console.error('Failed to start quiz', err);
      alert('Error starting quiz. Check console.');
      this.router.navigate(['/dashboard']);
    }
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  private displayNextQuestion() {
    this.feedbackVisible = false;
    this.selectedAnswer = null;
    this.isCorrect = false;
    this.timerProgress = 0;
    this.isPaused = false;

    this.currentQuestion = this.quizService.getNextQuestion();

    if (!this.currentQuestion) {
      // Quiz Over
      this.router.navigate(['/summary']);
    }
  }

  onAnswer(selectedOption: string) {
    if (this.feedbackVisible || !this.currentQuestion) return;

    this.feedbackVisible = true;
    this.selectedAnswer = selectedOption;
    this.isCorrect = (selectedOption === this.currentQuestion.correctAnswer);

    // Optimistic Update
    if (this.currentQuestion.wordToQuiz.id) {
      this.quizService.submitAnswer(this.currentQuestion.wordToQuiz.id, this.isCorrect);
    }

    this.updateProgress();

    // Auto-advance logic
    const settings = this.settingsService.getSettings();
    if (settings.autoAdvance) {
      this.totalTime = this.isCorrect ? settings.correctAnswerTimer * 1000 : settings.incorrectAnswerTimer * 1000;
      this.remainingTime = this.totalTime;
      this.startTimer();
    }
  }

  private startTimer() {
    this.isPaused = false;
    const step = 100; // Update every 100ms

    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      this.remainingTime -= step;
      this.timerProgress = (this.remainingTime / this.totalTime) * 100;

      if (this.remainingTime <= 0) {
        this.onNext();
      }
    }, step);
  }

  onPause() {
    this.isPaused = true;
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  onNext() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.displayNextQuestion();
  }

  onSettings() {
    this.router.navigate(['/settings']);
  }

  onExit() {
    this.router.navigate(['/dashboard']);
  }

  private updateProgress() {
    const total = this.quizService.totalWordsInPass;
    const answered = this.quizService.answeredCount;
    const correct = this.quizService.correctCount;
    const missed = answered - correct;

    this.progressPercent = (answered / total) * 100;
    this.missedPercent = (missed / total) * 100;
    this.progressLabel = `${answered} / ${total}`;
    this.missedLabel = `${missed} Missed`;
  }
}