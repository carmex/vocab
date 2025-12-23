import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ListService } from '../../services/list.service';
import { SupabaseService } from '../../services/supabase.service';
import { environment } from '../../../environments/environment';
import { TopNavComponent } from '../top-nav/top-nav.component';
import { TwemojiPipe } from '../../pipes/twemoji.pipe';

export interface WordRow {
  id?: string;
  word: string;
  definition: string;
}

@Component({
  selector: 'app-list-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatProgressBarModule,
    MatCheckboxModule,
    ScrollingModule,
    TopNavComponent,
    TwemojiPipe
  ],
  template: `
    <div class="editor-container">
      <app-top-nav backLink="/dashboard"></app-top-nav>
      <h1>{{ isEditMode ? 'Edit List' : 'Create New List' }}</h1>
      
      <mat-card class="editor-card">
        <mat-card-content>
          <div class="list-details">
            <mat-form-field appearance="fill" class="full-width">
              <mat-label>List Name</mat-label>
              <input matInput [(ngModel)]="name" placeholder="e.g. Spanish Verbs" required>
            </mat-form-field>

            <mat-form-field appearance="fill" class="full-width">
              <mat-label>Description</mat-label>
              <textarea matInput [(ngModel)]="description" placeholder="Optional description"></textarea>
            </mat-form-field>

            <div class="toggle-container">
              <mat-slide-toggle 
                [(ngModel)]="isPublic" 
                color="primary"
                [disabled]="isAnonymous"
                [matTooltip]="isAnonymous ? 'Create an account to make public lists' : ''">
                Make Public (Visible in Marketplace)
              </mat-slide-toggle>
            </div>
          </div>

          <div class="words-header-container">
            <h3>Words</h3>
            <mat-checkbox [(ngModel)]="isCompactMode" color="primary">Compact Mode</mat-checkbox>
          </div>
          <div class="words-list-container">
            <cdk-virtual-scroll-viewport [itemSize]="isCompactMode ? 50 : 280" class="words-viewport">
              <div *cdkVirtualFor="let row of words; let i = index" class="word-row-wrapper" [style.height.px]="isCompactMode ? 50 : 280">
                
                <!-- Compact View -->
                <div class="compact-row" *ngIf="isCompactMode">
                  <span class="compact-number">#{{ i + 1 }}</span>
                  <span class="compact-word">{{ row.word || '(Empty)' }}</span>
                </div>

                <!-- Full Card View -->
                <div class="word-card" *ngIf="!isCompactMode">
                  <div class="card-header">
                    <span class="card-number">#{{ i + 1 }}</span>
                    <button mat-icon-button color="warn" (click)="removeWord(i)" *ngIf="words.length > 1 || isEditMode" matTooltip="Delete Word">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                  <div class="card-content">
                    <mat-form-field appearance="outline" class="word-input">
                      <mat-label>Word</mat-label>
                      <input matInput [(ngModel)]="row.word" required>
                      <mat-hint *ngIf="hasEmoji(row.word)" align="start">
                        <span class="emoji-preview" [innerHTML]="row.word | twemoji"></span>
                      </mat-hint>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="def-input">
                      <mat-label>Definition</mat-label>
                      <input matInput [(ngModel)]="row.definition" required>
                      <mat-hint *ngIf="hasEmoji(row.definition)" align="start">
                        <span class="emoji-preview" [innerHTML]="row.definition | twemoji"></span>
                      </mat-hint>
                    </mat-form-field>
                  </div>
                  </div>
                </div>
            </cdk-virtual-scroll-viewport>
          </div>

          <div class="actions">
            <button mat-stroked-button (click)="addWord()">
              <mat-icon>add</mat-icon> Add Word
            </button>
            <button mat-stroked-button (click)="fileInput.click()" style="margin-left: 10px;" [disabled]="isImporting || isUploading || isProcessingImage">
              <mat-icon>upload_file</mat-icon> {{ isImporting ? 'Importing...' : 'Import JSON' }}
            </button>
            <input #fileInput type="file" (change)="onFileSelected($event)" style="display: none" accept=".json">

            <button mat-stroked-button (click)="imageInput.click()" style="margin-left: 10px;" [disabled]="isImporting || isUploading || isProcessingImage">
              <mat-icon>photo_library</mat-icon> {{ isProcessingImage ? 'Processing...' : 'Gallery' }}
            </button>
            <input #imageInput type="file" (change)="onImageSelected($event)" style="display: none" accept="image/*">

            <button mat-stroked-button (click)="cameraInput.click()" style="margin-left: 10px;" [disabled]="isImporting || isUploading || isProcessingImage">
              <mat-icon>camera_alt</mat-icon> {{ isProcessingImage ? 'Processing...' : 'Camera' }}
            </button>
            <input #cameraInput type="file" (change)="onImageSelected($event)" style="display: none" accept="image/*" capture="environment">
          </div>

          <div class="import-progress" *ngIf="isImporting">
            <mat-progress-bar mode="determinate" [value]="importProgress"></mat-progress-bar>
            <span class="progress-text">Processing... {{ importProgress }}%</span>
          </div>

          <div class="import-progress" *ngIf="isUploading">
            <mat-progress-bar mode="determinate" [value]="uploadProgress" color="accent"></mat-progress-bar>
            <span class="progress-text">Uploading... {{ uploadProgress }}%</span>
          </div>

        </mat-card-content>
        <mat-card-actions align="end">
          <button mat-button (click)="onCancel()" [disabled]="saving || isUploading">Cancel</button>
          <button mat-raised-button color="primary" (click)="onSave()" [disabled]="!isValid() || saving || isUploading">
            {{ saving || isUploading ? 'Saving...' : 'Save List' }}
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .editor-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 10px;
    }
    .editor-card {
      padding: 20px;
    }
    .full-width {
      width: 100%;
      margin-bottom: 10px;
    }
    .toggle-container {
      margin-bottom: 20px;
    }
    .words-list-container {
      height: 640px; /* Fixed height for virtual scroll */
      border: 1px solid #eee;
      border-radius: 4px;
      margin-bottom: 10px;
      background-color: #fafafa;
    }
    .words-viewport {
      height: 100%;
      width: 100%;
    }
    .word-row-wrapper {
      padding: 10px;
      box-sizing: border-box;
      height: 280px; /* Match itemSize */
    }
    .word-card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      height: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 10px;
      border-bottom: 1px solid #f0f0f0;
      background-color: #f9f9f9;
      border-radius: 8px 8px 0 0;
    }
    .card-number {
      font-weight: bold;
      color: #777;
      font-size: 0.9rem;
    }
    .card-content {
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 15px;
      flex: 1;
    }
    .word-input, .def-input {
      width: 100%;
    }
    .actions {
      margin-top: 20px;
      margin-bottom: 20px;
    }
    .import-progress {
      margin-top: 20px;
      margin-bottom: 20px;
    }
    .progress-text {
      display: block;
      margin-top: 5px;
      font-size: 0.9rem;
      color: #666;
      text-align: center;
      color: #666;
      text-align: center;
    }
    .emoji-preview {
      font-size: 1.5em;
      opacity: 1;
      margin-top: 5px;
      display: inline-block;
    }
    .words-header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .words-header-container h3 {
      margin: 0;
    }
    .compact-row {
      display: flex;
      align-items: center;
      padding: 0 10px;
      height: 100%;
      border-bottom: 1px solid #eee;
      background: white;
    }
    .compact-number {
      font-weight: bold;
      color: #777;
      min-width: 40px;
      margin-right: 10px;
      flex-shrink: 0;
    }
    .compact-word {
      font-size: 1rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `]
})
export class ListEditorComponent implements OnInit {
  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;
  listId: string | null = null;
  isEditMode = false;
  isCompactMode = false;

