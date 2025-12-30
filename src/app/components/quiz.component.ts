import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { QuizQuestion } from '../models/quiz-question.interface';
import { QuizService } from '../services/quiz.service';
import { SettingsService } from '../services/settings.service';
import { ClassroomService } from '../services/classroom.service';
import { AuthService } from '../services/auth.service';
import { TopNavComponent } from './top-nav/top-nav.component';
import { TwemojiPipe } from '../pipes/twemoji.pipe';
import { ListType } from '../models/list-type.enum';

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
  isImageQuiz = false;

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

  questId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private quizService: QuizService,
    private settingsService: SettingsService,
    private classroomService: ClassroomService,
    private auth: AuthService
  ) { }

  async ngOnInit(): Promise<void> {
    this.listId = this.route.snapshot.paramMap.get('listId') || '';
    this.quizMode = this.route.snapshot.paramMap.get('mode') as 'main' | 'review';
    this.questId = this.route.snapshot.queryParamMap.get('questId');

    if (!this.listId || !this.quizMode) {
      this.router.navigate(['/dashboard']);
      return;
    }

    try {
      const { listType } = await this.quizService.startQuiz(this.listId, this.quizMode, this.questId);

      // Redirect sight words to dedicated quiz
      if (listType === ListType.SIGHT_WORDS) {
        this.router.navigate(['/sight-words-quiz', this.listId], { queryParams: { mode: this.quizMode, questId: this.questId } });
        return;
      }

      this.isImageQuiz = listType === ListType.IMAGE_DEFINITION;
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

  private async displayNextQuestion() {
    this.feedbackVisible = false;
    this.selectedAnswer = null;
    this.isCorrect = false;
    this.timerProgress = 0;
    this.isPaused = false;

    this.currentQuestion = this.quizService.getNextQuestion();

    if (!this.currentQuestion) {
      // Quiz Over - Save result for gradebook
      await this.quizService.saveQuizResult();

      if (this.questId) {
        // Mark quest as complete
        const userId = this.auth.currentUser?.id;
        if (userId) {
          this.classroomService.completeQuest(this.questId, userId).subscribe({
            next: () => console.log('Quest completed!'),
            error: (err) => console.error('Error completing quest:', err)
          });
        }
        this.router.navigate(['/summary'], { queryParams: { questCompleted: true } });
      } else {
        this.router.navigate(['/summary']);
      }
    }
  }

  onAnswer(selectedOption: string) {
    if (this.feedbackVisible || !this.currentQuestion) return;

    this.feedbackVisible = true;
    this.selectedAnswer = selectedOption;
    this.isCorrect = (selectedOption === this.currentQuestion.correctAnswer);

    // Optimistic Update
    if (this.currentQuestion.wordToQuiz.id) {
      this.quizService.submitAnswer(
        this.currentQuestion.wordToQuiz.id,
        this.isCorrect,
        this.currentQuestion.wordToQuiz.word
      );
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