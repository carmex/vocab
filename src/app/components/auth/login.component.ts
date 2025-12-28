import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TopNavComponent } from '../top-nav/top-nav.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    RouterModule,
    TopNavComponent
  ],
  template: `
    <div class="auth-container">
      <app-top-nav backLink="/menu"></app-top-nav>
      
      <div class="auth-content">
        <mat-card class="auth-card">
          <mat-card-header>
            <mat-card-title>Login</mat-card-title>
            <mat-card-subtitle>Welcome back!</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <form (ngSubmit)="onLogin()" class="auth-form">
              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input matInput [(ngModel)]="email" name="email" type="email" required>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Password</mat-label>
                <input matInput [(ngModel)]="password" name="password" type="password" required>
              </mat-form-field>
              
              <p class="error-text" *ngIf="error">{{ error }}</p>
              
              <div class="auth-actions">
                <button mat-raised-button color="primary" type="submit" [disabled]="isLoading">
                  {{ isLoading ? 'Logging in...' : 'Login' }}
                </button>
              </div>
            </form>

            <div class="divider">
              <span>OR</span>
            </div>

            <button mat-stroked-button class="google-btn" (click)="onGoogleLogin()" [disabled]="isLoading">
              <img src="assets/google-logo.svg" alt="Google" class="google-icon" onerror="this.style.display='none'">
              <mat-icon *ngIf="true">login</mat-icon> <!-- Fallback icon if image fails -->
              Sign in with Google
            </button>

            <div class="auth-footer">
              <p>Don't have an account? <a routerLink="/signup">Sign Up</a></p>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 10px;
      box-sizing: border-box;
    }

    .auth-content {
      display: flex;
      justify-content: center;
      padding-top: 20px;
    }

    .auth-card {
      width: 100%;
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 20px;
    }

    .auth-actions {
      display: flex;
      flex-direction: column;
    }

    .divider {
      display: flex;
      align-items: center;
      text-align: center;
      margin: 20px 0;
      color: #888;
      
      &::before, &::after {
        content: '';
        flex: 1;
        border-bottom: 1px solid #ddd;
      }
      
      span {
        padding: 0 10px;
        font-size: 0.9rem;
      }
    }

    .google-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    .google-icon {
      width: 18px;
      height: 18px;
    }

    .auth-footer {
      margin-top: 20px;
      text-align: center;
      font-size: 0.9rem;
      
      a {
        color: #3f51b5;
        text-decoration: none;
        font-weight: 500;
        
        &:hover {
          text-decoration: underline;
        }
      }
    }

    .error-text {
      color: #f44336;
      font-size: 0.9rem;
      margin: 0;
    }

    /* Dark Mode Overrides */
    :host-context(body.dark-mode) {
      .divider {
        color: #999;

        &::before, &::after {
          border-bottom-color: #444;
        }
      }

      .auth-footer a {
        color: #7986cb;
      }

      .error-text {
        color: #ef5350;
      }
    }
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  isLoading = false;
  error = '';

  constructor(private auth: AuthService, private router: Router) { }

  async onLogin() {
    if (!this.email || !this.password) {
      this.error = 'Please enter email and password';
      return;
    }

    this.isLoading = true;
    this.error = '';

    try {
      const { error } = await this.auth.signIn(this.email, this.password);
      if (error) throw error;
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error = err.message || 'Login failed';
    } finally {
      this.isLoading = false;
    }
  }

  async onGoogleLogin() {
    this.isLoading = true;
    try {
      const { error } = await this.auth.signInWithGoogle();
      if (error) throw error;
      // Redirect happens automatically
    } catch (err: any) {
      this.error = err.message || 'Google sign-in failed';
      this.isLoading = false;
    }
  }
}
