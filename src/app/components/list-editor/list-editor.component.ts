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
import { MatSelectModule } from '@angular/material/select';

import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MathGenModalComponent } from '../modals/math-gen-modal/math-gen-modal.component';
import { GenerateSentencesModalComponent } from '../modals/generate-sentences-modal/generate-sentences-modal.component';

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
    MatCheckboxModule,
    MatSelectModule,
    MatMenuModule,

    MatDialogModule,
    TopNavComponent,
    TwemojiPipe
  ],
  templateUrl: './list-editor.component.html',
  styleUrls: ['./list-editor.component.scss']
})

export class ListEditorComponent implements OnInit {
  @ViewChild('hiddenImageInput') hiddenImageInput!: any;

  listId: string | null = null;
  isEditMode = false;
  isCompactMode = false;
  listType: ListType = ListType.WORD_DEFINITION;
  ListType = ListType; // Expose enum to template

  name = '';
  description = '';
  isPublic = false;
  language = 'en';
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

  // UI State
  focusedIndex: number | null = null;

  constructor(
    private listService: ListService,
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService,
    private supabaseService: SupabaseService,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    // Check for list type from query params (new list)
    this.route.queryParamMap.subscribe(queryParams => {
      const type = queryParams.get('type');
      if (type && Object.values(ListType).includes(type as ListType)) {
        this.listType = type as ListType;
        if (this.listType === ListType.MATH) {
          // Short delay to ensure view is ready or just to separate execution
          setTimeout(() => this.openMathGenModal(), 0);
        }
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
      this.language = details.metadata.language || 'en';
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
      case ListType.MATH: return 'calculate';
      case ListType.SENTENCES: return 'auto_stories';
      default: return 'text_fields';
    }
  }

  getTypeName(): string {
    switch (this.listType) {
      case ListType.WORD_DEFINITION: return 'Word / Definition';
      case ListType.IMAGE_DEFINITION: return 'Image / Definition';
      case ListType.SIGHT_WORDS: return 'Sight Words';
      case ListType.MATH: return 'Math Problems';
      case ListType.SENTENCES: return 'Sentences';
      default: return 'Word / Definition';
    }
  }

  getNamePlaceholder(): string {
    switch (this.listType) {
      case ListType.WORD_DEFINITION: return 'e.g. Spanish Verbs';
      case ListType.IMAGE_DEFINITION: return 'e.g. US State Shapes';
      case ListType.SIGHT_WORDS: return 'e.g. Kindergarten Sight Words';
      case ListType.MATH: return 'e.g. Simple Addition';
      case ListType.SENTENCES: return 'e.g. Simple Sentences';
      default: return 'e.g. Spanish Verbs';
    }
  }

  addWord() {
    this.words = [...this.words, { word: '', definition: '' }];
    // No more viewport scroll needed, auto-scroll logic can be handled differently if needed or let browser handle it
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
    // Scroll logic removed pending viewchild fix if needed, or rely on native scroll
    setTimeout(() => {
      const listContainer = document.querySelector('.words-list-container');
      if (listContainer) {
        listContainer.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
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
      case ListType.MATH:
        return this.words.every(w => w.word.trim().length > 0 && w.definition.trim().length > 0);
      case ListType.SENTENCES:
        return this.words.every(w => w.word.trim().length > 0);
      default:
        return false;
    }
  }

  onCancel() {
    this.router.navigate(['/lists']);
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
        // Enforce 50 word limit
        if (this.words.length > 50) {
          alert('Lists are currently limited to 50 items maximum for performance.');
          this.saving = false;
          return;
        }

        await this.listService.updateList(this.listId, this.name, this.description, this.isPublic, this.language).toPromise();
        await this.listService.syncWords(this.listId, this.words.map(w => ({
          id: w.id,
          word: w.word,
          definition: w.definition,
          imageUrl: w.imageUrl
        })), this.deletedWordIds).toPromise();

        // Queue all words for audio if Sight Words or Sentences
        if (this.listType === ListType.SIGHT_WORDS || this.listType === ListType.SENTENCES) {
          let wordsToQueue = this.words.map(w => w.word);

          // For Sentences, also queue individual words
          if (this.listType === ListType.SENTENCES) {
            const individualWords: string[] = [];
            wordsToQueue.forEach(sentence => {
              // Split by spaces and strip punctuation
              const parts = sentence.split(/\s+/);
              parts.forEach(p => {
                const clean = p.replace(/[.,!?;:()"]/g, '').trim();
                if (clean.length > 0) individualWords.push(clean);
              });
            });
            wordsToQueue = [...wordsToQueue, ...individualWords];
          }

          await this.queueWordsForAudio(wordsToQueue);
        }

        this.router.navigate(['/lists']);
      } else {
        // Enforce 50 word limit
        if (this.words.length > 50) {
          alert('Lists are currently limited to 50 items maximum for performance.');
          this.saving = false;
          return;
        }

        const listId = await this.listService.createList(this.name, this.description, this.isPublic, this.listType, this.language).toPromise();
        if (listId) {
          // Always use standard addWords + Queue, no worker needed for < 50 items
          await this.listService.addWords(listId, this.words.map(w => ({
            word: w.word,
            definition: w.definition,
            imageUrl: w.imageUrl
          }))).toPromise();

          // Queue all words for audio if Sight Words or Sentences
          if (this.listType === ListType.SIGHT_WORDS || this.listType === ListType.SENTENCES) {
            let wordsToQueue = this.words.map(w => w.word);

            // For Sentences, also queue individual words
            if (this.listType === ListType.SENTENCES) {
              const individualWords: string[] = [];
              wordsToQueue.forEach(sentence => {
                // Split by spaces and strip punctuation
                const parts = sentence.split(/\s+/);
                parts.forEach(p => {
                  const clean = p.replace(/[.,!?;:()"]/g, '').trim();
                  if (clean.length > 0) individualWords.push(clean);
                });
              });
              wordsToQueue = [...wordsToQueue, ...individualWords];
            }

            await this.queueWordsForAudio(wordsToQueue);
          }

          this.router.navigate(['/dashboard']); // Go to dashboard (My Lists) so they can see progress
        }
      }
    } catch (err) {
      this.handleError(err);
    }
  }

  // Helper to add words to the global generation queue
  private async queueWordsForAudio(words: string[]) {
    // Only queue if language implies speech (e.g. not math? Actually math uses speech too but "logic" is different)
    // For now, queue everything. The Edge function can decide or we filter effectively.
    // Actually, queue everything.

    // Filter out empties
    const validWords = [...new Set(words.filter(w => w && w.trim().length > 0))];

    if (validWords.length === 0) return;

    console.log('[ListEditor] Queueing words for audio generation:', validWords.length);

    // Insert into table (ignore duplicates on conflict)
    // We construct the rows
    const rows = validWords.map(w => ({
      word: w,
      language: this.language,
      status: 'pending'
    }));

    const { error } = await this.supabaseService.client
      .from('audio_generation_queue')
      .upsert(rows, { onConflict: 'word, language', ignoreDuplicates: true });

    if (error) {
      console.error('[ListEditor] Failed to queue words:', error);
      // Don't block save, just log
    } else {
      console.log('[ListEditor] Words queued. Triggering processor...');
      // Fire and forget the Edge Function trigger
      this.supabaseService.client.functions.invoke('process-audio-queue')
        .then(({ data, error }) => {
          if (error) console.error('[ListEditor] Trigger error:', error);
          else console.log('[ListEditor] Processor triggered:', data);
        });
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



  openMathGenModal() {
    const dialogRef = this.dialog.open(MathGenModalComponent, {
      width: '500px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.words = result;
        if (this.words.length === 0) this.words.push({ word: '', definition: '' });
      }
    });
  }

  openGenerateSentencesModal() {
    const dialogRef = this.dialog.open(GenerateSentencesModalComponent, {
      width: '500px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && Array.isArray(result)) {
        // Result is array of { word, definition }
        this.words = result;
        if (this.words.length === 0) this.words.push({ word: '', definition: '' });
      }
    });
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
          this.router.navigate(['/lists']);
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
      // Compress image to prevent edge function memory limits
      const compressedFile = await this.compressImage(file, 1280, 0.8);
      console.log(`Compressed image: ${file.size} -> ${compressedFile.size} bytes`);

      const formData = new FormData();
      formData.append('file', compressedFile);

      // Pass mode based on list type
      const mode = this.listType === ListType.SIGHT_WORDS ? 'sightwords' : 'vocab';
      formData.append('mode', mode);

      const { data, error } = await this.supabaseService.client.functions.invoke('image-to-vocab', {
        body: formData,
      });

      if (error) throw error;

      if (this.listType === ListType.SIGHT_WORDS) {
        // Sight words: populate bulk words textarea
        if (data?.words) {
          this.bulkWordsText = data.words;
          // Auto-trigger bulk add
          this.onBulkAddWords();
        } else {
          alert('No words found in the image.');
        }
      } else {
        // Vocab mode: existing behavior
        if (Array.isArray(data)) {
          const newWords = data.map((item: any) => ({
            word: item.word || '',
            definition: item.definition || ''
          }));
          this.handleImportResult(newWords);
        } else {
          alert('No words found in the image or invalid response format.');
        }
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

  private compressImage(file: File, maxSize: number, quality: number): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // Scale down if larger than maxSize
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  isFocused(index: number): boolean {
    return this.focusedIndex === index;
  }

  setFocused(index: number) {
    this.focusedIndex = index;
  }

  onImagePaste(event: ClipboardEvent, index: number) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          this.handleImageBlob(blob, index);
        }
        event.preventDefault(); // Prevent double paste behavior
      }
    }
  }

  async handleImageBlob(file: File, index: number) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      // Temporarily update preview
      if (this.words[index]) {
        this.words[index].imagePreview = e.target.result;
        this.words[index].imageFile = file;
        this.words = [...this.words];
      }
    };
    reader.readAsDataURL(file);
  }

  triggerImageUpload(index: number) {
    // Find the hidden input for this specific index if possible, or use a shared one
    // The template uses a per-row input: <input #itemImageInput ...>
    // But queryList might be needed if we want to trigger it programmatically from outside
    // Actually, in the HTML I wrote: (click)="triggerImageUpload(i)" and matching <input #itemImageInput>
    // But triggering a specific element in a list from TS is hard without QueryList.
    // SIMPLER: Use a single hidden input for "current upload" and just set the index

    this.currentImageUploadIndex = index;
    if (this.hiddenImageInput) {
      this.hiddenImageInput.nativeElement.click();
    }
  }

  onItemImageSelected(event: any, index: number) {
    const file = event.target.files[0];
    if (file) {
      this.handleImageBlob(file, index);
    }
    event.target.value = '';
  }
}
