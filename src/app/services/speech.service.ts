import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { SettingsService } from './settings.service';

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
    private isWarmingUp = false;
    private modelLoadingSubject = new Subject<{ status: string; progress?: number }>();

    constructor(
        private settingsService: SettingsService,
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


        }
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
    speak(text: string): Promise<void> {
        return new Promise(async (resolve, reject) => {
            const settings = this.settingsService.getSettings();

            // 1. Enhanced TTS
            if (settings.enhancedTTS) {
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
            utterance.lang = 'en-US';

            // Try to find a female English voice
            const voices = this.synth.getVoices();
            const femaleVoice = voices.find(v =>
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

            if (femaleVoice) {
                utterance.voice = femaleVoice;
            }

            utterance.onend = () => resolve();
            utterance.onerror = (event) => reject(event.error);

            this.synth.speak(utterance);
        });
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
     * Listen for speech and return the recognized text
     * @param targetWord Optional - if provided, will auto-stop when this word is recognized (even in interim results)
     */
    listen(targetWord?: string): Observable<{ result: string; confidence: number } | { error: string } | { status: string }> {
        if (this.isNativeSupported()) {
            return this.listenWithNative(targetWord);
        } else {
            if (!this.worker) {
                this.initWorker();
            }
            return this.listenWithWhisper();
        }
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

    private listenWithWhisper(): Observable<{ result: string; confidence: number } | { error: string } | { status: string }> {
        return new Observable(observer => {
            if (!this.worker) {
                observer.next({ error: 'Worker not initialized' });
                observer.complete();
                return;
            }

            const modelName = 'tiny';

            console.log(`[SpeechService] Starting Whisper listening (model: ${modelName})...`);
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

                // Use default context to match mic sample rate (fixes Firefox error)
                // We will resample manually using OfflineAudioContext if needed
                this.audioContext = new AudioContext();

                const source = this.audioContext.createMediaStreamSource(stream);
                const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

                this.audioProcessor = processor;

                processor.onaudioprocess = (e) => {
                    if (processTriggered) return;

                    const inputData = e.inputBuffer.getChannelData(0);
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

                source.connect(processor);
                processor.connect(this.audioContext.destination);

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
                    console.log(`[SpeechService] Sending ${finalAudio.length} samples to worker...`);
                    this.worker?.postMessage({ type: 'process', audio: finalAudio, modelName: modelName });

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
                                observer.next({ result: text.trim().toLowerCase(), confidence: 1.0 });
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
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    stopListening() {
        // Stop Native
        if (this.recognition) {
            try {
                this.recognition.abort();
            } catch (e) { }
        }

        this.stopAudioCapture();
    }

    private listenWithNative(targetWord?: string): Observable<{ result: string; confidence: number } | { error: string }> {
        const subject = new Subject<{ result: string; confidence: number } | { error: string }>();

        if (!this.recognition) {
            setTimeout(() => {
                subject.next({ error: 'Speech recognition not supported' });
                subject.complete();
            }, 0);
            return subject.asObservable();
        }

        // Enable interim results for faster response
        this.recognition.interimResults = true;

        // Track best result in case we don't get a final
        let bestResult = '';
        let bestConfidence = 0;
        let hasEmitted = false;

        const emitResult = (transcript: string, confidence: number) => {
            if (hasEmitted) return;
            hasEmitted = true;

            console.log('[Speech] emitting result:', transcript);
            subject.next({
                result: transcript.toLowerCase().trim(),
                confidence: confidence
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

            console.log(`[Speech] heard: "${transcript}" (final: ${isFinal}, confidence: ${confidence})`);

            // Always store the latest result
            bestResult = transcript;
            bestConfidence = confidence;

            // If we have a target word and this matches, accept immediately
            if (targetWord && this.wordsMatch(transcript.toLowerCase().trim(), targetWord.toLowerCase().trim())) {
                console.log('[Speech] matched target word!');
                emitResult(transcript, confidence);
                return;
            }

            // Accept final results
            if (isFinal) {
                emitResult(transcript, confidence);
            }
        };

        this.recognition.onerror = (event: any) => {
            console.log('[Speech] error:', event.error);
            if (hasEmitted) return;

            // If we have a result despite the error, use it
            if (bestResult) {
                emitResult(bestResult, bestConfidence);
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

        this.recognition.onend = () => {
            console.log('[Speech] recognition ended');
            if (hasEmitted) return;

            // Use best result or emit error
            if (bestResult) {
                emitResult(bestResult, bestConfidence);
            } else {
                hasEmitted = true;
                subject.next({ error: 'no-speech' });
                subject.complete();
            }
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
            subject.next({ error: err.message || 'Failed to start recognition' });
            subject.complete();
        }

        return subject.asObservable();
    }

    /**
     * Common homophones and alternate spellings for sight words
     * Key: canonical form, Value: array of alternatives that should match
     */
    private homophones: { [key: string]: string[] } = {
        'for': ['4', 'four', 'fore'],
        'to': ['2', 'two', 'too'],
        'one': ['1', 'won'],
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
        'eight': ['8', 'ate'],
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
    wordsMatch(recognized: string, target: string): boolean {
        // Normalize: lowercase, remove punctuation (except apostrophes inside words maybe? no, "it's" -> "its" is better for matching), trim
        const cleanRecognized = recognized.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        const cleanTarget = target.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

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
        return similarity >= 0.8; // 80% similarity threshold
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
