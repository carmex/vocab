import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { SettingsService } from './settings.service';
import { SupabaseService } from './supabase.service';
import { doubleMetaphone } from 'double-metaphone';

@Injectable({
    providedIn: 'root'
})
export class SpeechService {
    private synth: SpeechSynthesis | null = null;
    private recognition: any = null;

    // Whisper / Enhanced Speech properties
    private worker: Worker | null = null;
    private ttsWorker: Worker | null = null;
    private ttsReady = false;
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private audioProcessor: ScriptProcessorNode | null = null;
    private audioWorkletNode: AudioWorkletNode | null = null;
    private isWarmingUp = false;
    private modelLoadingSubject = new Subject<{ status: string; progress?: number }>();

    // Vosk properties
    private voskWorker: Worker | null = null;
    private voskModelReady = false;
    private voskModelCached = false; // Indicates model is cached in browser (fast to load)
    private voskModelLoading = false;
    private voskReadyPromise: Promise<void> | null = null;
    private voskReadyResolve: (() => void) | null = null;
    private voskTimeoutId: any = null; // Track auto-stop timeout
    private voskVocabulary: string[] | undefined = undefined; // Current vocabulary for grammar
    private voskCurrentLanguage: string = 'en'; // Track currently loaded language model
    private currentAudio: HTMLAudioElement | null = null; // Track currently playing audio for cancellation
    private currentProvider: 'native' | 'vosk' | 'whisper' | null = null; // Track active recognition provider


    constructor(
        private settingsService: SettingsService,
        private supabase: SupabaseService,
        private ngZone: NgZone
    ) {
        if (typeof window !== 'undefined') {
            this.synth = window.speechSynthesis;

            // Check for native SpeechRecognition support
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                this.recognition = new SpeechRecognition();
                this.recognition.continuous = false;
                this.recognition.interimResults = false;
                this.recognition.lang = 'en-US';
            }

            // Check if Vosk model was previously loaded (cached in browser storage)
            // Note: cached means fast to load, not ready to use yet
            this.voskModelCached = localStorage.getItem('voskModelCached') === 'true';
            if (this.voskModelCached) {
                console.log('[SpeechService] Vosk model previously cached (will load quickly)');
            }
        }

