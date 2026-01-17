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
    <div class="modal-header">
      <h2 mat-dialog-title>
        <mat-icon class="header-icon">calculate</mat-icon>
        Math Problems
      </h2>
    </div>

    <mat-dialog-content>
      <div class="section">
        <label class="section-label">Select Operations</label>
        <div class="ops-grid">
          <div class="op-card" [class.selected]="ops.add" (click)="toggleOp('add')">
            <div class="op-symbol">+</div>
            <div class="op-name">Add</div>
            <div class="op-check" *ngIf="ops.add"><mat-icon>check_circle</mat-icon></div>
          </div>
          <div class="op-card" [class.selected]="ops.sub" (click)="toggleOp('sub')">
            <div class="op-symbol">−</div>
            <div class="op-name">Subtract</div>
            <div class="op-check" *ngIf="ops.sub"><mat-icon>check_circle</mat-icon></div>
          </div>
          <div class="op-card" [class.selected]="ops.mul" (click)="toggleOp('mul')">
            <div class="op-symbol">×</div>
            <div class="op-name">Multiply</div>
            <div class="op-check" *ngIf="ops.mul"><mat-icon>check_circle</mat-icon></div>
          </div>
          <div class="op-card" [class.selected]="ops.div" (click)="toggleOp('div')">
            <div class="op-symbol">÷</div>
            <div class="op-name">Divide</div>
            <div class="op-check" *ngIf="ops.div"><mat-icon>check_circle</mat-icon></div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="options-row">
           <mat-checkbox [(ngModel)]="allowNegatives" (change)="recalc()" color="primary">
             Allow Negative Results
           </mat-checkbox>
        </div>
      </div>

      <div class="section">
        <label class="section-label">Number Ranges</label>
        <div class="ranges-grid">
            <div class="range-group">
                <span class="range-label">First Number</span>
                <div class="range-inputs">
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                        <input matInput type="number" [(ngModel)]="range1.min" (change)="recalc()">
                    </mat-form-field>
                    <span class="range-sep">to</span>
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                        <input matInput type="number" [(ngModel)]="range1.max" (change)="recalc()">
                    </mat-form-field>
                </div>
            </div>
            
            <div class="range-group">
                <span class="range-label">Second Number</span>
                <div class="range-inputs">
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                        <input matInput type="number" [(ngModel)]="range2.min" (change)="recalc()">
                    </mat-form-field>
                    <span class="range-sep">to</span>
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                        <input matInput type="number" [(ngModel)]="range2.max" (change)="recalc()">
                    </mat-form-field>
                </div>
            </div>
        </div>
      </div>

      <div class="section no-border">
        <div class="quantity-header">
            <label class="section-label">Quantity</label>
            <span class="count-badge">{{ count }} Cards</span>
        </div>
        
        <div class="slider-container">
            <span class="slider-min">4</span>
            <mat-slider [min]="4" [max]="maxCards || 4" step="1" discrete class="full-width-slider">
                <input matSliderThumb [(ngModel)]="count">
            </mat-slider>
            <span class="slider-max">{{ maxCards }}</span>
        </div>

        <div class="warning-box" *ngIf="maxCards < 4">
            <mat-icon inline>warning</mat-icon> 
            <span>Not enough combinations available.</span>
        </div>
      </div>

    </mat-dialog-content>
    
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close class="cancel-btn">Cancel</button>
      <button mat-raised-button color="primary" (click)="generate()" [disabled]="!canGenerate()" class="generate-btn">
        Generate Problems
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
        display: block;
        width: 100%;
        max-width: 500px;
    }

    /* Header */
    .modal-header {
        display: flex;
        align-items: center;
        padding: 0px 24px 0px; 
    }
    
    h2[mat-dialog-title] {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 1.5rem;
        margin: 0;
        padding-top: 20px;
        padding-bottom: 5px;
    }
    
    .header-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: #3f51b5; /* Primary color */
    }

    /* General Layout */
    .section {
        margin-bottom: 24px;
        padding-bottom: 15px;
        border-bottom: 1px solid rgba(0,0,0,0.08);
    }

    .section.no-border {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
    }

    .section-label {
        display: block;
        font-size: 0.85rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #666;
        margin-bottom: 12px;
    }

    /* Operation Cards */
    .ops-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
    }

    .op-card {
        border: 2px solid #e0e0e0;
        border-radius: 12px;
        padding: 12px 8px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        background-color: #fafafa;
        user-select: none;
        min-width: 0; /* Fix flex/grid overflow issues */
    }

    .op-card:hover {
        border-color: #9fa8da;
        background-color: #f5f5f5;
        transform: translateY(-2px);
    }

    .op-card.selected {
        border-color: #3f51b5;
        background-color: #e8eaf6;
        color: #3f51b5;
    }

    .op-symbol {
        font-size: 2rem;
        font-weight: 300;
        line-height: 1;
        margin-bottom: 4px;
    }

    .op-name {
        font-size: 0.75rem;
        font-weight: 500;
    }

    .op-check {
        position: absolute;
        top: -6px;
        right: -6px;
        color: #3f51b5;
        background: white;
        border-radius: 50%;
        height: 24px;
        width: 24px;
    }
    
    .op-check mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
    }

    /* Options */
    .options-row {
        margin-top: -5px; /* Pull up closer to line */
    }

    /* Ranges */
    .ranges-grid {
        display: grid;
        gap: 16px;
    }
    
    .range-group {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
    }
    
    .range-label {
        font-size: 0.95rem;
        font-weight: 500;
        width: 120px;
    }
    
    .range-inputs {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
    }
    
    .range-inputs mat-form-field {
        width: 80px;
        font-size: 0.9rem;
        flex: 1;
    }
    
    .range-inputs mat-form-field::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
    }

    .range-sep {
        color: #888;
        font-size: 0.9rem;
    }

    /* Quantity */
    .quantity-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 10px;
    }
    
    .count-badge {
        background-color: #e8eaf6;
        color: #3f51b5;
        padding: 4px 12px;
        border-radius: 16px;
        font-weight: bold;
        font-size: 0.9rem;
    }

    .slider-container {
        display: flex;
        align-items: center;
        gap: 16px;
        height: 48px;
    }
    
    .full-width-slider {
        flex: 1;
    }
    
    .slider-min, .slider-max {
        font-weight: 500;
        color: #666;
        width: 30px;
        text-align: center;
    }

    .warning-box {
        margin-top: 8px;
        background-color: #ffebee;
        color: #c62828;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    /* Buttons */
    .generate-btn {
        padding: 0 24px;
    }

    /* Mobile Responsiveness */
    @media (max-width: 600px) {
        .ops-grid {
            grid-template-columns: repeat(2, 1fr);
        }
        
        .range-group {
            flex-direction: column;
            align-items: flex-start;
        }
        
        .range-inputs {
            width: 100%;
        }
    }

    /* Dark Mode Overrides */
    :host-context(body.dark-mode) {
        .header-icon { color: #9fa8da; }
        .section { border-bottom-color: rgba(255,255,255,0.1); }
        .section-label { color: #b0b0b0; }
        
        .op-card {
            background-color: #2c2c2c; /* Slightly lighter than card bg */
            border-color: #424242;
            color: #e0e0e0;
        }
        .op-card:hover {
            border-color: #9fa8da;
            background-color: #383838;
        }
        .op-card.selected {
            border-color: #7986cb;
            background-color: rgba(63, 81, 181, 0.2);
            color: #9fa8da;
        }
        .op-check {
            background: #1e1e1e; /* Match modal bg */
            color: #7986cb;
        }
        
        .range-sep { color: #aaa; }
        
        .count-badge {
            background-color: rgba(63, 81, 181, 0.2);
            color: #9fa8da;
        }
        
        .slider-min, .slider-max { color: #aaa; }
        
        .warning-box {
            background-color: rgba(244, 67, 54, 0.1);
            color: #ef9a9a;
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

  toggleOp(op: 'add' | 'sub' | 'mul' | 'div') {
    this.ops[op] = !this.ops[op];
    this.recalc();
  }

  recalc() {
    this.pool = [];

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
          if (j === 0) continue;
          const res = i / j;
          if (!this.allowNegatives && res < 0) continue;
          if (Number.isInteger(res)) {
            this.pool.push({ word: `${i} ÷ ${j}`, definition: `${res}` });
          }
        }
      }
    }

    this.maxCards = this.pool.length;

    if (this.count > this.maxCards) this.count = this.maxCards;
    if (this.count < 4 && this.maxCards >= 4) this.count = 4;
  }

  canGenerate(): boolean {
    return this.pool.length > 0;
  }

  generate() {
    // Random selection
    const indices = Array.from({ length: this.pool.length }, (_, k) => k);

    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const limit = Math.max(0, Math.min(this.count, this.pool.length));
    const selectedIndices = indices.slice(0, limit).sort((a, b) => a - b);
    const selected = selectedIndices.map(i => this.pool[i]);

    this.dialogRef.close(selected);
  }
}
