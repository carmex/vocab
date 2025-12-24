import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { SpeechService } from '../../services/speech.service';
import { SettingsService } from '../../services/settings.service';
import { TopNavComponent } from '../top-nav/top-nav.component';

interface SightWord {
  id: string;
  word: string;
}

type QuizMode = 'read' | 'listen';

@Component({
  selector: 'app-sight-words-quiz',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatProgressBarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatButtonToggleModule,
    TopNavComponent
  ],
  template: `
    <div class="quiz-container">
      <app-top-nav (back)="onExit()"></app-top-nav>

      <!-- Mode Selection (shown before quiz starts) -->
      <div class="mode-selection" *ngIf="!quizStarted && !quizComplete">
        <h2>Choose Quiz Mode</h2>
        
        <div class="mode-cards">
          <mat-card class="mode-card" (click)="startWithMode('read')" [class.selected]="selectedMode === 'read'">
            <mat-icon class="mode-icon">record_voice_over</mat-icon>
            <h3>Read Mode</h3>
            <p>See the word, then say it out loud</p>
          </mat-card>

          <mat-card class="mode-card" (click)="startWithMode('listen')" [class.selected]="selectedMode === 'listen'">
            <mat-icon class="mode-icon">hearing</mat-icon>
            <h3>Listen Mode</h3>
            <p>Hear the word, then pick the correct one</p>
          </mat-card>
        </div>
      </div>

      <!-- Quiz Content -->
      <ng-container *ngIf="quizStarted && !quizComplete">
        <div class="progress-section">
          <mat-progress-bar mode="determinate" [value]="progressPercent" class="quiz-progress"></mat-progress-bar>
          <div class="progress-label">{{ progressLabel }}</div>

          <mat-progress-bar mode="determinate" [value]="missedPercent" class="missed-progress" color="warn"></mat-progress-bar>
          <div class="missed-label">{{ missedLabel }}</div>
        </div>

        <!-- READ MODE: Show word, record speech -->
        <ng-container *ngIf="quizMode === 'read'">


          <!-- Download Progress -->
          <div class="download-progress" *ngIf="downloadProgress !== null">
            <div class="status-text">{{ downloadStatus }} ({{ downloadProgress }}%)</div>
            <mat-progress-bar mode="determinate" [value]="downloadProgress"></mat-progress-bar>
          </div>
          
          <div class="word-display" *ngIf="currentWord">
            <span class="sight-word">{{ currentWord.word }}</span>
          </div>

          <!-- Show Record/Don't Know only if STT is supported -->
            <div class="action-buttons" *ngIf="speechSupported && currentWord && !showingFeedback">
            <button mat-fab extended color="primary" 
                    (click)="isListening ? onStopListening() : onRecord()" 
                    class="action-btn"
                    [disabled]="isProcessing">
              <mat-icon *ngIf="isProcessing">hourglass_empty</mat-icon>
              <mat-icon *ngIf="!isProcessing">{{ isListening ? 'stop' : 'mic' }}</mat-icon>
              {{ isProcessing ? 'Processing...' : (isListening ? 'Stop' : 'Record') }}
            </button>

            <button mat-fab extended color="accent" (click)="onDontKnow()" [disabled]="isListening" class="action-btn">
              <mat-icon>help_outline</mat-icon>
              Don't Know
            </button>
          </div>

          <!-- Manual fallback for browsers without STT -->
          <div class="manual-buttons" *ngIf="!speechSupported && currentWord && !showingFeedback">
            <p class="manual-hint">Say the word out loud, then mark your answer:</p>
            <button mat-raised-button color="primary" (click)="onManualCorrect()">
              <mat-icon>check</mat-icon> I said it correctly
            </button>
            <button mat-raised-button color="warn" (click)="onManualIncorrect()">
              <mat-icon>close</mat-icon> I need more practice
            </button>
          </div>
        </ng-container>

        <ng-container *ngIf="quizMode === 'listen'">
          <!-- Loading overlay when TTS is initializing -->
          <div class="tts-loading" *ngIf="isSpeaking">
            <mat-icon class="loading-icon spinning">volume_up</mat-icon>
            <span>Preparing voice...</span>
          </div>

          <div class="listen-display" *ngIf="currentWord && !showingFeedback && !isSpeaking">
            <button mat-fab extended color="primary" (click)="speakCurrentWord()" class="speak-btn">
              <mat-icon>volume_up</mat-icon>
              Play Word
            </button>
            <p class="listen-hint">Listen to the word, then pick the correct one below</p>
          </div>

          <div class="answer-options" *ngIf="currentWord && !showingFeedback">
            <button *ngFor="let option of listenOptions" 
                    mat-raised-button 
                    class="answer-button"
                    (click)="onSelectWord(option)">
              {{ option.word }}
            </button>
          </div>
        </ng-container>

        <!-- Feedback (both modes) -->
        <div class="feedback-section" *ngIf="showingFeedback">
          <mat-card [class.correct]="lastAnswerCorrect" [class.incorrect]="!lastAnswerCorrect" class="feedback-card">
            <mat-card-content>
              <mat-icon class="feedback-icon">{{ lastAnswerCorrect ? 'check_circle' : 'cancel' }}</mat-icon>
              <div class="feedback-text">
                {{ lastAnswerCorrect ? 'Great job!' : 'Keep practicing!' }}
              </div>
              <div class="correct-word" *ngIf="!lastAnswerCorrect && currentWord">
                The word was: <strong>{{ currentWord.word }}</strong>
              </div>
              <div class="recognized-text" *ngIf="recognizedText">
                You said: "{{ recognizedText }}"
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Auto-advance timer bar -->
          <div class="timer-container" *ngIf="timerProgress > 0">
            <mat-progress-bar mode="determinate" [value]="timerProgress" color="accent"></mat-progress-bar>
          </div>

          <div class="feedback-actions">
            <button mat-fab extended color="warn" (click)="onPause()" *ngIf="timerProgress > 0 && !isPaused" class="action-btn">
              <mat-icon>pause</mat-icon>
              Pause
            </button>
            <button mat-fab extended color="primary" (click)="nextWord()" class="next-btn">
              <mat-icon>arrow_forward</mat-icon>
              Next Word
            </button>
          </div>
        </div>
      </ng-container>

      <!-- Quiz Complete -->
      <div class="quiz-complete" *ngIf="quizComplete">
        <mat-card class="complete-card">
          <mat-card-content>
            <mat-icon class="complete-icon">celebration</mat-icon>
            <h2>All Done!</h2>
            <p>You got {{ correctCount }} out of {{ totalWords }} words correct!</p>
            <div class="complete-actions">
              <button mat-raised-button color="primary" (click)="onExit()">
                Back to Dashboard
              </button>
              <button mat-stroked-button color="primary" (click)="restart()">
                Practice Again
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .quiz-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .mode-selection {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .mode-selection h2 {
      margin-bottom: 30px;
      color: #333;
    }
    .mode-cards {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .mode-card {
      width: 200px;
      padding: 30px 20px;
      text-align: center;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .mode-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }
    .mode-card.selected {
      border: 3px solid #1976d2;
      background: #e3f2fd;
    }
    .mode-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #1976d2;
      margin-bottom: 15px;
    }
    .mode-card h3 {
      margin: 0 0 10px;
      font-size: 1.2rem;
    }
    .mode-card p {
      margin: 0;
      font-size: 0.85rem;
      color: #666;
    }
    .progress-section {
      margin-bottom: 20px;
    }
    .quiz-progress, .missed-progress {
      margin-bottom: 5px;
    }
    .progress-label, .missed-label {
      font-size: 0.85rem;
      color: #666;
      text-align: right;
    }
    .word-display {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 30px;
      min-height: 150px;
    }
    .sight-word {
      font-size: 5rem;
      font-weight: 600;
      color: #1976d2;
      text-align: center;
      font-family: 'Nunito', 'Varela Round', 'Arial Rounded MT Bold', 'Helvetica Rounded', sans-serif;
    }
    .listen-display {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 180px;
      gap: 20px;
    }
    .tts-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 180px;
      gap: 15px;
      color: #1976d2;
      font-size: 1.2rem;
    }
    .tts-loading .loading-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
    }
    .tts-loading .spinning {
      animation: spin 1.5s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .speak-btn {
      font-size: 1.1rem;
    }
    .listen-hint {
      color: #666;
      font-size: 0.95rem;
    }
    .answer-options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 30px;
    }
    .answer-button {
      min-height: 80px;
      font-size: 1.8rem;
      font-weight: 600;
      font-family: 'Nunito', 'Varela Round', 'Arial Rounded MT Bold', 'Helvetica Rounded', sans-serif;
      border-radius: 12px;
    }
    .action-buttons {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-bottom: 40px;
      flex-wrap: wrap;
    }
    .action-btn {
      min-width: 150px;
    }
    .feedback-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      margin-bottom: 40px;
    }
    .feedback-card {
      width: 100%;
      max-width: 400px;
      text-align: center;
      padding: 20px;
    }
    .feedback-card.correct {
      background: #e8f5e9;
      border: 2px solid #4caf50;
    }
    .feedback-card.incorrect {
      background: #ffebee;
      border: 2px solid #f44336;
    }
    .feedback-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 10px;
    }
    .feedback-card.correct .feedback-icon {
      color: #4caf50;
    }
    .feedback-card.incorrect .feedback-icon {
      color: #f44336;
    }
    .feedback-text {
      font-size: 1.5rem;
      font-weight: 500;
      margin-bottom: 10px;
    }
    .correct-word {
      font-size: 1.2rem;
      margin-bottom: 10px;
    }
    .correct-word strong {
      color: #1976d2;
      font-size: 1.4rem;
    }
    .recognized-text {
      font-size: 0.9rem;
      color: #666;
      font-style: italic;
    }
    .next-btn {
      min-width: 160px;
    }
    .timer-container {
      width: 100%;
      max-width: 400px;
      margin-top: 15px;
    }
    .feedback-actions {
      display: flex;
      gap: 15px;
      margin-top: 20px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .quiz-complete {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .complete-card {
      text-align: center;
      padding: 30px;
    }
    .complete-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #ff9800;
      margin-bottom: 10px;
    }
    .complete-card h2 {
      margin: 10px 0;
    }
    .complete-actions {
      display: flex;
      justify-content: center;
      gap: 15px;
      margin-top: 20px;
      flex-wrap: wrap;
    }
    .manual-buttons {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 15px;
      margin-top: 20px;
    }
    .manual-hint {
      color: #666;
      font-size: 0.95rem;
      margin: 0 0 10px 0;
    }
    .browser-warning {
      background: #fff3e0;
      border: 1px solid #ff9800;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
    }
    .warning-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      width: 100%;
    }
    .browser-warning mat-icon {
      color: #ff9800;
      flex-shrink: 0;
    }
    .browser-warning span {
      color: #333;
      font-size: 0.95rem;
    }
    .enable-btn {
      font-size: 0.85rem;
      white-space: nowrap;
    }
    .download-progress {
      margin-bottom: 20px;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 8px;
    }
    .status-text {
      margin-bottom: 5px;
      font-size: 0.9rem;
      color: #666;
      text-align: center;
    }
  `]
})
export class SightWordsQuizComponent implements OnInit, OnDestroy {
  listId: string = '';
  words: SightWord[] = [];
  wordQueue: SightWord[] = [];
  currentWord: SightWord | null = null;

