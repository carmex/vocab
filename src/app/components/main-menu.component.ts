import { Component } from '@angular/core';
import { StateService } from '../services/state.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { switchMap, map, catchError, startWith } from 'rxjs/operators';
import { ClassroomService } from '../services/classroom.service';
import { of } from 'rxjs';
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
  hasQuests$: Observable<boolean>;

  isTeacher$: Observable<boolean>;

  constructor(
    private stateService: StateService,
    public auth: AuthService,
    private router: Router,
    private classroomService: ClassroomService
  ) {
    this.currentUser$ = this.auth.user$;
    this.isTeacher$ = this.auth.profile$.pipe(map(p => p?.role === 'teacher'));

    // Initialize observables after service injection
    this.hasQuizInProgress$ = this.stateService.hasQuizInProgress$;
    this.hasMissedWords$ = this.stateService.hasMissedWords$;
    this.hasReviewInProgress$ = this.stateService.hasReviewInProgress$;
    this.isReturningUser$ = this.stateService.isReturningUser$;

    this.hasQuests$ = this.currentUser$.pipe(
      switchMap(user => {
        if (!user) return of(false);
        return this.classroomService.getStudentQuests(user.id).pipe(
          map(quests => quests && quests.length > 0),
          catchError(() => of(false))
        );
      }),
      startWith(false)
    );
  }
}