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

  constructor(
    private quizService: QuizService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.correctCount = this.quizService.correctCount;
    this.totalCount = this.quizService.answeredCount;
    this.isReview = this.quizService.currentMode === 'review';

    // Check for quest completion
    this.questCompleted = this.route.snapshot.queryParamMap.get('questCompleted') === 'true';
    if (this.questCompleted) {
      this.fireConfetti();
    }
  }

  fireConfetti() {
    // Simple custom confetti
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];

    for (let i = 0; i < 100; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = Math.random() * 100 + 'vw';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDuration = Math.random() * 3 + 2 + 's';

      document.body.appendChild(confetti);

      setTimeout(() => {
        confetti.remove();
      }, 5000);
    }
  }

  async onFinish() {
    this.loading = true;
    try {
      await this.quizService.finishPass(false); // Don't clear missed words
      this.router.navigate(['/dashboard']);
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
      this.router.navigate(['/dashboard']);
    } catch (err) {
      console.error(err);
      alert('Error clearing corrected words');
      this.loading = false;
    }
  }
}