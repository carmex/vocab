import { Component, OnDestroy, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subscription, forkJoin, merge } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { QuizQuestion } from '../models/quiz-question.interface';
import { QuizService } from '../services/quiz.service';
import { SettingsService } from '../services/settings.service';
import { ClassroomService } from '../services/classroom.service';
import { AuthService } from '../services/auth.service';
import { SpeechService } from '../services/speech.service';
import { SupabaseService } from '../services/supabase.service';
import { TopNavComponent } from './top-nav/top-nav.component';
import { TwemojiPipe } from '../pipes/twemoji.pipe';
import { ListType } from '../models/list-type.enum';

import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule, MatProgressBarModule, MatButtonModule, MatIconModule, MatCardModule, TopNavComponent, TwemojiPipe, FormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.scss']
})
export class QuizComponent implements OnInit, OnDestroy {
  isSightWordQuiz = false;
  quizMode: 'main' | 'review' = 'main';
  listId: string = '';
  currentQuestion: QuizQuestion | null = null;
  isImageQuiz = false;
  isMathQuiz = false;
  quizStarted = true;
  interactionMode: 'multiple-choice' | 'speak' | 'spell' = 'multiple-choice';
  activeMode: 'multiple-choice' | 'speak' | 'read' | 'listen' | 'spell' | null = null;

  // Speech State
  isListening = false;
  isProcessing = false;
  isPlaying = false; // Audio playback state
  recognizedText = '';
  recognizedAlternatives: string[] = []
  spellingInput = ''; // For Spell Mode
  speechSupported = false;
  autoRecordEnabled = false; // Auto-record after first Record press
  autoPlayEnabled = false; // Auto-play after first Play press
  waitingForRecording = false; // Waiting for recording to become active before showing question
  mathVocabulary: string[] = []; // Vocabulary hints for Vosk speech recognition
  speechErrorMessage = ''; // Error message to show user when speech fails

  // Vosk Model Loading State
  isLoadingModel = false;
  modelLoadProgress = 0;
  modelLoadCancelled = false;

  // Feedback UI State
  feedbackVisible = false;
  selectedAnswer: string | null = null;
  isCorrect = false;

  // Progress
  progressPercent = 0;
  missedPercent = 0;
  progressLabel = '';
  missedLabel = '';

  // Timer State
  timerProgress = 0;
  isPaused = false;
  private timerInterval: any = null;
  private remainingTime = 0;
  private totalTime = 0;

  // Answer Delay State
  delayingAnswers = false;
  delayTimerProgress = 0;
  private delayTimerInterval: any = null;

