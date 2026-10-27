/// <reference lib="webworker" />

import { pipeline, env } from '@huggingface/transformers';

// Use browser Cache API for fast subsequent loads; skip local filesystem checks in browser
env.allowLocalModels = false;
env.useBrowserCache = true;

const DEFAULT_LANGUAGE = 'en';

let whisperTranscriber: any = null;
let wav2vecTranscriber: any = null;
let currentLanguage: string = '';
let currentSessionId: number = 0;
let audioChunks: Float32Array[] = [];

/**
 * Strip non-speech tags like [BLANK_AUDIO], (static), (music), [music], etc.
 */
function cleanWhisperText(raw: string): string {
    return (raw || '')
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function cleanWav2VecText(raw: string): string {
    return (raw || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

async function loadModelsForLanguage(language: string, onProgress?: (data: any) => void) {
    const lang = (language || DEFAULT_LANGUAGE).split('-')[0].toLowerCase();
    if (whisperTranscriber && currentLanguage === lang && (lang !== 'en' || wav2vecTranscriber)) {
        return;
    }

    const whisperModelName = lang === 'en' ? 'Xenova/whisper-base.en' : 'Xenova/whisper-base';
    console.log(`[SpeechWorker] Loading models for language "${lang}" (${whisperModelName}${lang === 'en' ? ' + Xenova/wav2vec2-base-960h' : ''})...`);

    if (lang === 'en') {
        const [whisper, wav2vec] = await Promise.all([
            pipeline('automatic-speech-recognition', whisperModelName, {
                progress_callback: onProgress
            }),
            pipeline('automatic-speech-recognition', 'Xenova/wav2vec2-base-960h')
        ]);
        whisperTranscriber = whisper;
        wav2vecTranscriber = wav2vec;
    } else {
        whisperTranscriber = await pipeline('automatic-speech-recognition', whisperModelName, {
            progress_callback: onProgress
        });
        wav2vecTranscriber = null;
    }

    currentLanguage = lang;
}

self.addEventListener('message', async (event) => {
    const { type, audio, sessionId } = event.data;

    if (type === 'load') {
        try {
            const language = event.data.language || DEFAULT_LANGUAGE;

            self.postMessage({
                type: 'progress',
                data: { status: 'loading', progress: 0 }
            });

            await loadModelsForLanguage(language, (data: any) => {
                if (data && typeof data.progress === 'number') {
                    self.postMessage({
                        type: 'progress',
                        data: { status: 'loading', progress: Math.round(data.progress) }
                    });
                }
            });

            console.log('[SpeechWorker] Models loaded successfully for language:', language);
            self.postMessage({ type: 'ready', language });
        } catch (err: any) {
            console.error('[SpeechWorker] Failed to load speech models:', err);
            self.postMessage({ type: 'error', error: err.message || 'Failed to load speech recognition models' });
        }
        return;
    }

    if (type === 'start') {
        currentSessionId = sessionId;
        audioChunks = [];

        if (!whisperTranscriber) {
            self.postMessage({ type: 'error', error: 'Model not loaded', sessionId: currentSessionId });
            return;
        }

        self.postMessage({ type: 'started', sessionId: currentSessionId });
        return;
    }

    if (type === 'audio') {
        if (sessionId !== undefined && sessionId !== currentSessionId) {
            return;
        }
        if (audio && audio.length > 0) {
            audioChunks.push(new Float32Array(audio));
        }
        return;
    }

    if (type === 'stop') {
        const stopSessionId = sessionId !== undefined ? sessionId : currentSessionId;
        if (stopSessionId !== currentSessionId) {
            return;
        }

        const chunksToProcess = audioChunks;
        audioChunks = [];

        const totalLength = chunksToProcess.reduce((acc, c) => acc + c.length, 0);
        if (totalLength === 0 || !whisperTranscriber) {
            self.postMessage({ type: 'stopped', sessionId: stopSessionId });
            return;
        }

        const fullAudio = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of chunksToProcess) {
            fullAudio.set(chunk, offset);
            offset += chunk.length;
        }

        try {
            const langMap: { [key: string]: string } = {
                'en': 'english',
                'es': 'spanish',
                'ja': 'japanese'
            };
            const whisperOptions: any = {
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: false
            };
            if (currentLanguage !== 'en') {
                whisperOptions.language = langMap[currentLanguage] || 'english';
            }

            const [whisperOut, wav2vecOut] = await Promise.all([
                whisperTranscriber(fullAudio, whisperOptions),
                wav2vecTranscriber ? wav2vecTranscriber(fullAudio) : Promise.resolve(null)
            ]);

            const whisperClean = cleanWhisperText(whisperOut?.text || '');
            const wav2vecClean = wav2vecOut ? cleanWav2VecText(wav2vecOut?.text || '') : '';

            const alternatives: string[] = [];
            if (whisperClean) {
                alternatives.push(whisperClean);
            }
            if (wav2vecClean && !alternatives.includes(wav2vecClean)) {
                alternatives.push(wav2vecClean);
            }

            console.log(`[SpeechWorker] Session #${stopSessionId} transcriptions:`, {
                whisper: whisperClean,
                wav2vec2: wav2vecClean,
                alternatives
            });

            if (alternatives.length > 0) {
                self.postMessage({
                    type: 'result',
                    text: alternatives[0],
                    alternatives,
                    confidence: 1.0,
                    isFinal: true,
                    sessionId: stopSessionId
                });
            }

            self.postMessage({ type: 'stopped', sessionId: stopSessionId });
        } catch (err: any) {
            console.error('[SpeechWorker] Error during transcription:', err);
            self.postMessage({
                type: 'error',
                error: err.message || 'Transcription error',
                sessionId: stopSessionId
            });
        }
        return;
    }
});
