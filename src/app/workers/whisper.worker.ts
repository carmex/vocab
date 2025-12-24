
import { pipeline, env } from '@huggingface/transformers';

// Skip local model checks since we're running in browser
env.allowLocalModels = false;
env.useBrowserCache = true;

class WhisperWorker {
    static instance: any = null;
    static processing = false;
    static currentModelName: string | null = null;

    static async getInstance(progressCallback: any, modelName: string = 'tiny') {
        // Use multilingual model instead of English-only
        const fullModelName = `Xenova/whisper-${modelName}`;

        if (this.instance === null || this.currentModelName !== fullModelName) {
            try {
                this.currentModelName = fullModelName;
                console.log(`[WhisperWorker] Loading pipeline (model: ${fullModelName})...`);
                this.instance = await pipeline('automatic-speech-recognition', fullModelName, {
                    progress_callback: progressCallback
                });
                console.log('[WhisperWorker] Pipeline loaded');
            } catch (err) {
                console.error('[WhisperWorker] Failed to load pipeline', err);
                throw err;
            }
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event) => {
    const { type, audio, modelName, language } = event.data;

    if (type === 'load') {
        try {
            await WhisperWorker.getInstance((data: any) => {
                // Send loading progress back to main thread
                self.postMessage({
                    type: 'progress',
                    data
                });
            }, modelName);
            self.postMessage({ type: 'ready' });
        } catch (err: any) {
            self.postMessage({ type: 'error', error: err.message });
        }
        return;
    }

    if (type === 'process') {
        if (WhisperWorker.processing) return;
        WhisperWorker.processing = true;

        try {
            // Re-get instance just in case (e.g. if we want to ensure loaded)
            // But we assume 'load' was called or we default to tiny
            const transcriber = await WhisperWorker.getInstance(() => { }, modelName);

            // Map language codes to Whisper language codes
            const langMap: { [key: string]: string } = {
                'en': 'english',
                'es': 'spanish'
            };
            const whisperLang = langMap[language] || 'english';

            const output = await transcriber(audio, {
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: false,
                language: whisperLang
            });

            self.postMessage({
                type: 'result',
                text: output.text
            });

        } catch (err: any) {
            self.postMessage({ type: 'error', error: err.message });
        } finally {
            WhisperWorker.processing = false;
        }
    }
});

