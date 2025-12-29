import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule } from '@angular/forms';
import { Quest } from '../../../models/quest.interface';

@Component({
    selector: 'app-edit-quest-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatFormFieldModule,
        MatInputModule,
        FormsModule
    ],
    template: `
    <h2 mat-dialog-title>Edit Assignment: {{ data.quest.list_name }}</h2>
    <mat-dialog-content>
      <div class="field-container">
        <mat-form-field appearance="fill" class="full-width">
          <mat-label>Due Date</mat-label>
          <input matInput [matDatepicker]="picker" [(ngModel)]="dueDate">
          <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
          <mat-hint>Students can still access it after this date, but it will be marked late.</mat-hint>
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" (click)="onSave()" [disabled]="!dueDate">Save Changes</button>
    </mat-dialog-actions>
  `,
    styles: [`
    .field-container {
      padding-top: 10px;
      min-width: 300px;
    }
    .full-width {
      width: 100%;
    }
  `]
})
export class EditQuestDialogComponent {
    dueDate: Date | null = null;

    constructor(
        public dialogRef: MatDialogRef<EditQuestDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { quest: Quest }
    ) {
        if (data.quest.due_date) {
            this.dueDate = new Date(data.quest.due_date);
        }
    }

    onSave() {
        this.dialogRef.close(this.dueDate);
    }
}
