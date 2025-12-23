import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { QuizService } from '../services/quiz.service';

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

  constructor(
    private quizService: QuizService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.correctCount = this.quizService.correctCount;
    this.totalCount = this.quizService.answeredCount;
    this.isReview = this.quizService.currentMode === 'review';
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