import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ClassroomService } from '../../../services/classroom.service';
import { AuthService } from '../../../services/auth.service';
import { ListService, ListShare } from '../../../services/list.service';
import { SharedMaterialModule } from '../../../shared-material.module';
import { Classroom } from '../../../models/classroom.interface';

export interface CreateQuestDialogData {
  classId?: string;
  className?: string;
  listId?: string;
}

@Component({
  selector: 'app-assign-quest-dialog',
  standalone: true,
  imports: [CommonModule, SharedMaterialModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title>Create Quest</h2>
    <mat-dialog-content [formGroup]="form">
      <p class="subtitle" *ngIf="data?.className">Creating quest for <strong>{{ data.className }}</strong></p>

      <mat-form-field appearance="fill" class="full-width">
        <mat-label>Select List</mat-label>
        <mat-select formControlName="listId">
          <mat-option *ngFor="let list of lists" [value]="list.word_list_id">
            {{ list.word_lists?.name }}
          </mat-option>
        </mat-select>
        <mat-error *ngIf="form.get('listId')?.hasError('required')">
          List is required
        </mat-error>
      </mat-form-field>

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
        {{ loading ? 'Creating...' : 'Create' }}
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
  lists: ListShare[] = [];
  loading = false;

  constructor(
    private fb: FormBuilder,
    private classroomService: ClassroomService,
    private listService: ListService,
    private auth: AuthService,
    private dialogRef: MatDialogRef<AssignQuestDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CreateQuestDialogData
  ) {
    this.form = this.fb.group({
      listId: [null, Validators.required],
      classroomId: [[], Validators.required],
      dueDate: [null],
      instructions: ['']
    });
  }

  ngOnInit(): void {
    const user = this.auth.currentUser;
    if (user) {
      // Fetch classrooms
      this.classroomService.getClassrooms(user.id).subscribe(classes => {
        this.classrooms = classes;
        // Pre-select the class if provided
        if (this.data?.classId) {
          this.form.get('classroomId')?.setValue([this.data.classId]);
        } else if (classes.length === 1) {
          this.form.get('classroomId')?.setValue([classes[0].id]);
        }
      });

      // Fetch user's lists
      this.listService.getMyLists(user.id).subscribe(lists => {
        this.lists = lists;
        // Auto-select if only one list OR if listId is provided in data
        if (this.data?.listId) {
          this.form.get('listId')?.setValue(this.data.listId);
        } else if (lists.length === 1) {
          this.form.get('listId')?.setValue(lists[0].word_list_id);
        }
      });
    }
  }

  onSubmit() {
    if (this.form.valid) {
      this.loading = true;
      const formVal = this.form.value;
      const classroomIds: string[] = formVal.classroomId;
      const listId: string = formVal.listId;

      // Create a quest for each selected class
      const promises = classroomIds.map(clsId => {
        return this.classroomService.createQuest({
          classroom_id: clsId,
          list_id: listId,
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
        alert('Failed to create quest. Please try again.');
      });
    }
  }
}
