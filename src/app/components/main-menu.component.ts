import { Component } from '@angular/core';
import { StateService } from '../services/state.service';

@Component({
  selector: 'app-main-menu',
  templateUrl: './main-menu.component.html',
  styleUrls: ['./main-menu.component.scss'],
  standalone: false
})
export class MainMenuComponent {
  hasQuizInProgress$;
  hasMissedWords$;
  hasReviewInProgress$;
  isReturningUser$;

  constructor(private stateService: StateService) {
    // Initialize observables after service injection
    this.hasQuizInProgress$ = this.stateService.hasQuizInProgress$;
    this.hasMissedWords$ = this.stateService.hasMissedWords$;
    this.hasReviewInProgress$ = this.stateService.hasReviewInProgress$;
    this.isReturningUser$ = this.stateService.isReturningUser$;
  }

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
}