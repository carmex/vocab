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
import { ListType } from '../../models/list-type.enum';

export interface WordRow {
  id?: string;
  word: string;
  definition: string;
  imageUrl?: string;
  imageFile?: File;
  imagePreview?: string;
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
      <div class="list-type-badge" *ngIf="!isEditMode">
        <mat-icon>{{ getTypeIcon() }}</mat-icon>
        <span>{{ getTypeName() }}</span>
      </div>
      
      <mat-card class="editor-card">
        <mat-card-content>
          <div class="list-details">
            <mat-form-field appearance="fill" class="full-width">
              <mat-label>List Name</mat-label>
              <input matInput [(ngModel)]="name" [placeholder]="getNamePlaceholder()" required>
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
            <h3>{{ listType === ListType.SIGHT_WORDS ? 'Words' : 'Items' }}</h3>
            <mat-checkbox [(ngModel)]="isCompactMode" color="primary">Compact Mode</mat-checkbox>
          </div>
          <div class="words-list-container">
            <cdk-virtual-scroll-viewport [itemSize]="getItemSize()" class="words-viewport">
              <div *cdkVirtualFor="let row of words; let i = index" class="word-row-wrapper" [style.height.px]="getItemSize()">
                
                <!-- Compact View -->
                <div class="compact-row" *ngIf="isCompactMode">
                  <span class="compact-number">#{{ i + 1 }}</span>
                  <span class="compact-word">{{ row.word || '(Empty)' }}</span>
                </div>

                <!-- Full Card View -->
                <div class="word-card" *ngIf="!isCompactMode">
                  <div class="card-header">
                    <span class="card-number">#{{ i + 1 }}</span>
                    <button mat-icon-button color="warn" (click)="removeWord(i)" *ngIf="words.length > 1 || isEditMode" matTooltip="Delete Item">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                  <div class="card-content">
                    <!-- Word/Definition Type -->
                    <ng-container *ngIf="listType === ListType.WORD_DEFINITION">
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
                    </ng-container>

                    <!-- Image/Definition Type -->
                    <ng-container *ngIf="listType === ListType.IMAGE_DEFINITION">
                      <div class="image-upload-section">
                        <div class="image-preview" *ngIf="row.imagePreview || row.imageUrl">
                          <img [src]="row.imagePreview || row.imageUrl" alt="Item image">
                        </div>
                        <div class="image-placeholder" *ngIf="!row.imagePreview && !row.imageUrl" (click)="triggerImageUpload(i)">
                          <mat-icon>add_photo_alternate</mat-icon>
                          <span>Click to add image</span>
                        </div>
                        <input #itemImageInput type="file" (change)="onItemImageSelected($event, i)" style="display: none" accept="image/*">
                        <button mat-stroked-button (click)="triggerImageUpload(i)" class="change-image-btn" *ngIf="row.imagePreview || row.imageUrl">
                          Change Image
                        </button>
                      </div>

                      <mat-form-field appearance="outline" class="def-input">
                        <mat-label>Answer</mat-label>
                        <input matInput [(ngModel)]="row.definition" required placeholder="e.g. Texas">
                      </mat-form-field>
                    </ng-container>

                    <!-- Sight Words Type -->
                    <ng-container *ngIf="listType === ListType.SIGHT_WORDS">
                      <mat-form-field appearance="outline" class="word-input full-width-input">
                        <mat-label>Word</mat-label>
                        <input matInput [(ngModel)]="row.word" required placeholder="e.g. the">
                      </mat-form-field>
                    </ng-container>
                  </div>
                </div>
              </div>
            </cdk-virtual-scroll-viewport>
          </div>