  name = '';
  description = '';
  isPublic = false;
  words: WordRow[] = [{ word: '', definition: '' }];
  deletedWordIds: string[] = [];

  saving = false;
  importProgress = 0;
  isImporting = false;
  uploadProgress = 0;

  isUploading = false;
  isProcessingImage = false;

  constructor(
    private listService: ListService,
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService,
    private supabaseService: SupabaseService
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params: any) => {
      const id = params.get('id');
      if (id) {
        this.listId = id;
        this.isEditMode = true;
        this.loadList(id);
      }
    });
  }

  loadList(id: string) {
    this.listService.getListDetails(id).subscribe((details: any) => {
      this.name = details.metadata.name;
      this.description = details.metadata.description;
      this.isPublic = details.metadata.is_public;
    });

    this.listService.getWords(id).subscribe((words: any[]) => {
      this.words = words.map((w: any) => ({ id: w.id, word: w.word, definition: w.definition }));
      if (this.words.length === 0) {
        this.words.push({ word: '', definition: '' });
      }
    });
  }

  addWord() {
    // Create a new array reference to trigger change detection
    this.words = [...this.words, { word: '', definition: '' }];

    // Scroll to the bottom after the view updates
    setTimeout(() => {
      if (this.viewport) {
        this.viewport.scrollToIndex(this.words.length - 1, 'smooth');
      }
    }, 100);
  }

  removeWord(index: number) {
    if (index < 0 || index >= this.words.length) {
      return;
    }
    const word = this.words[index];
    if (word && word.id) {
      this.deletedWordIds.push(word.id);
    }
    this.words.splice(index, 1);
    // Trigger change detection for virtual scroll
    this.words = [...this.words];
  }

  isValid(): boolean {
    return this.name.trim().length > 0 &&
      this.words.every(w => w.word.trim().length > 0 && w.definition.trim().length > 0);
  }

  onCancel() {
    this.router.navigate(['/dashboard']);
  }

  async onSave() {
    console.log('onSave called');
    if (!this.isValid()) {
      console.log('Form invalid');
      return;
    }
    this.saving = true;
    console.log('Saving started, isEditMode:', this.isEditMode);

    try {
      if (this.isEditMode && this.listId) {
        console.log('Updating existing list:', this.listId);
        // Update existing list
        await this.listService.updateList(this.listId, this.name, this.description, this.isPublic).toPromise();
        await this.listService.syncWords(this.listId, this.words, this.deletedWordIds).toPromise();
        console.log('Update complete');
        this.router.navigate(['/dashboard']);
      } else {
        console.log('Creating new list');
        // Create new list
        const listId = await this.listService.createList(this.name, this.description, this.isPublic).toPromise();
        console.log('List created with ID:', listId);

        if (listId) {
          // Use Worker for adding words if we have a lot (e.g. > 50), otherwise normal service
          console.log('Word count:', this.words.length);
          if (this.words.length > 50 && typeof Worker !== 'undefined') {
            console.log('Offloading to worker');
            this.uploadWordsWithWorker(listId, this.words);
          } else {
            console.log('Using standard service upload');
            await this.listService.addWords(listId, this.words).toPromise();
            console.log('Standard upload complete');
            this.router.navigate(['/dashboard']);
          }
        } else {
          console.error('No list ID returned');
        }
      }
    } catch (err) {
      console.error('Error in onSave:', err);
      this.handleError(err);
    }
  }

  private async uploadWordsWithWorker(listId: string, words: WordRow[]) {
    console.log('Starting worker upload for list:', listId);
    this.isUploading = true;
    this.uploadProgress = 0;

    try {
      const { data: { session } } = await this.supabaseService.client.auth.getSession();
      const token = session?.access_token;
      console.log('Session token retrieved:', !!token);

      if (!token) {
        this.handleError('No active session found for upload.');
        this.isUploading = false;
        this.saving = false;
        return;
      }

      console.log('Initializing worker...');
      const worker = new Worker(new URL('../../workers/list-upload.worker', import.meta.url));
      console.log('Worker initialized');

      worker.onmessage = ({ data }) => {
        console.log('Worker message:', data.type);
        if (data.type === 'progress') {
          this.uploadProgress = data.value;
        } else if (data.type === 'result') {
          console.log('Worker finished successfully');
          worker.terminate();
          this.isUploading = false;
          this.router.navigate(['/dashboard']);
        } else if (data.type === 'error') {
          console.error('Worker reported error:', data.message);
          worker.terminate();
          this.isUploading = false;
          this.handleError(data.message);
        }
      };

      worker.onerror = (err) => {
        console.error('Worker error event:', err);
        this.isUploading = false;
        this.handleError('Worker initialization failed');
      };

      console.log('Posting message to worker');
      worker.postMessage({
        supabaseUrl: environment.supabase.url,
        supabaseKey: environment.supabase.key,
        authToken: token,
        listId: listId,
        words: words
      });
    } catch (err) {
      console.error('Error in uploadWordsWithWorker:', err);
      this.isUploading = false;
      this.handleError(err);
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.isImporting = true;
      this.importProgress = 0;

      const reader = new FileReader();
      reader.onload = (e: any) => {
        if (typeof Worker !== 'undefined') {
          // Create a new worker
          const worker = new Worker(new URL('../../workers/json-import.worker', import.meta.url));

          worker.onmessage = ({ data }) => {
            if (data.type === 'progress') {
              this.importProgress = data.value;
            } else if (data.type === 'result') {
              this.handleImportResult(data.words);
              worker.terminate();
              this.isImporting = false;
            } else if (data.type === 'error') {
              alert(data.message);
              worker.terminate();
              this.isImporting = false;
            }
          };

          worker.postMessage(e.target.result);
        } else {
          // Fallback for environments without Web Workers
          console.warn('Web Workers not supported, falling back to main thread.');
          try {
            const json = JSON.parse(e.target.result);
            if (Array.isArray(json)) {
              const newWords = json.map((item: any) => ({
                word: item.word || '',
                definition: item.definition || ''
              }));
              this.handleImportResult(newWords);
            } else {
              alert('Invalid JSON format.');
            }
          } catch (err) {
            alert('Error parsing JSON.');
          }
          this.isImporting = false;
        }
      };
      reader.readAsText(file);

      // Reset input
      event.target.value = '';
    }
  }

  async onImageSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.isProcessingImage = true;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await this.supabaseService.client.functions.invoke('image-to-vocab', {
        body: formData,
      });

      if (error) throw error;

      if (Array.isArray(data)) {
        const newWords = data.map((item: any) => ({
          word: item.word || '',
          definition: item.definition || ''
        }));
        this.handleImportResult(newWords);
      } else {
        alert('No words found in the image or invalid response format.');
      }

    } catch (err: any) {
      console.error('Error processing image:', err);
      alert('Failed to process image: ' + (err.message || 'Unknown error'));
    } finally {
      this.isProcessingImage = false;
      // Reset input
      event.target.value = '';
    }
  }

  private handleImportResult(newWords: WordRow[]) {
    // If the list only has one empty row, replace it. Otherwise append.
    if (this.words.length === 1 && !this.words[0].word && !this.words[0].definition) {
      this.words = newWords;
    } else {
      this.words = [...this.words, ...newWords];
    }
  }

  handleError(err: any) {
    console.error(err);
    alert('An error occurred while saving.');
    this.saving = false;
  }

  get isAnonymous(): boolean {
    return this.auth.isAnonymous;
  }

  hasEmoji(text: string): boolean {
    if (!text) return false;
    // Regex for checking if text contains emoji (Extended Pictographic or Regional Indicators for flags)
    return /(\p{Extended_Pictographic}|\p{Regional_Indicator})/u.test(text);
  }
}