  // Mode
  quizMode: QuizMode = 'read';
  selectedMode: QuizMode = 'read';
  passMode: 'main' | 'review' = 'main';
  language: string = 'en';
  quizStarted = false;

  // Listen mode options
  listenOptions: SightWord[] = [];

  // Progress
  totalWords = 0;
  answeredCount = 0;
  correctCount = 0;
  progressPercent = 0;
  missedPercent = 0;
  progressLabel = '';
  missedLabel = '';

  // State
  isListening = false;
  isProcessing = false;
  isSpeaking = false;
  showingFeedback = false;
  lastAnswerCorrect = false;
  recognizedText = '';
  quizComplete = false;
  speechSupported = true;
  downloadProgress: number | null = null;
  downloadStatus = '';

  // Timer State (auto-advance)
  timerProgress = 0;
  isPaused = false;
  private timerInterval: any = null;
  private remainingTime = 0;
  private totalTime = 0;


  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabase: SupabaseService,
    private speechService: SpeechService,
    private settingsService: SettingsService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    this.listId = this.route.snapshot.paramMap.get('listId') || '';
    this.passMode = (this.route.snapshot.queryParamMap.get('mode') as 'main' | 'review') || 'main';

    if (!this.listId) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Check general support (true if native OR enhanced)
    this.speechSupported = this.speechService.isSTTSupported();

