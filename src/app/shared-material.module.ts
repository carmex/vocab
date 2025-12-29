import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';

import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';

@NgModule({
  imports: [
    MatButtonModule,
    MatProgressBarModule,
    MatDialogModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatFormFieldModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
    MatInputModule,
    MatMenuModule,
    MatSnackBarModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDividerModule
  ],
  exports: [
    MatButtonModule,
    MatProgressBarModule,
    MatDialogModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatFormFieldModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
    MatInputModule,
    MatMenuModule,
    MatSnackBarModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDividerModule
  ]
})
export class SharedMaterialModule { }