
import { pipeline, env, Tensor } from '@huggingface/transformers';

// Skip local model checks since we're running in browser
env.allowLocalModels = false;
env.useBrowserCache = true;
// Force single-threaded execution for stability in Firefox
if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.numThreads = 1;
}

class TTSWorker {
    static instance: any = null;
    static processing = false;

    static async getInstance(progressCallback: any) {
        if (this.instance === null) {
            try {
                console.log('[TTSWorker] Loading pipeline...');
                this.instance = await pipeline('text-to-speech', 'Xenova/speecht5_tts', {
                    progress_callback: progressCallback,
                    device: 'wasm'
                });
                console.log('[TTSWorker] Pipeline loaded');
            } catch (err) {
                console.error('[TTSWorker] Failed to load pipeline', err);
                throw err;
            }
        }
        return this.instance;
    }

    static async getSpeakerEmbeddings(voiceId: string) {
        // Fetch embeddings for the specific speaker
        // voiceId example: 'cmu_us_slt_arctic-wav-arctic_a0001'
        const url = `https://huggingface.co/datasets/Xenova/cmu-arctic-xvectors-extracted/resolve/main/${voiceId}.bin`;
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        // Create a Tensor (1, 512)
        const float32Data = new Float32Array(buffer);
        // We explicitly create a tensor
        return new Tensor('float32', float32Data, [1, 512]);
    }
}

self.addEventListener('message', async (event) => {
    const { type, text, voiceId } = event.data;

    if (type === 'load') {
        try {
            await TTSWorker.getInstance((data: any) => {
                self.postMessage({
                    type: 'progress',
                    data
                });
            });
            self.postMessage({ type: 'ready' });
        } catch (err: any) {
            self.postMessage({ type: 'error', error: err.message });
        }
        return;
    }

    if (type === 'speak') {
        if (TTSWorker.processing) return; // Optional: reject or queue? Simple reject for now
        TTSWorker.processing = true;

        try {
            const synthesizer = await TTSWorker.getInstance(() => { });

            // 1. Fetch embeddings
            // We could cache these but fetching is fast/cached by browser
            const speaker_embeddings = await TTSWorker.getSpeakerEmbeddings(voiceId);

            // 2. Synthesize
            const result = await synthesizer(text, { speaker_embeddings });
            // result = { audio: Float32Array, sampling_rate: 16000 }

            self.postMessage({
                type: 'result',
                audio: result.audio,
                sampling_rate: result.sampling_rate
            });

        } catch (err: any) {
            self.postMessage({ type: 'error', error: err.message });
        } finally {
            TTSWorker.processing = false;
        }
    }
});