          <!-- Bulk Paste for Sight Words -->
          <div class="bulk-paste-section" *ngIf="listType === ListType.SIGHT_WORDS">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Bulk Add Words (comma-separated)</mat-label>
              <textarea matInput 
                        [(ngModel)]="bulkWordsText" 
                        placeholder="the, and, is, a, to, in, it, you, that, he"
                        rows="3"></textarea>
              <mat-hint>Enter words separated by commas, then click "Add Words"</mat-hint>
            </mat-form-field>
            <button mat-stroked-button color="primary" (click)="onBulkAddWords()" [disabled]="!bulkWordsText.trim()">
              <mat-icon>playlist_add</mat-icon> Add Words
            </button>
          </div>

          <div class="actions">
            <button mat-stroked-button (click)="addWord()">
              <mat-icon>add</mat-icon> Add {{ listType === ListType.SIGHT_WORDS ? 'Word' : 'Item' }}
            </button>
            <button mat-stroked-button (click)="fileInput.click()" style="margin-left: 10px;" [disabled]="isImporting || isUploading || isProcessingImage" *ngIf="listType !== ListType.IMAGE_DEFINITION">
              <mat-icon>upload_file</mat-icon> {{ isImporting ? 'Importing...' : 'Import JSON' }}
            </button>
            <input #fileInput type="file" (change)="onFileSelected($event)" style="display: none" accept=".json">

            <ng-container *ngIf="listType === ListType.WORD_DEFINITION">
              <button mat-stroked-button (click)="imageInput.click()" style="margin-left: 10px;" [disabled]="isImporting || isUploading || isProcessingImage">
                <mat-icon>photo_library</mat-icon> {{ isProcessingImage ? 'Processing...' : 'Gallery' }}
              </button>
              <input #imageInput type="file" (change)="onImageSelected($event)" style="display: none" accept="image/*">

              <button mat-stroked-button (click)="cameraInput.click()" style="margin-left: 10px;" [disabled]="isImporting || isUploading || isProcessingImage">
                <mat-icon>camera_alt</mat-icon> {{ isProcessingImage ? 'Processing...' : 'Camera' }}
              </button>
              <input #cameraInput type="file" (change)="onImageSelected($event)" style="display: none" accept="image/*" capture="environment">
            </ng-container>
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