    // Subscribe to download progress
    this.speechService.getModelLoadingProgress().subscribe(progress => {
      this.downloadStatus = progress.status;
      if (progress.progress !== undefined) {
        this.downloadProgress = progress.progress;
      }
      if (progress.status === 'done') {
        this.downloadProgress = null;
        this.speechSupported = true;
      }
      this.cdr.detectChanges();
    });

    // Auto-init Whisper if Native not available
    if (!this.speechService.isNativeSupported() && this.speechSupported) {
      console.log('[SightWordsQuiz] Native STT not available, initializing Whisper...');
      this.downloadStatus = 'Initializing Speech Engine...';
      this.downloadProgress = 0;
      this.speechService.preloadModel();
    }

    await this.loadWords();
  }



  ngOnDestroy() {
    this.speechService.stopListening();
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  async loadWords() {
    // Fetch list metadata including language
    const { data: listData } = await this.supabase.client
      .from('word_lists')
      .select('language')
      .eq('id', this.listId)
      .single();

    this.language = listData?.language || 'en';

    // First, load all words for the list
    const { data: allWords, error } = await this.supabase.client
      .from('list_words')
      .select('id, word')
      .eq('list_id', this.listId);

    if (error) {
      console.error('Error loading words:', error);
      return;
    }

    let wordsToQuiz = allWords || [];

    // If review mode, filter to only missed words
    if (this.passMode === 'review') {
      const { data: missed } = await this.supabase.client
        .from('user_missed_words')
        .select('word_id')
        .eq('list_id', this.listId);

      const missedIds = missed?.map((m: any) => m.word_id) || [];
      console.log(`[SightWordsQuiz] Review mode: found ${missedIds.length} missed words`);
      wordsToQuiz = wordsToQuiz.filter(w => missedIds.includes(w.id));
    }

    this.words = wordsToQuiz;
    this.totalWords = this.words.length;

    // If no words to review, redirect back
    if (this.totalWords === 0) {
      console.log('[SightWordsQuiz] No words to quiz, redirecting to dashboard');
      this.router.navigate(['/dashboard']);
    }
  }

  startWithMode(mode: QuizMode) {
    this.quizMode = mode;
    this.selectedMode = mode;
    this.startQuiz();
  }

  startQuiz() {
    this.wordQueue = this.shuffleArray([...this.words]);
    this.answeredCount = 0;
    this.correctCount = 0;
    this.quizComplete = false;
    this.quizStarted = true;
    this.showingFeedback = false;
    this.updateProgress();
    this.displayNextWord();
  }

  displayNextWord() {
    if (this.wordQueue.length === 0) {
      this.quizComplete = true;
      this.currentWord = null;
      this.finishQuiz();
      return;
    }

    this.currentWord = this.wordQueue.shift()!;
    this.showingFeedback = false;
    this.recognizedText = '';

    // For listen mode, generate options
    if (this.quizMode === 'listen') {
      this.generateListenOptions();
      // Auto-speak the word after a short delay
      setTimeout(() => this.speakCurrentWord(), 500);
    }
  }

  generateListenOptions() {
    if (!this.currentWord) return;

    // Get 3 random distractors
    const distractors = this.words
      .filter(w => w.id !== this.currentWord!.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    // Combine with correct answer and shuffle
    this.listenOptions = this.shuffleArray([this.currentWord, ...distractors]);
  }

  async speakCurrentWord() {
    if (!this.currentWord || this.isSpeaking) return;
    this.isSpeaking = true;
    this.cdr.detectChanges();
    try {
      await this.speechService.speak(this.currentWord.word, this.language);
    } catch (err) {
      console.error('TTS error:', err);
    } finally {
      this.isSpeaking = false;
      this.cdr.detectChanges();
    }
  }

  // Listen mode: user picks a word
  onSelectWord(selected: SightWord) {
    if (this.showingFeedback || !this.currentWord) return;

    if (selected.id === this.currentWord.id) {
      this.handleCorrect();
    } else {
      this.handleIncorrect('');
    }
  }

  // Read mode: user records speech
  onRecord() {
    if (this.isListening || !this.currentWord) return;

    this.isListening = true;

    // Pass the target word and language for recognition
    this.speechService.listen(this.currentWord.word, this.language).subscribe({
      next: (result) => {
        // Run inside Angular zone to trigger change detection
        this.ngZone.run(() => {
          if ('error' in result) {
            console.error('Speech recognition error:', result.error);
            this.isListening = false;
            this.isProcessing = false;
            this.handleIncorrect('');
            return;
          }

          if ('status' in result && result.status === 'processing') {
            this.isProcessing = true;
            this.isListening = false;
            return;
          }

          if ('result' in result) {
            this.isListening = false;
            this.isProcessing = false;
            this.recognizedText = result.result;

            if (this.speechService.wordsMatch(result.result, this.currentWord!.word)) {
              this.handleCorrect();
            } else {
              this.handleIncorrect(result.result);
            }
          }
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.isListening = false;
          console.error('Speech recognition error:', err);
          this.handleIncorrect('');
        });
      }
    });
  }

  onStopListening() {
    this.speechService.stopListening();
    this.isListening = false;
  }

  async onDontKnow() {
    if (!this.currentWord) return;

    try {
      await this.speechService.speak(this.currentWord.word, this.language);
    } catch (err) {
      console.error('TTS error:', err);
    }

    this.handleIncorrect('');
  }

  handleCorrect() {
    this.lastAnswerCorrect = true;
    this.correctCount++;
    this.answeredCount++;
    this.showingFeedback = true;
    this.updateProgress();
    this.saveProgress(this.currentWord!.id, true);
    this.startAutoAdvanceTimer();
  }

  async handleIncorrect(recognized: string) {
    this.lastAnswerCorrect = false;
    this.answeredCount++;
    this.showingFeedback = true;
    this.updateProgress();
    this.saveProgress(this.currentWord!.id, false);

    // Speak the correct word
    if (this.currentWord) {
      try {
        await this.speechService.speak(this.currentWord.word, this.language);
      } catch (err) {
        console.error('TTS error:', err);
      }
    }

    this.startAutoAdvanceTimer();
  }

  onManualCorrect() {
    this.handleCorrect();
  }

  onManualIncorrect() {
    this.handleIncorrect('');
  }

  nextWord() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerProgress = 0;
    this.isPaused = false;
    this.displayNextWord();
  }

  private startAutoAdvanceTimer() {
    const settings = this.settingsService.getSettings();
    if (!settings.autoAdvance) return;

    this.totalTime = this.lastAnswerCorrect
      ? settings.correctAnswerTimer * 1000
      : settings.incorrectAnswerTimer * 1000;
    this.remainingTime = this.totalTime;
    this.isPaused = false;

    const step = 100;
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      this.remainingTime -= step;
      this.timerProgress = (this.remainingTime / this.totalTime) * 100;

      if (this.remainingTime <= 0) {
        this.nextWord();
      }
    }, step);
  }

  onPause() {
    this.isPaused = true;
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  async saveProgress(wordId: string, isCorrect: boolean) {
    try {
      await this.supabase.client.rpc('update_quiz_progress', {
        p_list_id: this.listId,
        p_pass_type: this.passMode,
        p_word_id: wordId,
        p_is_correct: isCorrect
      });
    } catch (err) {
      console.error('Error saving progress:', err);
    }
  }

  async finishQuiz() {
    // If review mode, clear the correctly answered words from missed list
    if (this.passMode === 'review') {
      await this.clearCorrectedMissedWords();
    }

    try {
      await this.supabase.client.rpc('finish_quiz_pass', {
        p_list_id: this.listId,
        p_pass_type: this.passMode,
        p_clear_missed: false
      });
    } catch (err) {
      console.error('Error finishing quiz:', err);
    }
  }

  private async clearCorrectedMissedWords() {
    // Fetch current progress to identify corrected words
    const { data: progress } = await this.supabase.client
      .from('quiz_progress')
      .select('state')
      .eq('list_id', this.listId)
      .eq('pass_type', 'review')
      .maybeSingle();

    if (!progress) return;

    const answeredIds = (progress.state as any)?.answered_ids || [];
    const incorrectIds = (progress.state as any)?.incorrect_ids || [];

    // Correctly answered words in this pass
    const correctedIds = answeredIds.filter((id: string) => !incorrectIds.includes(id));

    if (correctedIds.length > 0) {
      console.log(`[SightWordsQuiz] Clearing ${correctedIds.length} corrected words from missed list`);
      await this.supabase.client
        .from('user_missed_words')
        .delete()
        .eq('list_id', this.listId)
        .in('word_id', correctedIds);
    }
  }

  updateProgress() {
    const missed = this.answeredCount - this.correctCount;
    this.progressPercent = (this.answeredCount / this.totalWords) * 100;
    this.missedPercent = (missed / this.totalWords) * 100;
    this.progressLabel = `${this.answeredCount} / ${this.totalWords}`;
    this.missedLabel = `${missed} Missed`;
  }

  restart() {
    this.quizStarted = false;
    this.quizComplete = false;
  }

  onExit() {
    this.router.navigate(['/dashboard']);
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
