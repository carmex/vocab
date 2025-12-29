import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedMaterialModule } from '../../shared-material.module';
import { MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-create-class-modal',
  standalone: true,
  imports: [CommonModule, SharedMaterialModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title>Create New Class</h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field appearance="fill" class="full-width">
          <mat-label>Class Name</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Mrs. Smith's Homeroom">
          <mat-error *ngIf="form.get('name')?.hasError('required')">Name is required</mat-error>
        </mat-form-field>

        <mat-form-field appearance="fill" class="full-width">
          <mat-label>Grade Level</mat-label>
          <mat-select formControlName="grade_level">
            <mat-option *ngFor="let grade of grades" [value]="grade">
              {{ grade }}
            </mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid || isSubmitting" (click)="create()">
        Create
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width { width: 100%; margin-bottom: 16px; }
  `]
})
export class CreateClassModalComponent {
  form: FormGroup;
  isSubmitting = false;
  grades = [
    'Kindergarten',
    '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade',
    '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade',
    '11th Grade', '12th Grade',
    'Other'
  ];

  constructor(
    private fb: FormBuilder,
    private supabase: SupabaseService,
    private auth: AuthService,
    private dialogRef: MatDialogRef<CreateClassModalComponent>
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      grade_level: [null]
    });
  }

  async create() {
    if (this.form.invalid) return;
    this.isSubmitting = true;

    const { name, grade_level } = this.form.value;
    const { error } = await this.supabase.client
      .from('classrooms')
      .insert({
        name,
        grade_level,
        teacher_id: this.auth.currentUser!.id
      });

    this.isSubmitting = false;
    if (error) {
      console.error('Error creating class:', error);
      // snackbar?
    } else {
      this.dialogRef.close(true);
    }
  }
}
