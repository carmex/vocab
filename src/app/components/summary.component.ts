import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { QuizSummary } from '../models/quiz-summary.interface';
import { StateService } from '../services/state.service';

@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
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