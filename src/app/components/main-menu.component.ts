import { Component } from '@angular/core';
import { StateService } from '../services/state.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { User } from '@supabase/supabase-js';

@Component({
  selector: 'app-main-menu',
  templateUrl: './main-menu.component.html',
  styleUrls: ['./main-menu.component.scss'],
  standalone: false
})
export class MainMenuComponent {
  hasQuizInProgress$: Observable<boolean>;
  hasMissedWords$: Observable<boolean>;
  hasReviewInProgress$: Observable<boolean>;
  isReturningUser$: Observable<boolean>;
  currentUser$: Observable<User | null>;

  isTeacher$: Observable<boolean>;

  constructor(
    private stateService: StateService,
    public auth: AuthService,
    private router: Router
  ) {
    this.currentUser$ = this.auth.user$;
    this.isTeacher$ = this.auth.profile$.pipe(map(p => p?.role === 'teacher'));

    // Initialize observables after service injection
    this.hasQuizInProgress$ = this.stateService.hasQuizInProgress$;
    this.hasMissedWords$ = this.stateService.hasMissedWords$;
    this.hasReviewInProgress$ = this.stateService.hasReviewInProgress$;
    this.isReturningUser$ = this.stateService.isReturningUser$;
  }
}