    <!-- Hidden file inputs for per-item image uploads -->
    <input #hiddenImageInput type="file" (change)="onItemImageSelected($event, currentImageUploadIndex)" style="display: none" accept="image/*">
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
    .list-type-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #e3f2fd;
      padding: 8px 16px;
      border-radius: 20px;
      margin-bottom: 16px;
      width: fit-content;
    }
    .list-type-badge mat-icon {
      color: #1976d2;
    }
    .words-list-container {
      height: 640px;
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
    .full-width-input {
      width: 100%;
    }
    .actions {
      margin-top: 20px;
      margin-bottom: 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
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
    .image-upload-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .image-preview {
      width: 100%;
      max-height: 120px;
      overflow: hidden;
      border-radius: 8px;
      border: 1px solid #ddd;
    }
    .image-preview img {
      width: 100%;
      height: 120px;
      object-fit: contain;
      background: #f5f5f5;
    }
    .image-placeholder {
      width: 100%;
      height: 100px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      border: 2px dashed #ccc;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .image-placeholder:hover {
      background: #eee;
    }
    .image-placeholder mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: #999;
    }
    .image-placeholder span {
      color: #999;
      font-size: 0.85rem;
      margin-top: 5px;
    }
    .change-image-btn {
      font-size: 0.85rem;
    }
    .bulk-paste-section {
      margin-bottom: 20px;
      padding: 15px;
      background: #e3f2fd;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bulk-paste-section button {
      align-self: flex-start;
    }
  `]
})
export class ListEditorComponent implements OnInit {
  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;
  @ViewChild('hiddenImageInput') hiddenImageInput!: any;

  listId: string | null = null;
  isEditMode = false;
  isCompactMode = false;
  listType: ListType = ListType.WORD_DEFINITION;
  ListType = ListType; // Expose enum to template

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
  currentImageUploadIndex = 0;
  bulkWordsText = '';

  constructor(
    private listService: ListService,
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService,
    private supabaseService: SupabaseService
  ) { }

  ngOnInit(): void {
    // Check for list type from query params (new list)
    this.route.queryParamMap.subscribe(queryParams => {
      const type = queryParams.get('type');
      if (type && Object.values(ListType).includes(type as ListType)) {
        this.listType = type as ListType;
      }
    });

    // Check for existing list ID (edit mode)
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
      this.listType = details.metadata.list_type || ListType.WORD_DEFINITION;
    });

    this.listService.getWords(id).subscribe((words: any[]) => {
      this.words = words.map((w: any) => ({
        id: w.id,
        word: w.word,
        definition: w.definition || '',
        imageUrl: w.image_url || ''
      }));
      if (this.words.length === 0) {
        this.words.push({ word: '', definition: '' });
      }
    });
  }

  getTypeIcon(): string {
    switch (this.listType) {
      case ListType.WORD_DEFINITION: return 'text_fields';
      case ListType.IMAGE_DEFINITION: return 'image';
      case ListType.SIGHT_WORDS: return 'record_voice_over';
      default: return 'text_fields';
    }
  }

  getTypeName(): string {
    switch (this.listType) {
      case ListType.WORD_DEFINITION: return 'Word / Definition';
      case ListType.IMAGE_DEFINITION: return 'Image / Definition';
      case ListType.SIGHT_WORDS: return 'Sight Words';
      default: return 'Word / Definition';
    }
  }

  getNamePlaceholder(): string {
    switch (this.listType) {
      case ListType.WORD_DEFINITION: return 'e.g. Spanish Verbs';
      case ListType.IMAGE_DEFINITION: return 'e.g. US State Shapes';
      case ListType.SIGHT_WORDS: return 'e.g. Kindergarten Sight Words';
      default: return 'e.g. Spanish Verbs';
    }
  }

  getItemSize(): number {
    if (this.isCompactMode) return 50;
    switch (this.listType) {
      case ListType.IMAGE_DEFINITION: return 320;
      case ListType.SIGHT_WORDS: return 150;
      default: return 280;
    }
  }

  addWord() {
    this.words = [...this.words, { word: '', definition: '' }];
    setTimeout(() => {
      if (this.viewport) {
        this.viewport.scrollToIndex(this.words.length - 1, 'smooth');
      }
    }, 100);
  }

  onBulkAddWords() {
    if (!this.bulkWordsText.trim()) return;

    // Parse comma-separated words
    const newWords = this.bulkWordsText
      .split(',')
      .map(w => w.trim())
      .filter(w => w.length > 0)
      .map(w => ({ word: w, definition: '' }));

    if (newWords.length === 0) return;

    // If the only existing word is empty, replace it
    if (this.words.length === 1 && !this.words[0].word.trim()) {
      this.words = newWords;
    } else {
      this.words = [...this.words, ...newWords];
    }

    // Clear the bulk input
    this.bulkWordsText = '';

    // Scroll to show the new words
    setTimeout(() => {
      if (this.viewport) {
        this.viewport.scrollToIndex(this.words.length - 1, 'smooth');
      }
    }, 100);
  }

  removeWord(index: number) {
    if (index < 0 || index >= this.words.length) return;
    const word = this.words[index];
    if (word && word.id) {
      this.deletedWordIds.push(word.id);
    }
    this.words.splice(index, 1);
    this.words = [...this.words];
  }

  isValid(): boolean {
    if (this.name.trim().length === 0) return false;

    switch (this.listType) {
      case ListType.WORD_DEFINITION:
        return this.words.every(w => w.word.trim().length > 0 && w.definition.trim().length > 0);
      case ListType.IMAGE_DEFINITION:
        return this.words.every(w => (w.imageUrl || w.imageFile) && w.definition.trim().length > 0);
      case ListType.SIGHT_WORDS:
        return this.words.every(w => w.word.trim().length > 0);
      default:
        return false;
    }
  }

  onCancel() {
    this.router.navigate(['/dashboard']);
  }

  async onSave() {
    if (!this.isValid()) return;
    this.saving = true;

    try {
      // Upload any pending images first
      if (this.listType === ListType.IMAGE_DEFINITION) {
        await this.uploadPendingImages();
      }

      if (this.isEditMode && this.listId) {
        await this.listService.updateList(this.listId, this.name, this.description, this.isPublic).toPromise();
        await this.listService.syncWords(this.listId, this.words.map(w => ({
          id: w.id,
          word: w.word,
          definition: w.definition,
          imageUrl: w.imageUrl
        })), this.deletedWordIds).toPromise();
        this.router.navigate(['/dashboard']);
      } else {
        const listId = await this.listService.createList(this.name, this.description, this.isPublic, this.listType).toPromise();
        if (listId) {
          if (this.words.length > 50 && typeof Worker !== 'undefined') {
            this.uploadWordsWithWorker(listId, this.words);
          } else {
            await this.listService.addWords(listId, this.words.map(w => ({
              word: w.word,
              definition: w.definition,
              imageUrl: w.imageUrl
            }))).toPromise();
            this.router.navigate(['/dashboard']);
          }
        }
      }
    } catch (err) {
      this.handleError(err);
    }
  }

  private async uploadPendingImages() {
    const wordsWithPendingImages = this.words.filter(w => w.imageFile);

    for (const word of wordsWithPendingImages) {
      if (word.imageFile) {
        const imageUrl = await this.uploadImage(word.imageFile);
        word.imageUrl = imageUrl;
        word.imageFile = undefined;
        word.imagePreview = undefined;
      }
    }
  }

  private async uploadImage(file: File): Promise<string> {
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `vocab-images/${fileName}`;

    const { data, error } = await this.supabaseService.client.storage
      .from('vocab')
      .upload(filePath, file);

    if (error) throw error;

    const { data: urlData } = this.supabaseService.client.storage
      .from('vocab')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  triggerImageUpload(index: number) {
    this.currentImageUploadIndex = index;
    const fileInputs = document.querySelectorAll('input[type="file"][accept="image/*"]');
    const input = fileInputs[fileInputs.length - 1] as HTMLInputElement;
    if (input) input.click();
  }

  onItemImageSelected(event: any, index: number) {
    const file = event.target.files[0];
    if (!file) return;

    // Create preview
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.words[index].imagePreview = e.target.result;
      this.words[index].imageFile = file;
      this.words = [...this.words];
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  private async uploadWordsWithWorker(listId: string, words: WordRow[]) {
    this.isUploading = true;
    this.uploadProgress = 0;

    try {
      const { data: { session } } = await this.supabaseService.client.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        this.handleError('No active session found for upload.');
        this.isUploading = false;
        this.saving = false;
        return;
      }

      const worker = new Worker(new URL('../../workers/list-upload.worker', import.meta.url));

      worker.onmessage = ({ data }) => {
        if (data.type === 'progress') {
          this.uploadProgress = data.value;
        } else if (data.type === 'result') {
          worker.terminate();
          this.isUploading = false;
          this.router.navigate(['/dashboard']);
        } else if (data.type === 'error') {
          worker.terminate();
          this.isUploading = false;
          this.handleError(data.message);
        }
      };

      worker.onerror = (err) => {
        this.isUploading = false;
        this.handleError('Worker initialization failed');
      };

      worker.postMessage({
        supabaseUrl: environment.supabase.url,
        supabaseKey: environment.supabase.key,
        authToken: token,
        listId: listId,
        words: words.map(w => ({ word: w.word, definition: w.definition, imageUrl: w.imageUrl }))
      });
    } catch (err) {
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
      event.target.value = '';
    }
  }

  private handleImportResult(newWords: WordRow[]) {
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
    return /(\p{Extended_Pictographic}|\p{Regional_Indicator})/u.test(text);
  }
}
