import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { ListType } from '../../../models/list-type.enum';

@Component({
    selector: 'app-list-type-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule
    ],
    template: `
    <h2 mat-dialog-title>Choose List Type</h2>
    <mat-dialog-content>
      <div class="type-grid">
        <mat-card class="type-card" (click)="select(ListType.WORD_DEFINITION)">
          <mat-icon class="type-icon">text_fields</mat-icon>
          <h3>Word / Definition</h3>
          <p>Match vocabulary words to their definitions</p>
        </mat-card>

        <mat-card class="type-card" (click)="select(ListType.IMAGE_DEFINITION)">
          <mat-icon class="type-icon">image</mat-icon>
          <h3>Image / Definition</h3>
          <p>Match images to text answers (e.g., geography, shapes)</p>
        </mat-card>

        <mat-card class="type-card" (click)="select(ListType.SIGHT_WORDS)">
          <mat-icon class="type-icon">record_voice_over</mat-icon>
          <h3>Sight Words</h3>
          <p>Practice reading and speaking words aloud</p>
        </mat-card>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
    </mat-dialog-actions>
  `,
    styles: [`
    .type-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 300px;
    }
    .type-card {
      cursor: pointer;
      padding: 20px;
      text-align: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .type-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .type-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #3f51b5;
      margin-bottom: 8px;
    }
    .type-card h3 {
      margin: 8px 0 4px;
      font-weight: 500;
    }
    .type-card p {
      margin: 0;
      font-size: 0.85rem;
      color: #666;
    }
  `]
})
export class ListTypeDialogComponent {
    ListType = ListType;

    constructor(private dialogRef: MatDialogRef<ListTypeDialogComponent>) { }

    select(type: ListType): void {
        this.dialogRef.close(type);
    }
}