        // Expose for E2E testing
        (window as any).speechService = this;
    }



    private initWorker() {
        if (typeof Worker !== 'undefined') {
            this.worker = new Worker(new URL('../workers/whisper.worker', import.meta.url));
            this.worker.onmessage = (event) => {
                const { type, data, text, error } = event.data;
                if (type === 'progress') {
                    this.ngZone.run(() => this.modelLoadingSubject.next(data));
                } else if (type === 'ready') {
                    console.log('[SpeechService] Model ready, running warm-up inference...');
                    this.isWarmingUp = true;
                    // Send 1s of silence to trigger init glitch
                    this.worker?.postMessage({ type: 'process', audio: new Float32Array(16000), modelName: 'tiny' });
                } else if (type === 'result') {
                    if (this.isWarmingUp) {
                        console.log('[SpeechService] Warm-up complete.');
                        this.isWarmingUp = false;
                        this.ngZone.run(() => this.modelLoadingSubject.next({ status: 'done', progress: 100 }));
                    }
                } else if (type === 'error') {
                    console.error('[SpeechService] Worker error:', error);
                }
            };

            // Trigger load to convert pipeline
            const model = 'tiny'; // Always use tiny as fallback
            this.worker.postMessage({ type: 'load', modelName: model });
        }
    }

    private initVoskWorker() {
        if (typeof Worker !== 'undefined' && !this.voskWorker) {
            this.voskWorker = new Worker(new URL('../workers/vosk.worker', import.meta.url));
            this.voskWorker.onmessage = (event) => {
                const { type, data, error } = event.data;
                if (type === 'progress') {
                    this.ngZone.run(() => this.modelLoadingSubject.next(data));
                } else if (type === 'ready') {
                    // console.log('[SpeechService] Vosk model ready');
                    this.voskModelReady = true;
                    this.voskModelCached = true;
                    this.voskModelLoading = false;
                    // Persist cached state to localStorage
                    localStorage.setItem('voskModelCached', 'true');
                    // Resolve any pending waitForVoskReady promises
                    if (this.voskReadyResolve) {
                        this.voskReadyResolve();
                        this.voskReadyResolve = null;
                        this.voskReadyPromise = null;
                    }
                    this.ngZone.run(() => this.modelLoadingSubject.next({ status: 'done', progress: 100 }));
                } else if (type === 'error') {
                    console.error('[SpeechService] Vosk worker error:', error);
                    this.voskModelLoading = false;
                    this.ngZone.run(() => this.modelLoadingSubject.next({ status: 'error', progress: 0 }));
                }
            };
        }
    }

    /**
     * Check if Vosk model is ready for use
     */
    isVoskReady(): boolean {
        return this.voskModelReady;
    }

    /**
     * Check if Vosk model is cached (will load quickly)
     */
    isVoskCached(): boolean {
        return this.voskModelCached;
    }

    /**
     * Check if Vosk model is currently loading
     */
    isVoskLoading(): boolean {
        return this.voskModelLoading;
    }

    /**
     * Preload the Vosk model for a specific language (for use in quiz loading screens)
     * Returns immediately with 'done' if model is cached (fast load)
     * @param language - 'en' for English (default), 'es' for Spanish
     */
    preloadVoskModel(language: string = 'en'): Observable<{ status: string; progress?: number }> {
        // Normalize language code (e.g., 'en-US' -> 'en', 'es-US' -> 'es')
        const lang = language.split('-')[0];
        // If model is already ready for this language and worker is running - instant
        if (this.voskModelReady && this.voskWorker && this.voskCurrentLanguage === lang) {
            setTimeout(() => this.modelLoadingSubject.next({ status: 'done', progress: 100 }), 0);
            return this.modelLoadingSubject.asObservable();
        }

        // If switching languages, we need to reload the model
        if (this.voskModelReady && this.voskCurrentLanguage !== lang) {
            console.log(`[SpeechService] Switching Vosk model from ${this.voskCurrentLanguage} to ${lang}`);
            this.voskModelReady = false;
        }

        // If model is cached, it will load very quickly - don't show progress UI
        // Just init the worker and loading will happen fast in background
        if (this.voskModelCached || this.voskModelReady === false) {
            if (!this.voskModelLoading && !this.voskWorker) {
                this.voskModelLoading = true;
                this.initVoskWorker();
            }
            // Send load command with language - use optional chaining since TypeScript can't track initVoskWorker setting the worker
            this.voskWorker?.postMessage({ type: 'load', language: lang });
            this.voskCurrentLanguage = lang;
            // Emit done immediately - the model will be ready by the time user starts speaking
            // (cached model loads in ~200-500ms, user won't start speaking that fast)
            setTimeout(() => this.modelLoadingSubject.next({ status: 'done', progress: 100 }), 0);
            return this.modelLoadingSubject.asObservable();
        }

        // Not cached - do full loading with progress
        if (!this.voskModelLoading) {
            this.voskModelLoading = true;
            this.initVoskWorker();
            if (this.voskWorker) {
                this.voskWorker.postMessage({ type: 'load', language: lang });
                this.voskCurrentLanguage = lang;
            }

            // Simulate progress since vosk-browser doesn't emit granular progress
            let simulatedProgress = 0;
            const progressInterval = setInterval(() => {
                if (!this.voskModelLoading) {
                    clearInterval(progressInterval);
                    return;
                }
                // Simulate slower progress that never quite reaches 100%
                simulatedProgress = Math.min(95, simulatedProgress + Math.random() * 15);
                this.ngZone.run(() => this.modelLoadingSubject.next({
                    status: 'loading',
                    progress: Math.round(simulatedProgress)
                }));
            }, 500);
        }

        return this.modelLoadingSubject.asObservable();
    }

    getModelLoadingProgress(): Observable<{ status: string; progress?: number }> {
        return this.modelLoadingSubject.asObservable();
    }

    /**
     * Check if TTS is supported
     */
    isTTSSupported(): boolean {
        return this.synth !== null;
    }

    /**
     * Check if STT is supported (Native or Whisper)
     */
    isSTTSupported(): boolean {
        // Supported if native exists OR if we can run the worker (most modern browsers)
        return this.recognition !== null || typeof Worker !== 'undefined';
    }

    isNativeSupported(): boolean {
        return this.recognition !== null;
    }

    /**
     * Speak the given text using Text-to-Speech
     */
    speak(text: string, language: string = 'en'): Promise<void> {
        return new Promise(async (resolve, reject) => {
            const settings = this.settingsService.getSettings();

            // 0. Premium Audio (Cloud)
            // If Premium is enabled, we try it first.
            // If it fails, we fall back DIRECTLY to Native TTS (skipping Enhanced to avoid OOM/heavy downloads).
            if (settings.usePremiumVoice) {
                try {
                    await this.playPremium(text, language);
                    resolve();
                    return;
                } catch (e) {
                    console.warn('Premium TTS failed, falling back to native', e);
                    // Fall through to native (skip Enhanced)
                }
            }

            // 1. Enhanced TTS (Local - only supports English currently)
            // Only run if Premium is NOT enabled
            else if (settings.enhancedTTS && language === 'en') {
                try {
                    await this.speakWithEnhanced(text, settings.ttsVoice);
                    resolve();
                    return;
                } catch (e) {
                    console.warn('Enhanced TTS failed, falling back to native', e);
                    // Fall through to native
                }
            }

            // 2. Native TTS
            if (!this.synth) {
                reject(new Error('TTS not supported'));
                return;
            }

            // Cancel any ongoing speech
            this.synth.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9; // Slightly slower for children
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            // Set language based on parameter
            const langMap: { [key: string]: string } = {
                'en': 'en-US',
                'es': 'es-ES'
            };
            utterance.lang = langMap[language] || 'en-US';

            // Try to find a good voice for the language
            const voices = this.synth.getVoices();
            let selectedVoice = null;

            if (language === 'es') {
                // For Spanish, find a Spanish voice
                selectedVoice = voices.find(v => v.lang.startsWith('es'));
            } else {
                // For English, prefer female voices
                selectedVoice = voices.find(v =>
                    v.lang.startsWith('en') &&
                    (v.name.toLowerCase().includes('female') ||
                        v.name.toLowerCase().includes('samantha') ||
                        v.name.toLowerCase().includes('victoria') ||
                        v.name.toLowerCase().includes('karen') ||
                        v.name.toLowerCase().includes('moira') ||
                        v.name.toLowerCase().includes('fiona') ||
                        v.name.toLowerCase().includes('zira') ||
                        v.name.toLowerCase().includes('hazel') ||
                        v.name.toLowerCase().includes('susan') ||
                        v.name.toLowerCase().includes('kate'))
                );
            }

            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }

            utterance.onend = () => resolve();
            utterance.onerror = (event) => reject(event.error);

            this.synth.speak(utterance);
        });
    }

    /**
     * Stop any currently playing TTS or Premium Audio
     */
    stopSpeaking(): void {
        // Stop Native TTS
        if (this.synth) {
            this.synth.cancel();
        }

        // Stop Premium Audio
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0; // Reset
            this.currentAudio = null;
        }

        // TODO: Stop Enhanced TTS (Worker) if needed, though usually short
    }

    private audioCache = new Map<string, string>(); // Key: "lang-word", Value: BlobURL

    /**
     * Pre-fetch audio for a list of words.
     * Returns progress updates.
     */
    prefetchAudio(words: string[], language: string, concurrency: number = 5): Observable<{ completed: number, total: number }> {
        const uniqueWords = [...new Set(words)]; // Remove duplicates
        const wordsToFetch = uniqueWords.filter(w => !this.audioCache.has(`${language}-${w.toLowerCase().trim()}`));
        const total = wordsToFetch.length;
        let completed = 0;

        if (total === 0) {
            return new Observable(obs => {
                obs.next({ completed: 0, total: 0 });
                obs.complete();
            });
        }

        console.log(`[SpeechService] Pre-fetching ${total} words (concurrency: ${concurrency})...`);

        return new Observable(observer => {
            const queue = [...wordsToFetch];
            let active = 0;
            let cancelled = false;

            const next = () => {
                if (cancelled) return;

                // If queue empty and no active requests, we're done
                if (queue.length === 0 && active === 0) {
                    observer.complete();
                    return;
                }

                // Fill active slots
                while (active < concurrency && queue.length > 0) {
                    const word = queue.shift()!;
                    active++;

                    this.fetchAndCache(word, language)
                        .then(() => {
                            completed++;
                            observer.next({ completed, total });
                        })
                        .catch(err => {
                            console.warn(`[SpeechService] Failed to prefetch "${word}":`, err);
                            // Even on error, we count as "handled" for progress
                            completed++;
                            observer.next({ completed, total });
                        })
                        .finally(() => {
                            active--;
                            next();
                        });
                }
            };

            next();

            return () => {
                cancelled = true;
            };
        });
    }

    async getListsAudioStats(listIds: string[]): Promise<any[]> {
        const { data, error } = await this.supabase.client.rpc('get_lists_audio_stats', { p_list_ids: listIds });
        if (error) throw error;
        return data;
    }

    private async fetchAndCache(text: string, language: string): Promise<string> {
        const key = `${language}-${text.toLowerCase().trim()}`;

        // Return if already cached
        if (this.audioCache.has(key)) {
            return this.audioCache.get(key)!;
        }

        console.log(`[SpeechService] Fetching audio for: "${text}" (${language})`);

        // 1. Call Edge Function (or check Storage)
        const { data, error } = await this.supabase.client.functions.invoke('generate-audio', {
            body: { word: text, language: language }
        });

        if (error) throw error;

        // 2. Construct Public URL
        const filename = `audio/${language}-${text.toLowerCase().trim()}.wav`;
        const { data: publicData } = this.supabase.client
            .storage
            .from('quiz-audio')
            .getPublicUrl(filename);

        if (!publicData || !publicData.publicUrl) throw new Error('Could not generate audio URL');

        // 3. Fetch Blob to cache locally
        const response = await fetch(publicData.publicUrl);
        if (!response.ok) throw new Error(`Failed to download audio: ${response.statusText}`);

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        this.audioCache.set(key, blobUrl);
        return blobUrl;
    }

    async playPremium(text: string, language: string = 'en'): Promise<void> {
        try {
            const key = `${language}-${text.toLowerCase().trim()}`;
            let audioUrl: string;

            if (this.audioCache.has(key)) {
                console.log(`[SpeechService] Playing cached audio for: "${text}"`);
                audioUrl = this.audioCache.get(key)!;
            } else {
                // Fetch and cache on demand
                audioUrl = await this.fetchAndCache(text, language);
                console.log(`[SpeechService] Playing new audio for: "${text}"`);
            }

            // Play audio from URL (Blob or Remote)
            await new Promise<void>((resolve, reject) => {
                const audio = new Audio(audioUrl);
                this.currentAudio = audio; // Track for cancellation

                audio.onended = () => {
                    this.currentAudio = null;
                    resolve();
                };
                audio.onerror = (e) => {
                    this.currentAudio = null;
                    reject(e);
                };

                // Handle user cancellation (pause) as a resolve/abort
                audio.onpause = () => {
                    // If paused manually via stopSpeaking, we consider it done or aborted
                    if (this.currentAudio === null) {
                        resolve(); // Resolve promise so await finishes
                    }
                };

                audio.play().catch(e => {
                    this.currentAudio = null;
                    reject(e);
                });
            });

        } catch (err) {
            console.error('[SpeechService] Premium TTS failed:', err);
            throw err; // Propagate to fallback
        }
    }

    preloadTTS() {
        this.initTTSWorker();
    }

    private initTTSWorker() {
        if (!this.ttsWorker && typeof Worker !== 'undefined') {
            this.ttsWorker = new Worker(new URL('../workers/tts.worker', import.meta.url));
            this.ttsWorker.onmessage = (event) => {
                const { type, data } = event.data;
                if (type === 'progress') {
                    this.ngZone.run(() => this.modelLoadingSubject.next(data));
                } else if (type === 'ready') {
                    this.ttsReady = true;
                    this.ngZone.run(() => this.modelLoadingSubject.next({ status: 'done', progress: 100 }));
                }
            };
            // Trigger load immediately to prepare
            this.ttsWorker.postMessage({ type: 'load' });
        }
    }

    private speakWithEnhanced(text: string, voiceId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.initTTSWorker();

            const handler = (event: MessageEvent) => {
                const { type, audio, sampling_rate, error } = event.data;
                if (type === 'result') {
                    cleanup();
                    this.playAudio(audio, sampling_rate).then(resolve).catch(reject);
                } else if (type === 'error') {
                    cleanup();
                    reject(error);
                }
            };

            const cleanup = () => {
                this.ttsWorker?.removeEventListener('message', handler);
            };

            this.ttsWorker!.addEventListener('message', handler);

            // Ensure text ends with punctuation to prevent model hallucination ("echo")
            const cleanText = text.trim();
            const safeText = /[.!?]$/.test(cleanText) ? cleanText : `${cleanText}.`;

            this.ttsWorker!.postMessage({ type: 'speak', text: safeText, voiceId });
        });
    }

    private async playAudio(audio: Float32Array, sampleRate: number) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        const buffer = this.audioContext.createBuffer(1, audio.length, sampleRate);
        buffer.copyToChannel(audio as any, 0);

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);

        return new Promise<void>((resolve) => {
            source.onended = () => resolve();
            source.start();
        });
    }

    /**
     * Play a short ascending chime to indicate listening started
     */
    private uiAudioContext: AudioContext | null = null;

    /**
     * Play a short ascending chime to indicate listening started
     */
    private playListeningSound() {
        if (!this.uiAudioContext) {
            this.uiAudioContext = new AudioContext();
        }
        if (this.uiAudioContext.state === 'suspended') {
            this.uiAudioContext.resume().catch(() => { });
        }

        const osc = this.uiAudioContext.createOscillator();
        const gain = this.uiAudioContext.createGain();

        osc.connect(gain);
        gain.connect(this.uiAudioContext.destination);

        // Ascending pitch: 400Hz -> 600Hz
        osc.frequency.setValueAtTime(400, this.uiAudioContext.currentTime);
        osc.frequency.linearRampToValueAtTime(600, this.uiAudioContext.currentTime + 0.1);

        // Short envelope
        gain.gain.setValueAtTime(0.1, this.uiAudioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.uiAudioContext.currentTime + 0.3);

        osc.start(this.uiAudioContext.currentTime);
        osc.stop(this.uiAudioContext.currentTime + 0.3);
    }

    /**
     * Play a short descending chime to indicate listening stopped
     */
    private playStopSound() {
        if (!this.uiAudioContext) {
            this.uiAudioContext = new AudioContext();
        }
        if (this.uiAudioContext.state === 'suspended') {
            this.uiAudioContext.resume().catch(() => { });
        }

        const osc = this.uiAudioContext.createOscillator();
        const gain = this.uiAudioContext.createGain();

        osc.connect(gain);
        gain.connect(this.uiAudioContext.destination);

        // Descending pitch: 600Hz -> 400Hz
        osc.frequency.setValueAtTime(600, this.uiAudioContext.currentTime);
        osc.frequency.linearRampToValueAtTime(400, this.uiAudioContext.currentTime + 0.1);

        // Short envelope
        gain.gain.setValueAtTime(0.1, this.uiAudioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.uiAudioContext.currentTime + 0.3);

        osc.start(this.uiAudioContext.currentTime);
        osc.stop(this.uiAudioContext.currentTime + 0.3);
    }

    /**
     * Listen for speech and return the recognized text
     * Uses Vosk if model is loaded, otherwise falls back to native or Whisper
     * @param targetWord Optional - if provided, will auto-stop when this word is recognized
     * @param language Optional - language code ('en' or 'es'), defaults to 'en'
     * @param vocabulary Optional - list of words to constrain recognition
     */
    listen(targetWord?: string, language: string = 'en', vocabulary?: string[], captureAudio: boolean = false): Observable<{ result: string; alternatives?: string[]; confidence: number; audioBlob?: Blob } | { error: string } | { status: string }> {
        // Use Vosk if model is ready and worker is running
        if (this.voskModelReady && this.voskWorker) {
            return this.listenWithVosk(targetWord, vocabulary, captureAudio);
        }

        // If model is cached but worker not ready, init worker and wait for model to load first
        if (this.voskModelCached && !this.voskModelReady) {
            // console.log('[SpeechService] Vosk cached but not ready, initializing and waiting...');

            // Start loading if not already
            if (!this.voskModelLoading && !this.voskWorker) {
                this.voskModelLoading = true;
                this.initVoskWorker();
            }
            // Send load command (after initVoskWorker may have set voskWorker)
            if (this.voskWorker && !this.voskModelReady) {
                this.voskWorker.postMessage({ type: 'load' });
            }

            // Return an Observable that waits for model to be ready, then starts listening
            return new Observable(observer => {
                let voskSub: { unsubscribe: () => void } | null = null;

                // Create a promise that resolves when model is ready
                if (!this.voskReadyPromise) {
                    this.voskReadyPromise = new Promise<void>(resolve => {
                        this.voskReadyResolve = resolve;
                    });
                }

                // If already ready (race condition check), start immediately
                if (this.voskModelReady) {
                    voskSub = this.listenWithVosk(targetWord, vocabulary, captureAudio).subscribe(observer);
                    return () => voskSub?.unsubscribe();
                }

                // Wait for ready, then start listening
                this.voskReadyPromise.then(() => {
                    // console.log('[SpeechService] Vosk now ready, starting recognition...');
                    voskSub = this.listenWithVosk(targetWord, vocabulary, captureAudio).subscribe(observer);
                }).catch(err => {
                    observer.next({ error: 'Failed to load Vosk model' });
                    observer.complete();
                });

                // Return teardown function
                return () => voskSub?.unsubscribe();
            });
        }

        // Fallback to native (primarily for desktop when Vosk not loaded)
        if (this.isNativeSupported()) {
            return this.listenWithNative(targetWord, language, captureAudio);
        }

        // Last fallback to Whisper
        if (!this.worker) {
            this.initWorker();
        }
        return this.listenWithWhisper(language, captureAudio);
    }

    preloadModel() {
        const model = 'tiny';

        if (!this.worker) {
            this.initWorker();
        } else {
            // If already initialized, trigger load again just in case (worker handles robustness)
            this.worker.postMessage({ type: 'load', modelName: model });
        }
    }

    /**
     * Listen using Vosk speech recognition
     */
    private listenWithVosk(targetWord?: string, vocabulary?: string[], captureAudio: boolean = false): Observable<{ result: string; alternatives?: string[]; confidence: number; audioBlob?: Blob } | { error: string } | { status: string }> {
        return new Observable(observer => {
            if (!this.voskWorker || !this.voskModelReady) {
                observer.next({ error: 'Vosk model not ready' });
                observer.complete();
                return;
            }

            // console.log('[SpeechService] Starting Vosk listening...', vocabulary ? `with ${vocabulary.length} vocabulary words` : '');
            this.currentProvider = 'vosk';
            let hasEmitted = false;
            let bestResult = '';

            // Store vocabulary for use in startVoskAudioCapture
            this.voskVocabulary = vocabulary;

            // Media Recorder for Debugging
            let mediaRecorder: MediaRecorder | null = null;
            let audioChunks: Blob[] = [];


            // Set up message handler for this session
            const messageHandler = (event: MessageEvent) => {
                const { type, text, alternatives, error } = event.data;

                if (type === 'started') {
                    // console.log('[SpeechService] Vosk recognizer started');
                    // Sound played before capture started to prevent feedback
                    this.ngZone.run(() => observer.next({ status: 'listening' }));
                } else if (type === 'partial') {
                    // console.log('[SpeechService] Vosk partial:', text); // limit spam
                    // Check for target word match in partial
                    // We don't get alternatives in partials usually, just text
                    if (targetWord && text && this.wordsMatch(text.toLowerCase().trim(), targetWord.toLowerCase().trim())) {
                        console.log('[SpeechService] Vosk matched target in partial!');
                        emitResult(text, [text], 1.0);
                    }
                } else if (type === 'result') {
                    console.log('[SpeechService] Vosk result:', text);
                    if (alternatives) console.log('[SpeechService] Vosk alternatives:', alternatives);

                    if (text && text.trim()) {
                        bestResult = text;
                        emitResult(text, alternatives || [text], 1.0);
                    }
                } else if (type === 'stopped') {
                    console.log('[SpeechService] Vosk stopped');
                    this.playStopSound(); // TONG
                    cleanup();
                    if (!hasEmitted) {
                        if (bestResult) {
                            // If we had a stored result but didn't emit yet (rare)
                            emitResult(bestResult, [bestResult], 1.0);
                        } else {
                            hasEmitted = true;
                            this.ngZone.run(() => {
                                observer.next({ error: 'no-speech' });
                                observer.complete();
                            });
                        }
                    }
                } else if (type === 'error') {
                    console.error('[SpeechService] Vosk error:', error);
                    cleanup();
                    if (!hasEmitted) {
                        hasEmitted = true;
                        this.ngZone.run(() => {
                            observer.next({ error: error || 'Recognition error' });
                            observer.complete();
                        });
                    }
                }
            };

            const emitResult = async (text: string, alts: string[], confidence: number) => {
                if (hasEmitted) return;
                hasEmitted = true;

                // Stop recorder and get blob
                let blob: Blob | undefined;
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    console.log('[Speech] Stopping recorder to finalize audio...');
                    const stopPromise = new Promise<void>(resolve => {
                        mediaRecorder!.onstop = () => resolve();
                    });
                    mediaRecorder.stop();
                    await stopPromise;
                    if (captureAudio && audioChunks.length > 0) {
                        blob = new Blob(audioChunks, { type: 'audio/webm' });
                        console.log('[Speech] Audio captured:', blob.size);
                    }
                } else if (captureAudio && audioChunks.length > 0) {
                    blob = new Blob(audioChunks, { type: 'audio/webm' });
                }

                this.stopVoskListening();
                this.ngZone.run(() => {
                    observer.next({ result: text.toLowerCase().trim(), alternatives: alts, confidence, audioBlob: blob });
                    observer.complete();
                });
            };

            const cleanup = () => {
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                }
                this.voskWorker?.removeEventListener('message', messageHandler);
                this.stopAudioCapture();
            };

            this.voskWorker.addEventListener('message', messageHandler);

            this.voskWorker.addEventListener('message', messageHandler);

            // Play sound BEFORE starting capture to prevent feedback loop ("c c c c")
            this.playListeningSound();

            // Wait for sound to finish (300ms) before opening mic
            setTimeout(() => {
                if (observer.closed) return; // Handle quick cancel
                this.startVoskAudioCapture().then(stream => {
                    if (captureAudio && stream) {
                        try {
                            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                            mediaRecorder.ondataavailable = (e) => {
                                if (e.data.size > 0) audioChunks.push(e.data);
                            };
                            mediaRecorder.start();
                        } catch (e) {
                            console.warn('[SpeechService] MediaRecorder failed', e);
                        }
                    }
                }).catch(err => {
                    console.error('[SpeechService] Audio capture failed:', err);
                    cleanup();
                    observer.next({ error: 'Microphone access denied' });
                    observer.complete();
                });
            }, 350);
        });
    }

    // Debug helper for E2E testing
    private debugInputStream: MediaStream | null = null;
    setDebugInputStream(stream: MediaStream | null) {
        this.debugInputStream = stream;
    }

    private async startVoskAudioCapture(): Promise<MediaStream> {
        let stream: MediaStream;

        if (this.debugInputStream) {
            // console.log('[SpeechService] Using debug input stream');
            stream = this.debugInputStream;
            this.mediaStream = stream;
        } else {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaStream = stream;
        }

        this.audioContext = new AudioContext({ sampleRate: 16000 });
        const source = this.audioContext.createMediaStreamSource(stream);

        // Tell worker to start recognizer with vocabulary if available
        this.voskWorker?.postMessage({
            type: 'start',
            sampleRate: 16000,
            vocabulary: this.voskVocabulary
        });

        // Use AudioWorklet instead of ScriptProcessor
        try {
            await this.audioContext.audioWorklet.addModule('assets/audio-processor.js');
            const workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
            this.audioWorkletNode = workletNode;

            workletNode.port.onmessage = (event) => {
                const audioData = event.data; // Float32Array from Worklet
                // Send to Vosk worker
                this.voskWorker?.postMessage({
                    type: 'audio',
                    audio: audioData,
                    sampleRate: 16000
                });
            };

            source.connect(workletNode);
            workletNode.connect(this.audioContext.destination);

        } catch (err) {
            console.error('[SpeechService] Failed to load AudioWorklet:', err);
            // Fallback to ScriptProcessor if Worklet fails (e.g. file not found)
            console.warn('[SpeechService] Falling back to ScriptProcessorNode');

            const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
            this.audioProcessor = processor;

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const audioCopy = new Float32Array(inputData);
                this.voskWorker?.postMessage({ type: 'audio', audio: audioCopy, sampleRate: 16000 });
            };

            source.connect(processor);
            processor.connect(this.audioContext.destination);
        }

        // Auto-stop after 10 seconds
        if (this.voskTimeoutId) {
            clearTimeout(this.voskTimeoutId);
        }
        this.voskTimeoutId = setTimeout(() => {
            this.stopVoskListening();
        }, 10000);

        return stream;
    }



    private stopVoskListening() {
        // Clear the timeout
        if (this.voskTimeoutId) {
            clearTimeout(this.voskTimeoutId);
            this.voskTimeoutId = null;
        }
        this.voskWorker?.postMessage({ type: 'stop' });
        this.stopAudioCapture();
    }

    private listenWithWhisper(language: string = 'en', captureAudio: boolean = false): Observable<{ result: string; alternatives?: string[]; confidence: number; audioBlob?: Blob } | { error: string } | { status: string }> {
        return new Observable(observer => {
            if (!this.worker) {
                observer.next({ error: 'Worker not initialized' });
                observer.complete();
                return;
            }

            const modelName = 'tiny';

            console.log(`[SpeechService] Starting Whisper listening (model: ${modelName})...`);
            this.currentProvider = 'whisper';
            let chunks: Float32Array[] = [];
            let isSpeaking = false;
            let silenceStart = 0;
            const SILENCE_THRESHOLD = 0.04; // Increased from 0.03
            const SILENCE_DURATION = 500; // Reduced from 600ms
            const MAX_DURATION = 5000; // 5 seconds max recording
            const startTime = Date.now();
            let processTriggered = false;

            navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                this.mediaStream = stream;

                let mediaRecorder: MediaRecorder | null = null;
                const audioChunksWebm: Blob[] = [];

                if (captureAudio) {
                    try {
                        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                        mediaRecorder.ondataavailable = (e) => {
                            if (e.data.size > 0) audioChunksWebm.push(e.data);
                        };
                        mediaRecorder.start();
                    } catch (e) {
                        console.warn('[SpeechService] Whisper MediaRecorder failed', e);
                    }
                }

                // Use default context to match mic sample rate (fixes Firefox error)
                // We will resample manually using OfflineAudioContext if needed
                this.audioContext = new AudioContext();

                const source = this.audioContext.createMediaStreamSource(stream);

                // Moved processing logic to function to be reusable across ScriptProcessor and AudioWorklet
                const handleAudioProcess = (inputData: Float32Array) => {
                    if (processTriggered) return;

                    const chunk = new Float32Array(inputData);
                    chunks.push(chunk);

                    // VAD Logic
                    let sum = 0;
                    for (let i = 0; i < chunk.length; i++) {
                        sum += chunk[i] * chunk[i];
                    }
                    const rms = Math.sqrt(sum / chunk.length);

                    if (rms > SILENCE_THRESHOLD) {
                        isSpeaking = true;
                        silenceStart = 0;
                    } else if (isSpeaking) {
                        if (silenceStart === 0) silenceStart = Date.now();
                        else if (Date.now() - silenceStart > SILENCE_DURATION) {
                            console.log('[SpeechService] Silence detected, stopping...');
                            triggerProcessing();
                        }
                    }

                    // Max duration timeout
                    if (Date.now() - startTime > MAX_DURATION) {
                        console.log('[SpeechService] Max duration reached, stopping...');
                        triggerProcessing();
                    }
                };

                // Try to use AudioWorklet
                this.audioContext.audioWorklet.addModule('assets/audio-processor.js')
                    .then(() => {
                        if (!this.audioContext) return; // Context closed meanwhile
                        const workletNode = new AudioWorkletNode(this.audioContext!, 'audio-processor');
                        this.audioWorkletNode = workletNode;

                        workletNode.port.onmessage = (event) => {
                            handleAudioProcess(event.data);
                        };

                        source.connect(workletNode);
                        workletNode.connect(this.audioContext!.destination);
                    })
                    .catch(err => {
                        console.warn('[SpeechService] AudioWorklet failed, using fallback:', err);
                        // Fallback
                        if (!this.audioContext) return;
                        const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
                        this.audioProcessor = processor;

                        processor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            handleAudioProcess(inputData);
                        };

                        source.connect(processor);
                        processor.connect(this.audioContext!.destination);
                    });

                const triggerProcessing = async () => {
                    if (processTriggered) return;
                    processTriggered = true;

                    // Concatenate chunks
                    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                    const audioRaw = new Float32Array(totalLength);
                    let offset = 0;
                    for (const chunk of chunks) {
                        audioRaw.set(chunk, offset);
                        offset += chunk.length;
                    }

                    // Resample to 16000Hz if needed
                    let finalAudio = audioRaw;
                    if (this.audioContext && this.audioContext.sampleRate !== 16000) {
                        console.log(`[SpeechService] Resampling from ${this.audioContext.sampleRate}Hz to 16000Hz...`);
                        const targetRate = 16000;
                        try {
                            const ratio = this.audioContext.sampleRate / targetRate;
                            const newLength = Math.round(audioRaw.length / ratio);
                            const offlineCtx = new OfflineAudioContext(1, newLength, targetRate);
                            const buffer = offlineCtx.createBuffer(1, audioRaw.length, this.audioContext.sampleRate);
                            buffer.copyToChannel(audioRaw, 0);

                            const source = offlineCtx.createBufferSource();
                            source.buffer = buffer;
                            source.connect(offlineCtx.destination);
                            source.start();

                            const renderedBuffer = await offlineCtx.startRendering();
                            finalAudio = renderedBuffer.getChannelData(0);
                        } catch (e) {
                            console.error('[SpeechService] Resampling failed', e);
                        }
                    }

                    // Send to worker
                    console.log(`[SpeechService] Sending ${finalAudio.length} samples to worker (lang: ${language})...`);
                    this.worker?.postMessage({ type: 'process', audio: finalAudio, modelName: modelName, language: language });

                    // Stop capturing but wait for worker result
                    this.stopAudioCapture();

                    // Notify UI that we are processing
                    this.ngZone.run(() => observer.next({ status: 'processing' }));
                };

                // Set up worker handler for this session
                const messageHandler = (event: MessageEvent) => {
                    const { type, text, error } = event.data;
                    if (type === 'result') {
                        console.log('[SpeechService] Whisper Result:', text);
                        this.ngZone.run(() => {
                            if (text) {
                                const blob = captureAudio && audioChunksWebm.length > 0 ? new Blob(audioChunksWebm, { type: 'audio/webm' }) : undefined;
                                observer.next({ result: text.trim().toLowerCase(), confidence: 1.0, audioBlob: blob });
                            } else {
                                observer.next({ error: 'no-speech' });
                            }
                            observer.complete();
                        });
                        cleanup();
                    } else if (type === 'error') {
                        this.ngZone.run(() => {
                            observer.next({ error: error });
                            observer.complete();
                        });
                        cleanup();
                    }
                };

                this.worker!.addEventListener('message', messageHandler);

                const cleanup = () => {
                    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                        mediaRecorder.stop();
                    }
                    this.stopListening();
                    this.worker?.removeEventListener('message', messageHandler);
                };

            }).catch(err => {
                console.error('[SpeechService] Mic access error:', err);
                observer.next({ error: 'Microphone access denied' });
                observer.complete();
            });
        });
    }

    private stopAudioCapture() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        if (this.audioProcessor) {
            this.audioProcessor.disconnect();
            this.audioProcessor = null;
        }
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.onmessage = null; // Remove handler
            this.audioWorkletNode.disconnect();
            this.audioWorkletNode = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    stopListening() {
        // Only play sound if we are manually stopping a provider that doesn't have its own stop event (Whisper)
        if (this.currentProvider === 'whisper') {
            this.playStopSound();
        }

        this.currentProvider = null;

        // Stop Native
        if (this.recognition) {
            try {
                this.recognition.abort();
            } catch (e) { }
        }

        // Stop Vosk if active (assuming stopVoskAudioCapture exists or generic handles it)
        // If listenWithVosk is active, its observable teardown should handle cleanup, 
        // but explicit stop ensures UI feedback matches state.

        this.stopAudioCapture();
    }

    private listenWithNative(targetWord?: string, language: string = 'en', captureAudio: boolean = false): Observable<{ result: string; alternatives?: string[]; confidence: number; audioBlob?: Blob } | { error: string } | { status: string }> {
        const subject = new Subject<{ result: string; alternatives?: string[]; confidence: number; audioBlob?: Blob } | { error: string } | { status: string }>();

        if (!this.recognition) {
            setTimeout(() => {
                subject.next({ error: 'Speech recognition not supported' });
                subject.complete();
            }, 0);
            return subject.asObservable();
        }

        // Set language for recognition
        this.currentProvider = 'native';
        const langMap: { [key: string]: string } = {
            'en': 'en-US',
            'es': 'es-US'
        };
        this.recognition.lang = langMap[language] || 'en-US';

        // Enable interim results for faster response
        this.recognition.interimResults = true;
        // ENABLE ALTERNATIVES
        this.recognition.maxAlternatives = 10;

        // Track best result in case we don't get a final
        let bestResult = '';
        let bestAlternatives: string[] = [];
        let bestConfidence = 0;
        let hasEmitted = false;

        const emitResult = async (transcript: string, alternatives: string[], confidence: number) => {
            if (hasEmitted) return;
            hasEmitted = true;

            // Stop Native Recorder if active
            if (this.nativeMediaRecorder && this.nativeMediaRecorder.state !== 'inactive') {
                const stopPromise = new Promise<void>(resolve => {
                    if (this.nativeMediaRecorder) {
                        this.nativeMediaRecorder.onstop = () => {
                            this.nativeAudioBlob = new Blob(this.nativeAudioChunks, { type: 'audio/webm' });
                            resolve();
                        };
                        this.nativeMediaRecorder.stop();
                    } else resolve();
                });
                await stopPromise;
            }

            console.log('[Speech] emitting result:', transcript, 'alternatives:', alternatives);
            subject.next({
                result: transcript.toLowerCase().trim(),
                alternatives: alternatives,
                confidence: confidence,
                audioBlob: this.nativeAudioBlob || undefined
            });
            subject.complete();

            // Stop recognition
            try {
                this.recognition.stop();
            } catch (e) { }
        };

        this.recognition.onresult = (event: any) => {
            const lastResult = event.results[event.results.length - 1];
            const transcript = lastResult[0].transcript;
            const confidence = lastResult[0].confidence || 0.5;
            const isFinal = lastResult.isFinal;

            // Collect alternatives
            const alternatives: string[] = [];
            if (lastResult.length > 0) {
                for (let i = 0; i < lastResult.length; i++) {
                    alternatives.push(lastResult[i].transcript);
                }
            }

            console.log(`[Speech] heard: "${transcript}" (final: ${isFinal}, confidence: ${confidence}) alts: ${alternatives.length}`);

            // Always store the latest result
            bestResult = transcript;
            bestAlternatives = alternatives;
            bestConfidence = confidence;

            // If we have a target word and ANY alternative matches, accept immediately
            // Pass alternatives to wordsMatch (we need to update wordsMatch next)
            // For now, iterate manually to check match
            if (targetWord && alternatives.some(alt => this.wordsMatch(alt.toLowerCase().trim(), targetWord.toLowerCase().trim()))) {
                console.log('[Speech] matched target word via alternatives!');
                emitResult(transcript, alternatives, confidence);
                return;
            }

            // Accept final results
            if (isFinal) {
                emitResult(transcript, alternatives, confidence);
            }
        };

        this.recognition.onerror = (event: any) => {
            console.log('[Speech] error:', event.error);
            if (hasEmitted) return;

            // If we have a result despite the error, use it
            if (bestResult) {
                emitResult(bestResult, bestAlternatives, bestConfidence);
            } else {
                hasEmitted = true;
                subject.next({ error: event.error });
                subject.complete();
            }
        };

        this.recognition.onnomatch = () => {
            console.log('[Speech] no match');
            if (hasEmitted) return;
            hasEmitted = true;
            subject.next({ error: 'No match' });
            subject.complete();
        };

        this.recognition.onend = async () => {
            console.log('[Speech] recognition ended');
            this.playStopSound(); // TONG

            // Should also ensure recorder is stopped if it wasn't already
            if (this.nativeMediaRecorder && this.nativeMediaRecorder.state !== 'inactive') {
                this.nativeMediaRecorder.stop();
                // We don't await here because onend is not where we usually emit success, 
                // unless bestResult is used below. 
                // Ideally we should await, but onend sync signature limits us.
                // However, emitResult is called below...
            }

            if (hasEmitted) return;

            // Use best result or emit error
            if (bestResult) {
                // emitResult is now async, so we call it
                await emitResult(bestResult, bestAlternatives, bestConfidence);
            } else {
                hasEmitted = true;
                subject.next({ error: 'no-speech' });
                subject.complete();
            }

            this.stopNativeAudioCapture();
        };

        this.recognition.onstart = () => {
            console.log('[Speech] recognition started');
            this.playListeningSound(); // TING-TING
            if (captureAudio) {
                this.startNativeAudioCapture();
            }
            subject.next({ status: 'listening' });
        };

        this.recognition.onaudiostart = () => {
            console.log('[Speech] audio capture started');
        };

        this.recognition.onspeechstart = () => {
            console.log('[Speech] speech detected!');
        };

        this.recognition.onspeechend = () => {
            console.log('[Speech] speech ended');
        };

        try {
            console.log('[Speech] starting recognition...');
            this.recognition.start();
        } catch (err: any) {
            console.error('[Speech] failed to start:', err);
            // If already started, just emit listening
            if (err.name === 'InvalidStateError' || err.message?.includes('already started')) {
                console.log('[Speech] Recognition already active, re-using session');
                setTimeout(() => subject.next({ status: 'listening' }), 0);
            } else {
                subject.next({ error: err.message || 'Failed to start recognition' });
                subject.complete();
            }
        }

        return subject.asObservable();
    }

    // Native Audio Capture State
    private nativeMediaStream: MediaStream | null = null;
    private nativeMediaRecorder: MediaRecorder | null = null;
    private nativeAudioChunks: Blob[] = [];
    private nativeAudioBlob: Blob | null = null;

    private startNativeAudioCapture() {
        if (this.nativeMediaRecorder) return;

        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            this.nativeMediaStream = stream;
            this.nativeAudioChunks = [];
            this.nativeAudioBlob = null;

            try {
                this.nativeMediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                this.nativeMediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) this.nativeAudioChunks.push(e.data);
                };
                this.nativeMediaRecorder.onstop = () => {
                    this.nativeAudioBlob = new Blob(this.nativeAudioChunks, { type: 'audio/webm' });
                    this.stopNativeAudioCapture(); // Cleanup stream
                };
                this.nativeMediaRecorder.start();
            } catch (e) {
                console.warn('[SpeechService] Native MediaRecorder failed', e);
            }
        }).catch(e => console.warn('Native audio capture failed', e));
    }

    private stopNativeAudioCapture() {
        if (this.nativeMediaRecorder && this.nativeMediaRecorder.state !== 'inactive') {
            this.nativeMediaRecorder.stop(); // will trigger onstop to save blob
        }
        // Don't kill stream immediately if recorder is still processing
        // But here we can cleanup stream tracks
        if (this.nativeMediaStream) {
            this.nativeMediaStream.getTracks().forEach(t => t.stop());
            this.nativeMediaStream = null;
        }
        this.nativeMediaRecorder = null;
    }

    /**
     * Common homophones and alternate spellings for sight words
     * Key: canonical form, Value: array of alternatives that should match
     */
    private homophones: { [key: string]: string[] } = {
        // Numbers (0-20 and tens)
        '0': ['zero', 'oh'],
        '1': ['one', 'won'],
        '2': ['two', 'to', 'too'],
        '3': ['three'],
        '4': ['four', 'for', 'fore'],
        '5': ['five'],
        '6': ['six'],
        '7': ['seven'],
        '8': ['eight', 'ate'],
        '9': ['nine'],
        '10': ['ten'],
        '11': ['eleven'],
        '12': ['twelve'],
        '13': ['thirteen'],
        '14': ['fourteen'],
        '15': ['fifteen'],
        '16': ['sixteen'],
        '17': ['seventeen'],
        '18': ['eighteen'],
        '19': ['nineteen'],
        '20': ['twenty'],
        '30': ['thirty'],
        '40': ['forty'],
        '50': ['fifty'],
        '60': ['sixty'],
        '70': ['seventy'],
        '80': ['eighty'],
        '90': ['ninety'],
        '100': ['hundred', 'one hundred'],

        // Reverse Number Mappings (Word -> Digit)
        'zero': ['0', 'oh'],
        'one': ['1', 'won'],
        'two': ['2', 'to', 'too'],
        'three': ['3'],
        'four': ['4', 'for', 'fore'],
        'five': ['5'],
        'six': ['6'],
        'seven': ['7'],
        'eight': ['8', 'ate'],
        'nine': ['9'],
        'ten': ['10'],
        'eleven': ['11'],
        'twelve': ['12'],
        'thirteen': ['13'],
        'fourteen': ['14'],
        'fifteen': ['15'],
        'sixteen': ['16'],
        'seventeen': ['17'],
        'eighteen': ['18'],
        'nineteen': ['19'],
        'twenty': ['20'],

        // Common Homophones
        'for': ['4', 'four', 'fore'],
        'to': ['2', 'two', 'too'],
        'won': ['1', 'one'],
        'be': ['b', 'bee'],
        'see': ['c', 'sea'],
        'are': ['r', 'our'],
        'you': ['u', 'ewe'],
        'why': ['y'],
        'i': ['eye', 'aye'],
        'no': ['know'],
        'know': ['no'],
        'there': ['their', 'theyre', "they're"],
        'their': ['there', 'theyre', "they're"],
        'here': ['hear'],
        'hear': ['here'],
        'his': ['is'],
        'right': ['write', 'rite'],
        'write': ['right', 'rite'],
        'ate': ['8', 'eight'],
        'by': ['bye', 'buy'],
        'buy': ['by', 'bye'],
        'would': ['wood'],
        'wood': ['would'],
        'its': ["it's", 'its'],
        'your': ["you're", 'youre', 'ur'],
        'were': ['where', 'wear'],
        'where': ['were', 'wear'],
    };

    /**
     * Check if a recognized word matches the target word
     * Uses homophone matching and fuzzy matching to account for recognition errors
     */
    wordsMatch(recognized: string | string[], target: string): boolean {
        const cleanTarget = target.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

        // Helper to check single string match
        const checkSingleMatch = (rec: string): boolean => {
            const cleanRecognized = rec.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

            // Exact match
            if (cleanRecognized === cleanTarget) return true;

            // Check if target is contained in recognized (for words like "a" that might be recognized as "a a")
            if (cleanRecognized.includes(cleanTarget)) return true;

            // Check homophones - if target has homophones, check if recognized matches any
            const targetHomophones = this.homophones[cleanTarget];
            if (targetHomophones && targetHomophones.some(h => h.toLowerCase() === cleanRecognized)) {
                return true;
            }

            // Also check the reverse - if recognized is a homophone of the target
            for (const [key, values] of Object.entries(this.homophones)) {
                if (key === cleanRecognized && values.some(v => v.toLowerCase() === cleanTarget)) {
                    return true;
                }
                if (values.includes(cleanRecognized) && (key === cleanTarget || values.includes(cleanTarget))) {
                    return true;
                }
            }

            // Calculate simple similarity for near-matches
            const similarity = this.calculateSimilarity(cleanRecognized, cleanTarget);
            if (similarity >= 0.8) return true;

            // New: Allow 1 edit distance for words >= 4 length
            // This catches "seer" vs "see" (4 chars vs 3 chars, 1 edit)
            if (cleanTarget.length >= 4) {
                const dist = this.levenshteinDistance(cleanRecognized, cleanTarget);
                if (dist <= 1) return true;
            }

            // check Phonetic Match (Double Metaphone)
            try {
                // doubleMetaphone returns [primary, secondary]
                const [tgtPri, tgtSec] = doubleMetaphone(cleanTarget);
                const [recPri, recSec] = doubleMetaphone(cleanRecognized);

                console.log(`[SpeechService] DM Check: "${cleanTarget}" [${tgtPri}, ${tgtSec}] vs "${cleanRecognized}" [${recPri}, ${recSec}]`);

                // Helper to check distance between any two codes
                const codesMatch = (c1: string, c2: string, label: string) => {
                    if (!c1 || !c2) return false;
                    // Exact code match
                    if (c1 === c2) {
                        console.log(`[SpeechService] DM MATCH (${label}): Exact match "${c1}"`);
                        return true;
                    }
                    // Fuzzy code match (Levenshtein distance <= 1)
                    // Only allow fuzzy if code length > 1
                    if (c1.length > 1 && c2.length > 1) {
                        const dist = this.levenshteinDistance(c1, c2);
                        console.log(`[SpeechService] DM Dist (${label}): "${c1}" vs "${c2}" = ${dist}`);
                        if (dist <= 1) {
                            console.log(`[SpeechService] DM MATCH (${label}): Fuzzy match (dist <= 1)`);
                            return true;
                        }
                    }
                    return false;
                };

                if (codesMatch(tgtPri, recPri, 'Pri-Pri')) return true;
                if (codesMatch(tgtPri, recSec, 'Pri-Sec')) return true;
                if (codesMatch(tgtSec, recPri, 'Sec-Pri')) return true;
                if (codesMatch(tgtSec, recSec, 'Sec-Sec')) return true;

            } catch (e) {
                console.warn('[SpeechService] Double Metaphone check failed:', e);
            }

            return false;
        };

        // Handle array of alternatives
        if (Array.isArray(recognized)) {
            return recognized.some(rec => checkSingleMatch(rec));
        }

        // Handle single string
        return checkSingleMatch(recognized);
    }

    private calculateSimilarity(str1: string, str2: string): number {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 1.0;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    private levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2[i - 1] === str1[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }
}
