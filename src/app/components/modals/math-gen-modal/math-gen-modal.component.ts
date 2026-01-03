import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSliderModule } from '@angular/material/slider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

export interface MathGenResult {
  word: string;
  definition: string;
}

@Component({
  selector: 'app-math-gen-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatSliderModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>Generate Math Problems</h2>
    <mat-dialog-content>
      <div class="config-section">
        <h3>Operations</h3>
        <div class="ops-row">
          <mat-checkbox [(ngModel)]="ops.add" (change)="recalc()" color="primary">Add (+)</mat-checkbox>
          <mat-checkbox [(ngModel)]="ops.sub" (change)="recalc()" color="primary">Subtract (-)</mat-checkbox>
          <mat-checkbox [(ngModel)]="ops.mul" (change)="recalc()" color="warn">Multiply (×)</mat-checkbox>
          <mat-checkbox [(ngModel)]="ops.div" (change)="recalc()" color="warn">Divide (÷)</mat-checkbox>
        </div>
        <div class="opts-row">
            <mat-checkbox [(ngModel)]="allowNegatives" (change)="recalc()">Allow Negative Results</mat-checkbox>
        </div>
      </div>

      <div class="config-section">
        <h3>Number Ranges</h3>
        <div class="range-row">
          <label>First Number:</label>
          <mat-form-field appearance="outline" class="range-input">
            <input matInput type="number" [(ngModel)]="range1.min" (change)="recalc()">
          </mat-form-field>
          <span>to</span>
          <mat-form-field appearance="outline" class="range-input">
            <input matInput type="number" [(ngModel)]="range1.max" (change)="recalc()">
          </mat-form-field>
        </div>

        <div class="range-row">
          <label>Second Number:</label>
          <mat-form-field appearance="outline" class="range-input">
            <input matInput type="number" [(ngModel)]="range2.min" (change)="recalc()">
          </mat-form-field>
          <span>to</span>
          <mat-form-field appearance="outline" class="range-input">
            <input matInput type="number" [(ngModel)]="range2.max" (change)="recalc()">
          </mat-form-field>
        </div>
      </div>

      <div class="config-section">
        <h3>Quantity: {{ count }} Cards</h3>
        <div class="slider-container">
            <span>4</span>
            <mat-slider [min]="4" [max]="maxCards" step="1" discrete class="full-width-slider">
                <input matSliderThumb [(ngModel)]="count">
            </mat-slider>
            <span>{{ maxCards }}</span>
        </div>
        <div class="info-text" *ngIf="maxCards < 4">
            <mat-icon inline>warning</mat-icon> Not enough combinations. Increase range or select more operations.
        </div>
      </div>

    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" (click)="generate()" [disabled]="!canGenerate()">Generate</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .config-section {
      margin-bottom: 24px;
    }
    .config-section h3 {
      margin-bottom: 12px;
      font-size: 1rem;
      font-weight: 500;
      color: #333;
    }
    .ops-row {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .opts-row {
        margin-top: 12px;
    }
    .range-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .range-input {
      width: 80px;
    }
    .range-input::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none; /* Hide error spacer if not needed */
    }
    .slider-container {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .full-width-slider {
        flex: 1;
    }
    .info-text {
        color: #f44336;
        font-size: 0.85rem;
        margin-top: 8px;
        display: flex;
        align-items: center;
        gap: 4px;
    }
    
    /* Dark Mode Support */
    :host-context(body.dark-mode) {
        .config-section h3 {
            color: #ccc;
        }
    }
  `]
})
export class MathGenModalComponent {
  ops = { add: true, sub: true, mul: false, div: false };
  range1 = { min: 1, max: 12 };
  range2 = { min: 1, max: 12 };
  allowNegatives = false;

  count = 20;
  maxCards = 100;

  pool: MathGenResult[] = [];

  constructor(private dialogRef: MatDialogRef<MathGenModalComponent>) {
    this.recalc();
  }

  recalc() {
    this.pool = [];

    // Safety check for inputs
    const r1min = Number(this.range1.min);
    const r1max = Number(this.range1.max);
    const r2min = Number(this.range2.min);
    const r2max = Number(this.range2.max);

    if (this.ops.add) {
      for (let i = r1min; i <= r1max; i++) {
        for (let j = r2min; j <= r2max; j++) {
          const res = i + j;
          if (!this.allowNegatives && res < 0) continue;
          this.pool.push({ word: `${i} + ${j}`, definition: `${res}` });
        }
      }
    }

    if (this.ops.sub) {
      for (let i = r1min; i <= r1max; i++) {
        for (let j = r2min; j <= r2max; j++) {
          const res = i - j;
          if (!this.allowNegatives && res < 0) continue;
          this.pool.push({ word: `${i} - ${j}`, definition: `${res}` });
        }
      }
    }

    if (this.ops.mul) {
      for (let i = r1min; i <= r1max; i++) {
        for (let j = r2min; j <= r2max; j++) {
          const res = i * j;
          if (!this.allowNegatives && res < 0) continue;
          this.pool.push({ word: `${i} × ${j}`, definition: `${res}` });
        }
      }
    }

    if (this.ops.div) {
      for (let i = r1min; i <= r1max; i++) {
        for (let j = r2min; j <= r2max; j++) {
          if (j === 0) continue; // No division by zero

          const res = i / j;
          if (!this.allowNegatives && res < 0) continue;

          // Integer check
          if (Number.isInteger(res)) {
            this.pool.push({ word: `${i} ÷ ${j}`, definition: `${res}` });
          }
        }
      }
    }

    this.maxCards = this.pool.length;

    // Adjust count if out of bounds
    if (this.count > this.maxCards) this.count = this.maxCards;
    if (this.count < 4 && this.maxCards >= 4) this.count = 4;
    // If maxCards < 4, count will be clamped by logic but generate() will just return all.
  }

  canGenerate(): boolean {
    return this.pool.length > 0;
  }

  generate() {
    // Sequential
    const selected = this.pool.slice(0, Math.max(0, Math.min(this.count, this.maxCards)));

    this.dialogRef.close(selected);
  }
}
