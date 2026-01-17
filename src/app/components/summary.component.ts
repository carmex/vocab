import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { QuizService } from '../services/quiz.service';
import JSConfetti from 'js-confetti';

@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.scss']
})
export class SummaryComponent implements OnInit {
  loading = false;
  correctCount = 0;
  totalCount = 0;
  isReview = false;
  questCompleted = false;
  returnSource: string | null = null;

  constructor(
    private quizService: QuizService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  private jsConfetti: JSConfetti | null = null;

  ngOnInit(): void {
    console.log('[Summary] QuizService Stats:', {
      correct: this.quizService.correctCount,
      answered: this.quizService.answeredCount,
      total: this.quizService.totalWordsInPass,
      mode: this.quizService.currentMode
    });

    this.correctCount = this.quizService.correctCount;
    this.totalCount = this.quizService.answeredCount;
    this.isReview = this.quizService.currentMode === 'review';

    // Check for quest completion or general celebration
    this.questCompleted = this.route.snapshot.queryParamMap.get('questCompleted') === 'true';
    this.returnSource = this.route.snapshot.queryParamMap.get('from');

    // Celebrate if they finished (quest or not) and got at least one right
    if (this.questCompleted || (this.totalCount > 0 && this.correctCount > 0)) {
      this.fireConfetti();
    }
  }

  fireConfetti() {
    if (!this.jsConfetti) {
      this.jsConfetti = new JSConfetti();
    }

    // Use standard confetti colors/shapes for better performance than emojis
    this.jsConfetti.addConfetti({
      confettiColors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'],
      confettiNumber: 150,
    });
  }

  async onFinish() {
    this.loading = true;
    try {
      await this.quizService.finishPass(false); // Don't clear missed words
      this.navigateBack();
    } catch (err) {
      console.error(err);
      alert('Error finishing pass');
      this.loading = false;
    }
  }

  async onClearCorrected() {
    this.loading = true;
    try {
      await this.quizService.finishPass(true); // Clear missed words
      this.navigateBack();
    } catch (err) {
      console.error(err);
      alert('Error clearing corrected words');
      this.loading = false;
    }
  }


  private navigateBack() {
    if (this.returnSource === 'quests') {
      this.router.navigate(['/quests']);
    } else {
      this.router.navigate(['/lists']);
    }
  }
}