  questId: string | null = null;
  returnSource: string | null = null;
  private speechSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private quizService: QuizService,
    private settingsService: SettingsService,
    private classroomService: ClassroomService,
    private auth: AuthService,
    private speechService: SpeechService,
    private supabaseService: SupabaseService,
    private ngZone: NgZone
  ) { }

  async ngOnInit(): Promise<void> {
    this.listId = this.route.snapshot.paramMap.get('listId') || '';
    this.quizMode = this.route.snapshot.paramMap.get('mode') as 'main' | 'review';
    this.questId = this.route.snapshot.queryParamMap.get('questId');
    this.returnSource = this.route.snapshot.queryParamMap.get('from');

    if (!this.listId || !this.quizMode) {
      this.router.navigate(['/lists']);
      return;
    }

    try {
      const { listType } = await this.quizService.startQuiz(this.listId, this.quizMode, this.questId);

      this.isImageQuiz = listType === ListType.IMAGE_DEFINITION;
      this.isSightWordQuiz = listType === ListType.SIGHT_WORDS;
      this.isMathQuiz = listType === ListType.MATH;

      if (this.isMathQuiz) {
        // Build vocabulary for speech recognition
        this.mathVocabulary = this.buildMathVocabulary();
      }

      // Check support for speech if needed (Math always needs it available, Sight Words might needs it for specific modes)
      this.speechSupported = this.speechService.isSTTSupported();
      if (!this.speechService.isNativeSupported() && this.speechSupported && (this.isMathQuiz || this.isSightWordQuiz)) {
        this.speechService.preloadModel();
      }

      if (this.isMathQuiz || this.isSightWordQuiz) {
        this.quizStarted = false; // Will start after mode selection
        return;
      }

      this.updateProgress();
      this.displayNextQuestion();
    } catch (err) {
      console.error('Failed to start quiz', err);
      alert('Error starting quiz. Check console.');
      this.router.navigate(['/lists']);
    }
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.delayTimerInterval) clearInterval(this.delayTimerInterval);
    this.speechSubscription?.unsubscribe();
    this.speechService.stopListening();
  }

  get shouldPreloadAudio(): boolean {
    if (this.isSightWordQuiz) {
      return this.activeMode === 'listen' || this.activeMode === 'spell';
    }
    return false; // Default for all other types (Math, Word/Def, Image/Def)
  }

  startWithMode(mode: 'multiple-choice' | 'speak' | 'read' | 'listen' | 'spell') {
    this.activeMode = mode;

    // Map Sight Words "Read" -> Speak Mode, "Listen" -> Multiple Choice Mode
    if (mode === 'read') {
      this.interactionMode = 'speak';
    } else if (mode === 'listen') {
      this.interactionMode = 'multiple-choice';
    } else if (mode === 'spell') {
      this.interactionMode = 'spell';
    } else {
      this.interactionMode = mode as 'multiple-choice' | 'speak';
    }

    // For speak mode, ensure Vosk model is loaded first
    const loadingTasks: Observable<any>[] = [];

    // 1. Vosk Model (for Speak Mode)
    if (this.interactionMode === 'speak' && !this.speechService.isVoskReady()) {
      loadingTasks.push(this.speechService.preloadVoskModel());
    }

    // 2. Premium Audio Pre-fetch (if enabled)
    const settings = this.settingsService.getSettings();
    if (settings.usePremiumVoice && this.shouldPreloadAudio) {
      const words = this.quizService.getRemainingWords();
      // Prefetch first 20 words if any
      if (words.length > 0) {
        loadingTasks.push(
          this.speechService.prefetchAudio(
            words.slice(0, 20),
            this.quizService.currentLanguage
          )
        );
      }
    }

    if (loadingTasks.length > 0) {
      this.isLoadingModel = true;
      this.modelLoadProgress = 0;
      this.modelLoadCancelled = false;

      let audioFinished = false;
      let voskFinished = false;

      // Check if we can proceed
      const checkDone = () => {
        // We are done if: (Mode != Speak OR VoskReady) AND (Premium != True OR AudioFinished)
        const voskReady = (this.interactionMode !== 'speak' || this.speechService.isVoskReady() || voskFinished);
        const audioReady = (!settings.usePremiumVoice || !this.shouldPreloadAudio || audioFinished);

        if (voskReady && audioReady) {
          this.isLoadingModel = false;
          this.startQuizNow();
        }
      };

      // Mark tasks as done if they weren't added
      if (this.interactionMode !== 'speak' || this.speechService.isVoskReady()) voskFinished = true;
      if (!settings.usePremiumVoice || !this.shouldPreloadAudio) audioFinished = true;

      // Subscribe to tasks
      if (this.interactionMode === 'speak' && !this.speechService.isVoskReady()) {
        this.speechService.preloadVoskModel().subscribe({
          next: (p) => {
            if (p.status === 'done') {
              voskFinished = true;
              checkDone();
            }
            // We could separate progress bars but let's just show indeterminate or "Loading..."
          },
          error: () => {
            this.isLoadingModel = false;
            alert('Voice recognition failed.');
          }
        });
      }

      if (settings.usePremiumVoice && this.shouldPreloadAudio) {
        const words = this.quizService.getRemainingWords();
        if (words.length > 0) {
          this.speechService.prefetchAudio(words.slice(0, 20), this.quizService.currentLanguage).subscribe({
            next: (p) => {
              if (p.total > 0) {
                this.modelLoadProgress = (p.completed / p.total) * 100;
              }
            },
            complete: () => {
              audioFinished = true;
              checkDone();
            }
          });
        } else {
          audioFinished = true;
          checkDone();
        }
      } else {
        checkDone(); // Should be covered by init logic but safe to check
      }

      return;
    }

    this.startQuizNow();
  }

  private startQuizNow() {
    this.quizStarted = true;
    this.updateProgress();
    this.displayNextQuestion();
  }

  // Helper for Sight Words Listen Mode
  async playWord() {
    this.autoPlayEnabled = true;

    if (this.currentQuestion && this.currentQuestion.wordToQuiz.word) {
      try {
        this.isPlaying = true;
        await this.speechService.speak(this.currentQuestion.wordToQuiz.word, this.quizService.currentLanguage);
      } finally {
        this.isPlaying = false;
      }
    }
  }

  onStopSpeaking() {
    this.speechService.stopSpeaking();
    this.isPlaying = false;
    // Note: The promise in playWord will resolve (or reject) and the finally block will also set isPlaying=false
  }

  onDontKnow() {
    if (this.feedbackVisible || !this.currentQuestion) return;

    if (this.isListening) {
      this.onStopListening();
    }

    this.feedbackVisible = true;
    this.selectedAnswer = "Don't Know";
    this.isCorrect = false;
    this.recognizedText = "Don't Know"; // Fallback for UI

    // Play correct answer if in Read Mode (or if useful for learning)
    if (this.isSightWordQuiz && this.activeMode === 'read' && this.currentQuestion.wordToQuiz.word) {
      this.speechService.speak(this.currentQuestion.wordToQuiz.word, this.quizService.currentLanguage);
    }

    if (this.currentQuestion.wordToQuiz.id) {
      this.quizService.submitAnswer(
        this.currentQuestion.wordToQuiz.id,
        false,
        this.currentQuestion.wordToQuiz.word
      );
    }
    this.updateProgress();

    // Auto Advance
    const settings = this.settingsService.getSettings();
    if (settings.autoAdvance) {
      this.totalTime = settings.incorrectAnswerTimer * 1000;
      this.remainingTime = this.totalTime;
      this.startTimer();
    }
  }

  cancelModelLoad() {
    this.modelLoadCancelled = true;
    this.isLoadingModel = false;
    this.router.navigate(['/dashboard']);
  }

  private async displayNextQuestion() {
    this.feedbackVisible = false;
    this.selectedAnswer = null;
    this.isCorrect = false;
    this.timerProgress = 0;
    this.isPaused = false;

    // Clear any existing delay timer
    if (this.delayTimerInterval) clearInterval(this.delayTimerInterval);
    this.delayingAnswers = false;
    this.delayTimerProgress = 0;

    this.isListening = false;
    this.isProcessing = false;
    this.isPlaying = false;
    this.recognizedText = '';
    this.spellingInput = '';

    this.currentQuestion = this.quizService.getNextQuestion();

    if (!this.currentQuestion) {
      // Quiz Over - Save result for gradebook
      await this.quizService.saveQuizResult();

      const queryParams: any = {};
      if (this.returnSource) {
        queryParams.from = this.returnSource;
      }

      if (this.questId) {
        // Mark quest as complete
        const userId = this.auth.currentUser?.id;
        if (userId) {
          this.classroomService.completeQuest(this.questId, userId).subscribe({
            next: () => console.log('Quest completed!'),
            error: (err) => console.error('Error completing quest:', err)
          });
        }
        queryParams.questCompleted = true;
      }
      this.router.navigate(['/summary'], { queryParams });
      return;
    }

    // Auto-record for speak mode after first question
    if (this.interactionMode === 'speak' && this.autoRecordEnabled && this.currentQuestion) {
      this.waitingForRecording = true; // Hide question until recording active
      // Start recording, show question when 'listening' status received
      this.startAutoRecording();
    }

    // Auto-play for listen or spell mode
    if ((this.activeMode === 'listen' || this.activeMode === 'spell') && this.autoPlayEnabled && this.currentQuestion) {
      this.isPlaying = true; // Show "Pause/Stop" immediately during delay
      setTimeout(() => this.playWord(), 500);
    }

    // Background Audio Prefetching (Lazy Buffer)
    const settings = this.settingsService.getSettings();
    if (settings.usePremiumVoice && this.currentQuestion && this.shouldPreloadAudio) {
      // Ensure the next 15 words are cached
      const remainingWords = this.quizService.getRemainingWords();
      if (remainingWords.length > 0) {
        this.speechService.prefetchAudio(
          remainingWords.slice(0, 15),
          this.quizService.currentLanguage
        ).subscribe(); // Subscribe to trigger, ignore result
      }
      return;
    }

    // Check delay settings

    if (settings.delayAnswers) {
      this.startDelayTimer(settings.delayAnswerTimer);
    }
  }

  private startAutoRecording() {
    if (!this.currentQuestion) return;

    this.isListening = true;
    this.recognizedText = '';
    this.speechErrorMessage = ''; // Clear any previous error

    const vocabulary = this.isMathQuiz
      ? this.mathVocabulary
      : undefined;
    const language = this.quizService.currentLanguage || 'en';
    this.speechSubscription?.unsubscribe();
    const captureAudio = this.isSightWordQuiz || this.isMathQuiz;
    this.speechSubscription = this.speechService.listen(this.currentQuestion.correctAnswer, language, vocabulary, captureAudio).subscribe({
      next: (result) => {
        this.ngZone.run(() => {
          // When we get 'listening' status, show the question
          if ('status' in result && result.status === 'listening') {
            this.waitingForRecording = false;
            return;
          }

          if ('error' in result) {
            console.error('Speech error:', result.error);
            this.isListening = false;
            this.isProcessing = false;
            this.waitingForRecording = false;
            // Show error message to user
            this.speechErrorMessage = "Didn't catch that. Please try again.";
            return;
          }

          if ('status' in result && result.status === 'processing') {
            this.isProcessing = true;
            this.isListening = false;
            return;
          }

          if ('result' in result) {
            console.log('[Quiz] Got result:', result.result, 'correct answer:', this.currentQuestion?.correctAnswer);
            this.isListening = false;
            this.isProcessing = false;
            this.recognizedText = result.result;


            // Upload Audio if available (Debug)
            if ('audioBlob' in result && result.audioBlob) {
              this.uploadDebugAudio(result.audioBlob, this.currentQuestion?.wordToQuiz.word || 'unknown');
            }

            // Handle [unk] (Unknown) result from Vosk - give user another chance
            if (result.result.includes('[unk]')) {
              console.log('[Quiz] Received [unk] result, asking for retry...');
              this.isListening = false;
              this.isProcessing = false;
              this.waitingForRecording = false;
              this.speechErrorMessage = "Didn't catch that. Please try again.";
              this.recognizedText = '';
              return;
            }

            // Store alternatives for debug display
            if (result.alternatives) {
              this.recognizedAlternatives = result.alternatives;
            } else {
              this.recognizedAlternatives = [result.result];
            }

            const correctAnswer = this.currentQuestion?.correctAnswer || '';
            if (this.speechService.wordsMatch(result.alternatives || result.result, correctAnswer)) {
              console.log('[Quiz] Words match! Marking correct.');
              this.onAnswer(correctAnswer);
            } else {
              console.log('[Quiz] Words do NOT match. Marking incorrect.');
              this.onSpeakIncorrect(result.result);
            }
          }
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error('Speech fatal error:', err);
          this.isListening = false;
          this.isProcessing = false;
          this.waitingForRecording = false;
        });
      }
    });
  }

  private startDelayTimer(durationSeconds: number) {
    this.delayingAnswers = true;
    this.delayTimerProgress = 100;

    const step = 50; // Update frequently for smooth bar
    let remaining = durationSeconds * 1000;
    const total = remaining;

    if (this.delayTimerInterval) clearInterval(this.delayTimerInterval);

    this.delayTimerInterval = setInterval(() => {
      remaining -= step;
      this.delayTimerProgress = (remaining / total) * 100;

      if (remaining <= 0) {
        clearInterval(this.delayTimerInterval);
        this.delayingAnswers = false;
        this.delayTimerProgress = 0;
      }
    }, step);
  }

  onAnswer(selectedOption: string) {
    if (this.feedbackVisible || !this.currentQuestion) return;

    this.feedbackVisible = true;
    this.selectedAnswer = selectedOption;
    this.isCorrect = (selectedOption === this.currentQuestion.correctAnswer);

    // Optimistic Update
    if (this.currentQuestion.wordToQuiz.id) {
      this.quizService.submitAnswer(
        this.currentQuestion.wordToQuiz.id,
        this.isCorrect,
        this.currentQuestion.wordToQuiz.word
      );
    }

    this.updateProgress();

    // Auto-advance logic
    const settings = this.settingsService.getSettings();
    if (settings.autoAdvance) {
      this.totalTime = this.isCorrect ? settings.correctAnswerTimer * 1000 : settings.incorrectAnswerTimer * 1000;
      this.remainingTime = this.totalTime;
      this.startTimer();
    }
  }

  onRecord() {
    if (this.isListening || !this.currentQuestion) return;

    // Enable auto-recording after first manual record press
    this.autoRecordEnabled = true;

    this.isListening = true;
    this.recognizedText = '';
    this.speechErrorMessage = ''; // Clear any previous error

    // Listen for the correct answer
    // For Math, correct answer is usually a digit (e.g. "6") or word ("six")
    // For Math, correct answer is usually a digit (e.g. "6") or word ("six")
    const vocabulary = this.isMathQuiz
      ? this.mathVocabulary
      : undefined;
    const language = this.quizService.currentLanguage || 'en';
    this.speechSubscription?.unsubscribe();
    const captureAudio = this.isSightWordQuiz || this.isMathQuiz; // Always debug audio for now if speech used
    this.speechSubscription = this.speechService.listen(this.currentQuestion.correctAnswer, language, vocabulary, captureAudio).subscribe({
      next: (result) => {
        console.log('[Quiz] Received from speech service:', result);
        this.ngZone.run(() => {
          if ('error' in result) {
            console.error('Speech error:', result.error);
            this.isListening = false;
            this.isProcessing = false;
            // Show error message to user
            this.speechErrorMessage = "Didn't catch that. Please try again.";
            return;
          }

          if ('status' in result && result.status === 'processing') {
            this.isProcessing = true;
            this.isListening = false;
            return;
          }

          if ('result' in result) {
            console.log('[Quiz] Got result:', result.result, 'correct answer:', this.currentQuestion?.correctAnswer);
            this.isListening = false;
            this.isProcessing = false;
            this.recognizedText = result.result;
            console.log('[Quiz] recognizedText set to:', this.recognizedText);

            // Upload Audio if available (Debug)
            if ('audioBlob' in result && result.audioBlob) {
              this.uploadDebugAudio(result.audioBlob, this.currentQuestion?.wordToQuiz.word || 'unknown');
            }

            // Handle [unk] (Unknown) result from Vosk - give user another chance
            if (result.result.includes('[unk]')) {
              console.log('[Quiz] Received [unk] result, asking for retry...');
              this.isListening = false;
              this.isProcessing = false;
              this.waitingForRecording = false;
              this.speechErrorMessage = "Didn't catch that. Please try again.";
              this.recognizedText = '';
              return;
            }

            // Store alternatives for debug display
            if (result.alternatives) {
              this.recognizedAlternatives = result.alternatives;
            } else {
              this.recognizedAlternatives = [result.result];
            }

            const correctAnswer = this.currentQuestion?.correctAnswer || '';
            if (this.speechService.wordsMatch(result.alternatives || result.result, correctAnswer)) {
              console.log('[Quiz] Words match! Marking correct.');
              this.onAnswer(correctAnswer); // Pass correct answer to simulate match
            } else {
              console.log('[Quiz] Words do NOT match. Marking incorrect.');
              // Handle explicit incorrect
              this.onSpeakIncorrect(result.result);
            }
          }
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error('Speech fatal error:', err);
          this.isListening = false;
          this.isProcessing = false;
        });
      }
    });
  }

  onStopListening() {
    this.speechSubscription?.unsubscribe();
    this.speechService.stopListening();
    this.isListening = false;
    // Disable auto-record - user must press Record again to re-enable
    this.autoRecordEnabled = false;
  }

  onSpeakIncorrect(text: string) {
    if (this.feedbackVisible || !this.currentQuestion) return;

    this.feedbackVisible = true;
    this.selectedAnswer = text; // Show what was said
    this.isCorrect = false;
    this.recognizedText = text;

    // Logic similar to onAnswer but for custom text
    if (this.currentQuestion.wordToQuiz.id) {
      this.quizService.submitAnswer(
        this.currentQuestion.wordToQuiz.id,
        this.isCorrect,
        this.currentQuestion.wordToQuiz.word
      );
    }
    this.updateProgress();

    // Auto Advance
    const settings = this.settingsService.getSettings();
    if (settings.autoAdvance) {
      this.totalTime = settings.incorrectAnswerTimer * 1000;
      this.remainingTime = this.totalTime;
      this.startTimer();
    }
  }

  checkSpelling() {
    if (this.feedbackVisible || !this.currentQuestion) return;

    const userAnswer = this.spellingInput.trim();
    if (!userAnswer) return;

    this.feedbackVisible = true;
    this.selectedAnswer = userAnswer;
    this.recognizedText = userAnswer; // Reuse 'recognizedText' to display what user typed in feedback

    // Check case-insensitive and accent-insensitive match
    const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    this.isCorrect = normalize(userAnswer) === normalize(this.currentQuestion.correctAnswer);

    if (this.currentQuestion.wordToQuiz.id) {
      this.quizService.submitAnswer(
        this.currentQuestion.wordToQuiz.id,
        this.isCorrect,
        this.currentQuestion.wordToQuiz.word
      );
    }
    this.updateProgress();

    // Auto Advance
    const settings = this.settingsService.getSettings();
    if (settings.autoAdvance) {
      this.totalTime = this.isCorrect ? settings.correctAnswerTimer * 1000 : settings.incorrectAnswerTimer * 1000;
      this.remainingTime = this.totalTime;
      this.startTimer();
    }
  }

  private startTimer() {
    this.isPaused = false;
    const step = 100; // Update every 100ms

    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      this.remainingTime -= step;
      this.timerProgress = (this.remainingTime / this.totalTime) * 100;

      if (this.remainingTime <= 0) {
        this.onNext();
      }
    }, step);
  }

  onPause() {
    this.isPaused = true;
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  onNext() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.displayNextQuestion();
  }

  onSettings() {
    this.router.navigate(['/settings']);
  }

  onExit() {
    if (this.returnSource === 'quests') {
      this.router.navigate(['/quests']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  private updateProgress() {
    const total = this.quizService.totalWordsInPass;
    const answered = this.quizService.answeredCount;
    const correct = this.quizService.correctCount;
    const missed = answered - correct;

    this.progressPercent = (answered / total) * 100;
    this.missedPercent = (missed / total) * 100;
    this.progressLabel = `${answered} / ${total}`;
    this.missedLabel = `${missed} Missed`;
  }

  /** Build vocabulary list of number words for Vosk grammar constraint */
  private buildMathVocabulary(): string[] {
    const ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
      'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    const vocab: string[] = [];

    // Add 0-19 as words
    vocab.push(...ones);

    // Add 20-99 as words
    for (let t = 2; t <= 9; t++) {
      vocab.push(tens[t]);
      for (let o = 1; o <= 9; o++) {
        vocab.push(tens[t] + ' ' + ones[o]);
      }
    }

    // Add 100-144 as words (for 12x12 tables)
    for (let n = 100; n <= 144; n++) {
      if (n === 100) {
        vocab.push('one hundred');
      } else {
        const remainder = n - 100;
        if (remainder < 20) {
          vocab.push('one hundred ' + ones[remainder]);
          vocab.push('one hundred and ' + ones[remainder]);
        } else {
          const t = Math.floor(remainder / 10);
          const o = remainder % 10;
          if (o === 0) {
            vocab.push('one hundred ' + tens[t]);
            vocab.push('one hundred and ' + tens[t]);
          } else {
            vocab.push('one hundred ' + tens[t] + ' ' + ones[o]);
            vocab.push('one hundred and ' + tens[t] + ' ' + ones[o]);
          }
        }
      }
    }

    // Also add negative word prefix
    vocab.push('negative');
    vocab.push('minus');

    console.log('[Quiz] Built math vocabulary with', vocab.length, 'words');
    return vocab;
  }

  private uploadDebugAudio(blob: Blob, word: string) {
    if (!this.auth.currentUser) {
      console.warn('[Quiz] Cannot upload audio: No user logged in');
      return;
    }

    console.log('[Quiz] Attempting to upload audio blob:', blob.size, 'bytes for word:', word);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let lang = this.quizService.currentLanguage || 'en-US';
    if (lang === 'en') lang = 'en-US';
    if (lang === 'es') lang = 'es-US';
    const filename = `${lang}-${word}-${timestamp}.webm`;

    this.supabaseService.uploadUserRecording(blob, filename)
      .then(({ data, error }) => {
        if (error) console.error('[Quiz] Audio upload failed:', error);
        else console.log('[Quiz] Audio uploaded successfully:', data);
      });
  }
}