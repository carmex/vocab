import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSliderModule } from '@angular/material/slider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ListService, ListShare } from '../../../services/list.service';
import { SupabaseService } from '../../../services/supabase.service';
import { ListType } from '../../../models/list-type.enum';

@Component({
  selector: 'app-generate-sentences-modal',
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
    MatIconModule,
    MatListModule,
    MatProgressBarModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="modal-header">
      <h2 mat-dialog-title>
        <mat-icon class="header-icon">auto_stories</mat-icon>
        Generate Sentences
      </h2>
    </div>

    <mat-dialog-content>
      <div *ngIf="loadingLists" class="loading-container">
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        <p>Loading your lists...</p>
      </div>

      <div *ngIf="!loadingLists && sourceLists.length === 0" class="empty-state">
        <mat-icon>format_list_bulleted</mat-icon>
        <p>No Sight Word lists found. create one first!</p>
      </div>

      <div *ngIf="!loadingLists && sourceLists.length > 0">
        <div class="section">
          <label class="section-label">Select Source Lists</label>
          <p class="subtitle">Sentences will be generated using words from these lists.</p>
          
          <div class="list-selection-container">
            <mat-selection-list #lists [(ngModel)]="selectedLists">
              <mat-list-option *ngFor="let list of sourceLists" [value]="list" color="primary">
                <div class="list-option-content">
                  <span class="list-name">{{ list.word_lists?.name }}</span>
                  <span class="list-count">{{ list.word_lists?.list_words?.[0]?.count || 0 }} words</span>
                </div>
              </mat-list-option>
            </mat-selection-list>
          </div>
        </div>

        <div class="section no-border">
          <div class="quantity-header">
              <label class="section-label">Number of Sentences</label>
              <span class="count-badge">{{ count }}</span>
          </div>
          
          <div class="slider-container">
              <span class="slider-min">5</span>
              <mat-slider [min]="5" [max]="30" step="1" discrete class="full-width-slider">
                  <input matSliderThumb [(ngModel)]="count">
              </mat-slider>
              <span class="slider-max">30</span>
          </div>
        </div>
      </div>

      <div *ngIf="isGenerating" class="generating-overlay">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Generating sentences with AI...</p>
      </div>
    </mat-dialog-content>
    
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close class="cancel-btn" [disabled]="isGenerating">Cancel</button>
      <button mat-raised-button color="primary" (click)="generate()" 
        [disabled]="selectedLists.length === 0 || isGenerating || loadingLists" class="generate-btn">
        <span *ngIf="!isGenerating">Generate</span>
        <span *ngIf="isGenerating">Generating...</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
        display: block;
        width: 100%;
        max-width: 500px;
    }

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
        color: #3f51b5;
    }

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
        margin-bottom: 4px;
    }

    .subtitle {
      font-size: 0.85rem;
      color: #888;
      margin-top: 0;
      margin-bottom: 12px;
    }

    .list-selection-container {
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }

    .list-option-content {
      display: flex;
      justify-content: space-between;
      width: 100%;
      align-items: center;
    }

    .list-name {
      font-weight: 500;
    }

    .list-count {
      font-size: 0.8rem;
      color: #888;
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

    .loading-container {
      text-align: center;
      padding: 40px;
      color: #888;
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: #888;
      
      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        opacity: 0.5;
        margin-bottom: 16px;
      }
    }

    :host-context(body.dark-mode) {
        .header-icon { color: #9fa8da; }
        .section { border-bottom-color: rgba(255,255,255,0.1); }
        .section-label { color: #b0b0b0; }
        .subtitle { color: #aaa; }
        .list-selection-container { border-color: #424242; }
        .count-badge { background-color: rgba(63, 81, 181, 0.2); color: #9fa8da; }
        .slider-min, .slider-max { color: #aaa; }
    }
  `]
})
export class GenerateSentencesModalComponent implements OnInit {
  sourceLists: ListShare[] = [];
  selectedLists: ListShare[] = [];
  loadingLists = true;
  isGenerating = false;
  count = 10;

  constructor(
    private dialogRef: MatDialogRef<GenerateSentencesModalComponent>,
    private listService: ListService,
    private supabaseService: SupabaseService
  ) { }

  ngOnInit() {
    this.loadingLists = true;
    this.listService.getMyLists().subscribe({
      next: (lists) => {
        // Filter for SIGHT_WORDS lists only
        this.sourceLists = lists.filter(l =>
          l.word_lists?.list_type === ListType.SIGHT_WORDS
        );
        this.loadingLists = false;
      },
      error: (err) => {
        console.error('Error fetching lists:', err);
        this.loadingLists = false;
      }
    });
  }

  async generate() {
    if (this.selectedLists.length === 0) return;
    this.isGenerating = true;

    try {
      // 1. Fetch words from selected lists
      const allWords = new Set<string>();

      for (const list of this.selectedLists) {
        const words = await this.listService.getWords(list.word_list_id).toPromise();
        if (words) {
          words.forEach(w => {
            if (w.word && w.word.trim()) allWords.add(w.word.trim());
          });
        }
      }

      const uniqueWords = Array.from(allWords);

      if (uniqueWords.length === 0) {
        alert('No words found in the selected lists.');
        this.isGenerating = false;
        return;
      }

      // 2. Call Edge Function
      const payload = {
        words: uniqueWords,
        count: this.count
      };
      console.log('Sending payload to generate-sentences:', payload);

      const { data, error } = await this.supabaseService.client.functions.invoke('generate-sentences', {
        body: payload
      });

      if (error) throw error;

      // 3. Return results
      this.dialogRef.close(data);

    } catch (err: any) {
      console.error('Generation error:', err);
      alert('Failed to generate sentences: ' + (err.message || 'Unknown error'));
    } finally {
      this.isGenerating = false;
    }
  }
}
