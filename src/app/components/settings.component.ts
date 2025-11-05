import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDialog } from '@angular/material/dialog';
import { SettingsService, AppSettings } from '../services/settings.service';
import { AlertDialogComponent } from '../components/dialogs/alert-dialog/alert-dialog.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatFormFieldModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    AlertDialogComponent
  ],
  template: `
    <div class="settings-container">
      <div class="settings-header">
        <button mat-icon-button (click)="onBackToQuiz()" class="back-button" aria-label="Back to quiz">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h2>Settings</h2>
      </div>

      <div class="settings-section">
        <h3>Quiz Behavior</h3>
        
        <div class="setting-item">
          <mat-checkbox [(ngModel)]="autoAdvance" color="primary">
            Auto-advance to next question
          </mat-checkbox>
          <p class="setting-description">Automatically move to the next question after answering</p>
        </div>

        <div class="timer-settings" [class.disabled]="!autoAdvance">
          <div class="timer-setting-item">
            <mat-form-field appearance="fill" class="timer-setting">
              <mat-label>Correct Answer Timer (seconds)</mat-label>
              <mat-select [(ngModel)]="correctAnswerTimer" [disabled]="!autoAdvance">
                <mat-option [value]="1">1 second</mat-option>
                <mat-option [value]="2">2 seconds</mat-option>
                <mat-option [value]="3">3 seconds</mat-option>
                <mat-option [value]="5">5 seconds</mat-option>
                <mat-option [value]="10">10 seconds</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="timer-setting-item">
            <mat-form-field appearance="fill" class="timer-setting">
              <mat-label>Incorrect Answer Timer (seconds)</mat-label>
              <mat-select [(ngModel)]="incorrectAnswerTimer" [disabled]="!autoAdvance">
                <mat-option [value]="3">3 seconds</mat-option>
                <mat-option [value]="5">5 seconds</mat-option>
                <mat-option [value]="7">7 seconds</mat-option>
                <mat-option [value]="10">10 seconds</mat-option>
                <mat-option [value]="15">15 seconds</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>
      </div>

      <div class="settings-actions">
        <button mat-raised-button color="primary" (click)="onSave()">
          Save Settings
        </button>
        <button mat-button (click)="onReset()">
          Reset to Default
        </button>
      </div>
    </div>
  `,
  styles: [`
    .settings-container {
      padding: 20px;
      max-width: 600px;
      margin: 0 auto;
    }

    .settings-header {
      display: flex;
      align-items: center;
      margin-bottom: 30px;
      
      .back-button {
        margin-right: 10px;
        color: #666;
      }
      
      h2 {
        margin: 0;
        flex: 1;
      }
    }

    .settings-section {
      margin-bottom: 40px;
      padding: 20px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background-color: #fafafa;

      h3 {
        margin: 0 0 20px 0;
        color: #333;
        font-size: 1.1rem;
        font-weight: 500;
      }
    }

    .setting-item {
      margin-bottom: 25px;
      
      &:last-child {
        margin-bottom: 0;
      }

      mat-checkbox, mat-slide-toggle {
        display: block;
        margin-bottom: 8px;
      }

      .setting-description {
        margin: 0;
        color: #666;
        font-size: 0.9rem;
        margin-left: 32px;
        margin-top: 5px;
      }
    }

    .timer-settings {
      margin-left: 32px;
      padding-left: 20px;
      border-left: 2px solid #e0e0e0;
      margin-top: 15px;
      
      &.disabled {
        opacity: 0.5;
      }
      
      .timer-setting-item {
        margin-bottom: 20px;
        
        &:last-child {
          margin-bottom: 0;
        }

        .timer-setting {
          width: 100%;
          max-width: 300px;
        }
      }
    }

    .settings-actions {
      display: flex;
      gap: 15px;
      justify-content: flex-start;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
    }
  `]
})
export class SettingsComponent implements OnInit {
  // Settings properties
  autoAdvance = true;
  correctAnswerTimer = 1;
  incorrectAnswerTimer = 5;

  constructor(
    private settingsService: SettingsService,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.loadSettings();
  }

  onBackToQuiz() {
    window.history.back();
  }

  onSave() {
    const settings: AppSettings = {
      autoAdvance: this.autoAdvance,
      correctAnswerTimer: this.correctAnswerTimer,
      incorrectAnswerTimer: this.incorrectAnswerTimer
    };

    this.settingsService.saveSettings(settings);
    
    this.dialog.open(AlertDialogComponent, {
      width: '400px',
      data: {
        title: 'Settings Saved',
        message: 'Your settings have been saved successfully!'
      }
    });
  }

  onReset() {
    const defaultSettings = this.settingsService.getDefaultSettings();
    this.autoAdvance = defaultSettings.autoAdvance;
    this.correctAnswerTimer = defaultSettings.correctAnswerTimer;
    this.incorrectAnswerTimer = defaultSettings.incorrectAnswerTimer;
  }

  private loadSettings(): void {
    const settings = this.settingsService.getSettings();
    this.autoAdvance = settings.autoAdvance;
    this.correctAnswerTimer = settings.correctAnswerTimer;
    this.incorrectAnswerTimer = settings.incorrectAnswerTimer;
  }
}