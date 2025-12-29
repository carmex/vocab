import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ClassroomService } from '../../../services/classroom.service';
import { AuthService } from '../../../services/auth.service';
import { SharedMaterialModule } from '../../../shared-material.module';
import { Classroom } from '../../../models/classroom.interface';

@Component({
  selector: 'app-assign-quest-dialog',
  standalone: true,
  imports: [CommonModule, SharedMaterialModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title>Assign Quest</h2>
    <mat-dialog-content [formGroup]="form">
      <p class="subtitle">Assigning <strong>{{ data.listName }}</strong> to your class.</p>

      <mat-form-field appearance="fill" class="full-width">
        <mat-label>Select Class</mat-label>
        <mat-select formControlName="classroomId" multiple>
          <mat-option *ngFor="let cls of classrooms" [value]="cls.id">
            {{ cls.name }}
          </mat-option>
        </mat-select>
        <mat-error *ngIf="form.get('classroomId')?.hasError('required')">
          Class is required
        </mat-error>
      </mat-form-field>

      <mat-form-field appearance="fill" class="full-width">
        <mat-label>Due Date</mat-label>
        <input matInput [matDatepicker]="picker" formControlName="dueDate">
        <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
        <mat-datepicker #picker></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="fill" class="full-width">
        <mat-label>Instructions (Optional)</mat-label>
        <textarea matInput formControlName="instructions" rows="3" placeholder="e.g. Focus on spelling..."></textarea>
      </mat-form-field>

    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" (click)="onSubmit()" [disabled]="form.invalid || loading">
        {{ loading ? 'Assigning...' : 'Create Quest' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width { width: 100%; margin-bottom: 10px; }
    .subtitle { margin-bottom: 20px; color: #666; }
  `]
})
export class AssignQuestDialogComponent implements OnInit {
  form: FormGroup;
  classrooms: Classroom[] = [];
  loading = false;

  constructor(
    private fb: FormBuilder,
    private classroomService: ClassroomService,
    private auth: AuthService,
    private dialogRef: MatDialogRef<AssignQuestDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { listId: string, listName: string }
  ) {
    this.form = this.fb.group({
      classroomId: [[], Validators.required], // Array for multiple selection
      dueDate: [null],
      instructions: ['']
    });
  }

  ngOnInit(): void {
    const user = this.auth.currentUser;
    if (user) {
      this.classroomService.getClassrooms(user.id).subscribe(classes => {
        this.classrooms = classes;
        // Auto-select if only one class
        if (classes.length === 1) {
          this.form.get('classroomId')?.setValue([classes[0].id]);
        }
      });
    }
  }

  onSubmit() {
    if (this.form.valid) {
      this.loading = true;
      const formVal = this.form.value;
      const classroomIds: string[] = formVal.classroomId;

      // Create a quest for each selected class
      const promises = classroomIds.map(clsId => {
        return this.classroomService.createQuest({
          classroom_id: clsId,
          list_id: this.data.listId,
          due_date: formVal.dueDate,
          instructions: formVal.instructions
        }).toPromise();
      });

      Promise.all(promises).then((results) => {
        // Calculate total students
        const totalStudents = this.classrooms
          .filter(c => classroomIds.includes(c.id))
          .reduce((sum, c) => sum + (c.student_count || 0), 0);

        this.dialogRef.close({ count: results.length, studentCount: totalStudents });
      }).catch(err => {
        console.error(err);
        this.loading = false;
        alert('Failed to assign quest. Please try again.');
      });
    }
  }
}
