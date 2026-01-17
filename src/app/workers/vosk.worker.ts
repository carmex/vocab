/// <reference lib="webworker" />

// Vosk model URLs by language - using hosted tar.gz archives
// English: Hosted on ccoreilly's GitHub Pages CDN
// Spanish: Self-hosted in app assets (download from alphacephei.com, convert zip to tar.gz)
const MODEL_URLS: { [key: string]: string } = {
    'en': 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz',
    // Spanish model hosted alongside the app - place in src/assets/models/
    'es': '/assets/models/vosk-model-small-es-0.42.tar.gz'
};

// Default to English if language not specified
const DEFAULT_LANGUAGE = 'en';

let model: any = null;
let recognizer: any = null;
let lastResult: string = ''; // Track last received result
let currentLanguage: string = DEFAULT_LANGUAGE; // Track loaded language

self.addEventListener('message', async (event) => {
    const { type, audio, sampleRate } = event.data;

    if (type === 'load') {
        try {
            // Get language from message, default to 'en'
            const language = event.data.language || DEFAULT_LANGUAGE;
            const modelUrl = MODEL_URLS[language] || MODEL_URLS[DEFAULT_LANGUAGE];

            console.log('[VoskWorker] Loading model for language:', language, 'from:', modelUrl);

            // If already loaded same language, skip
            if (model && currentLanguage === language) {
                console.log('[VoskWorker] Model already loaded for language:', language);
                self.postMessage({ type: 'ready', language });
                return;
            }

            // Import Vosk dynamically - handle both ESM patterns
            const VoskModule = await import('vosk-browser');
            // vosk-browser might export createModel as default or named
            const createModel = VoskModule.createModel || VoskModule.default?.createModel || (VoskModule as any).default;

            if (!createModel) {
                console.error('[VoskWorker] Could not find createModel. Module keys:', Object.keys(VoskModule));
                throw new Error('createModel function not found in vosk-browser module');
            }

            // Create model - vosk-browser handles progress internally
            self.postMessage({
                type: 'progress',
                data: { status: 'loading', progress: 0 }
            });

            model = await createModel(modelUrl);
            currentLanguage = language;

            console.log('[VoskWorker] Model loaded successfully for language:', language);
            self.postMessage({ type: 'ready', language });
        } catch (err: any) {
            console.error('[VoskWorker] Failed to load model:', err);
            self.postMessage({ type: 'error', error: err.message || 'Failed to load Vosk model' });
        }
        return;
    }

    if (type === 'start') {
        if (!model) {
            self.postMessage({ type: 'error', error: 'Model not loaded' });
            return;
        }

        try {
            // Reset last result
            lastResult = '';

            // Create recognizer with sample rate (default 16000)
            const rate = sampleRate || 16000;

            // Get vocabulary list if provided for grammar constraints
            const vocabulary = event.data.vocabulary;

            if (vocabulary && vocabulary.length > 0) {
                // Create grammar string - Vosk expects JSON array format
                const grammarJson = JSON.stringify(vocabulary);
                console.log('[VoskWorker] Using grammar:', grammarJson);
                recognizer = new model.KaldiRecognizer(rate, grammarJson);
            } else {
                recognizer = new model.KaldiRecognizer(rate);
            }

            // Request N-best alternatives
            // Check if setMaxAlternatives exists (defensive check)
            if (recognizer && typeof recognizer.setMaxAlternatives === 'function') {
                try {
                    recognizer.setMaxAlternatives(10);
                } catch (e) {
                    console.warn('[VoskWorker] Error setting max alternatives:', e);
                }
            }

            // Listen for results
            recognizer.on('result', (message: any) => {
                const result = message.result;
                // Check for alternatives array first
                if (result && result.alternatives) {
                    const alts = result.alternatives.map((a: any) => a.text).filter((t: string) => !!t);
                    if (alts.length > 0) {
                        lastResult = alts[0]; // Store best for backup
                        self.postMessage({
                            type: 'result',
                            text: alts[0], // Keep best text for compat
                            alternatives: alts,
                            confidence: result.alternatives[0]?.confidence || 1.0
                        });
                        return;
                    }
                }

                // Fallback to single result
                if (result && result.text) {
                    lastResult = result.text; // Store for later
                    self.postMessage({
                        type: 'result',
                        text: result.text,
                        alternatives: [result.text],
                        confidence: 1.0
                    });
                }
            });

            recognizer.on('partialresult', (message: any) => {
                const partial = message.result;
                if (partial && partial.partial) {
                    // console.log('[VoskWorker] Partial:', partial.partial); // limit spam
                    lastResult = partial.partial; // Also track partials
                    self.postMessage({
                        type: 'partial',
                        text: partial.partial
                    });
                }
            });

            self.postMessage({ type: 'started' });
        } catch (err: any) {
            console.error('[VoskWorker] Failed to start recognizer:', err);
            self.postMessage({ type: 'error', error: err.message });
        }
        return;
    }

    if (type === 'audio') {
        if (!recognizer) {
            return;
        }

        try {
            // Vosk expects an AudioBuffer-like object with getChannelData method
            // Create a mock AudioBuffer from the Float32Array
            const audioBuffer = {
                sampleRate: sampleRate || 16000,
                length: audio.length,
                numberOfChannels: 1,
                duration: audio.length / (sampleRate || 16000),
                getChannelData: (channel: number) => audio
            };
            recognizer.acceptWaveform(audioBuffer);
        } catch (err: any) {
            console.error('[VoskWorker] Audio processing error:', err);
        }
        return;
    }

    if (type === 'stop') {
        if (recognizer) {
            // Give Vosk time to process any remaining audio buffers
            // This delay is critical for short utterances
            setTimeout(() => {
                if (!recognizer) return;

                try {
                    // Get final result
                    let finalResult: any;
                    try {
                        if (typeof recognizer.retrieveFinalResult === 'function') {
                            finalResult = recognizer.retrieveFinalResult();
                        } else if (typeof recognizer.finalResult === 'function') {
                            finalResult = recognizer.finalResult();
                        } else if (typeof recognizer.getFinalResult === 'function') {
                            finalResult = recognizer.getFinalResult();
                        }
                    } catch (e) {
                        console.warn('[VoskWorker] Could not retrieve final result:', e);
                    }

                    const finalText = finalResult?.text || '';

                    // Use finalText if available, otherwise use lastResult from events
                    const textToSend = finalText || lastResult;
                    if (textToSend) {
                        self.postMessage({
                            type: 'result',
                            text: textToSend,
                            alternatives: finalResult?.alternatives?.map((a: any) => a.text) || [textToSend],
                            confidence: 1.0
                        });
                    }

                    // Clean up recognizer
                    recognizer.remove();
                    recognizer = null;
                    lastResult = '';
                } catch (err: any) {
                    console.error('[VoskWorker] Stop error:', err);
                    self.postMessage({ type: 'error', error: err.message });
                }

                self.postMessage({ type: 'stopped' });
            }, 500); // Wait 500ms for Vosk to finish processing
        } else {
            self.postMessage({ type: 'stopped' });
        }
        return;
    }
});
