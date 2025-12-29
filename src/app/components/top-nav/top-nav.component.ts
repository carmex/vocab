import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    <div class="top-nav">
      <div class="left-section">
        <button mat-icon-button [style.visibility]="showBack ? 'visible' : 'hidden'" [disabled]="!showBack" (click)="onBack()">
          <mat-icon>arrow_back</mat-icon>
        </button>
      </div>

      <div class="right-section">
        <button mat-icon-button *ngIf="showSettings" (click)="onSettings()">
          <mat-icon>settings</mat-icon>
        </button>
        
        <div class="profile-icon" [matMenuTriggerFor]="profileMenu">
          <img *ngIf="avatarUrl" [src]="avatarUrl" alt="Profile" class="avatar-img">
          <span *ngIf="!avatarUrl">{{ initials }}</span>
        </div>
        
        <mat-menu #profileMenu="matMenu">
          <ng-container *ngIf="auth.user$ | async as user">
            <button mat-menu-item disabled *ngIf="!user.is_anonymous">
              <span>{{ user.email }}</span>
            </button>

            <button mat-menu-item routerLink="/login" *ngIf="user.is_anonymous">
              <mat-icon>login</mat-icon>
              <span>Login</span>
            </button>
            <button mat-menu-item routerLink="/signup" *ngIf="user.is_anonymous">
              <mat-icon>person_add</mat-icon>
              <span>Sign Up</span>
            </button>

            <button mat-menu-item (click)="auth.signOut()" *ngIf="!user.is_anonymous">
              <mat-icon>logout</mat-icon>
              <span>Logout</span>
            </button>
          </ng-container>
        </mat-menu>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .top-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      height: 60px;
      background-color: transparent;
    }

    .left-section {
      display: flex;
      align-items: center;
    }

    .right-section {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .profile-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background-color: #673ab7; /* Deep Purple */
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      cursor: pointer;
      user-select: none;
      transition: transform 0.2s;
      overflow: hidden;

      &:hover {
        transform: scale(1.1);
      }

      .avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
}
`]
})
export class TopNavComponent implements OnInit {
  @Input() backLink: string | null = null;
  @Output() back = new EventEmitter<void>();
  @Output() settings = new EventEmitter<void>();

  initials = 'AN'; // Default for Anonymous
  avatarUrl: string | null = null;

  constructor(
    public auth: AuthService,
    private router: Router
  ) { }

  ngOnInit() {
    this.auth.user$.subscribe(user => {
      if (user) {
        // Check for avatar URL in user_metadata (from Google OAuth)
        this.avatarUrl = user.user_metadata?.['avatar_url'] ||
          user.user_metadata?.['picture'] ||
          null;

        if (user.email) {
          this.initials = user.email.substring(0, 2).toUpperCase();
        } else if (user.user_metadata?.['full_name']) {
          // Use first letter of first and last name if available
          const names = (user.user_metadata['full_name'] as string).split(' ');
          this.initials = names.length >= 2
            ? (names[0][0] + names[names.length - 1][0]).toUpperCase()
            : names[0].substring(0, 2).toUpperCase();
        } else {
          this.initials = 'AN';
        }
      } else {
        this.initials = 'AN';
        this.avatarUrl = null;
      }
    });
  }

  get showBack(): boolean {
    if (this.router.url === '/menu') {
      return false;
    }
    return true;
  }

  get showSettings(): boolean {
    return !this.router.url.includes('/settings');
  }

  onBack() {
    if (this.back.observed) {
      this.back.emit();
    } else if (this.backLink) {
      this.router.navigate([this.backLink]);
    } else {
      this.router.navigate(['/menu']);
    }
  }

  onSettings() {
    if (this.settings.observed) {
      this.settings.emit();
    } else {
      this.router.navigate(['/settings']);
    }
  }
}
