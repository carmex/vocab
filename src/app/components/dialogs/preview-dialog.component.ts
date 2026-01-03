import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

import { ListService } from '../../services/list.service';
import { Router } from '@angular/router';
import { TwemojiPipe } from '../../pipes/twemoji.pipe';
import { AuthService } from '../../services/auth.service';
import { AssignQuestDialogComponent } from './assign-quest-dialog/assign-quest-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, TwemojiPipe],
  template: `
    <h2 mat-dialog-title>
      Preview: {{ data.listName }}
      <span class="word-count" *ngIf="!loading">({{ words.length }} items)</span>
    </h2>
    <mat-dialog-content class="preview-content">
      <div class="word-grid" *ngIf="!loading">
        <div class="word-card" *ngFor="let word of words">
          <div class="word-text" [innerHTML]="word.word | twemoji"></div>
          <div class="word-def" [innerHTML]="word.definition | twemoji"></div>
        </div>
      </div>
      <p *ngIf="loading" class="loading-text">Loading words...</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-stroked-button color="primary" 
        *ngIf="(auth.profile$ | async)?.role === 'teacher'"
        (click)="onAssign()"
        [disabled]="assigning"
        style="margin-right: 8px;">
        {{ assigning ? 'Preparing...' : 'Assign to Class' }}
      </button>
      <button mat-raised-button color="primary" (click)="onSubscribe()" [disabled]="subscribing">
        {{ subscribing ? 'Adding...' : 'Add to My Lists' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .preview-content {
      min-height: 300px;
    }
    .word-count {
      font-size: 0.8em;
      color: #777;
      margin-left: 10px;
      font-weight: normal;
    }
    .word-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
      padding-top: 10px;
    }
    .word-card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .word-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      border-color: #bdbdbd;
    }
    .word-text {
      font-weight: 600;
      font-size: 1.1em;
      margin-bottom: 6px;
      color: #333;
      word-break: break-word;
    }
    .word-def {
      font-size: 0.85em;
      color: #666;
      line-height: 1.3;
      word-break: break-word;
    }
    .loading-text {
      text-align: center;
      margin-top: 20px;
      color: #666;
    }
    /* Scroll fix for dialog content if needed */
    mat-dialog-content {
      max-height: 70vh;
    }
  `]
})
export class PreviewDialogComponent implements OnInit {
  words: any[] = [];
  loading = true;
  subscribing = false;
  assigning = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { listId: string, listName: string },
    private dialogRef: MatDialogRef<PreviewDialogComponent>,
    private listService: ListService,
    private router: Router,
    public auth: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.listService.getWords(this.data.listId).subscribe(words => {
      this.words = words;
      this.loading = false;
    });
  }

  onSubscribe() {
    this.subscribing = true;
    this.listService.subscribeToList(this.data.listId).subscribe({
      next: () => {
        this.dialogRef.close();
        this.router.navigate(['/lists']);
      },
      error: (err) => {
        console.error(err);
        alert('Failed to subscribe');
        this.subscribing = false;
      }
    });
  }

  onAssign() {
    this.assigning = true;
    // Auto-subscribe first so it appears in the list selector
    this.listService.subscribeToList(this.data.listId).subscribe({
      next: () => {
        this.openAssignDialog();
        this.assigning = false;
      },
      error: (err) => {
        console.warn('Subscribe failed or already subscribed, proceeding anyway', err);
        // Proceed anyway, maybe they already have it or it's a glitch, 
        // don't block the user.
        this.openAssignDialog();
        this.assigning = false;
      }
    });
  }

  openAssignDialog() {
    this.dialogRef.close();

    const dialogRef = this.dialog.open(AssignQuestDialogComponent, {
      width: '500px',
      data: { listId: this.data.listId, listName: this.data.listName }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.count > 0) {
        const count = result.studentCount;
        const msg = count === 1 ? 'Assigned to 1 student!' : `Assigned to ${count} students!`;
        this.snackBar.open(msg, 'Close', {
          duration: 3000
        });
      }
    });
  }
}


