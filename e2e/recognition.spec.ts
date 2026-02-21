import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Load manifest
const manifestPath = path.join(__dirname, '../src/assets/test-recordings/manifest.json');

type Recording = { filename: string, language: string, word: string, timestamp: string };

// Load and group recordings by language
let recordings: Recording[] = [];
try {
    const data = fs.readFileSync(manifestPath, 'utf8');
    recordings = JSON.parse(data);
} catch (e) {
    console.warn('No manifest found at ' + manifestPath + '. Run scripts/update-test-manifest.js');
}

// Group recordings by language for efficient model loading
const recordingsByLanguage = recordings.reduce((acc, rec) => {
    const lang = rec.language.split('-')[0]; // 'en-US' -> 'en'
    if (!acc[lang]) acc[lang] = [];
    acc[lang].push(rec);
    return acc;
}, {} as { [lang: string]: Recording[] });

test.describe('Audio Recognition Integration', () => {
    // If no recordings, skip
    if (recordings.length === 0) {
        test('No recordings found', () => {
            test.skip(true, 'No recordings found in manifest.json');
        });
    }

    // Create a test group for each language
    for (const [language, languageRecordings] of Object.entries(recordingsByLanguage)) {
        test.describe(`${language.toUpperCase()} Language Tests`, () => {
            // Run tests in this group serially to share model


            for (const rec of languageRecordings) {
                test(`should recognize ${rec.word} (${rec.language}) - ${rec.filename}`, async ({ page }) => {


                    test.setTimeout(90000); // Allow time for model download/load
                    page.on('console', msg => {
                        const text = msg.text();
                        if (text.includes('[SpeechService]')) {
                            console.log(`[Browser] ${text}`);
                        }
                    });
                    await page.goto('http://localhost:4200/');

                    // Allow time for app init
                    await page.waitForTimeout(1000);

                    // 2. Preload the correct Vosk model for this language, then run recognition
                    const result: { result?: string, error?: string, matches?: boolean } = await page.evaluate(async (data) => {
                        const { filename, word, language } = data;

                        // Get the exposed service
                        const service = (window as any).speechService;
                        if (!service) throw new Error('SpeechService not found on window object');

                        // Extract base language code (e.g., 'en-US' -> 'en')
                        const langCode = language.split('-')[0];

                        console.log(`[Test] Preloading Vosk model for language: ${langCode}`);

                        // Preload the correct language model
                        await new Promise<void>((resolve, reject) => {
                            const sub = service.preloadVoskModel(langCode).subscribe({
                                next: (status: any) => {
                                    console.log(`[Test] Model load status: ${JSON.stringify(status)}`);
                                    if (status.status === 'done' || status.status === 'error') {
                                        sub.unsubscribe();
                                        if (status.status === 'error') {
                                            reject(new Error('Model load failed'));
                                        } else {
                                            resolve();
                                        }
                                    }
                                },
                                error: (err: any) => reject(err)
                            });

                            // Timeout for model loading
                            setTimeout(() => {
                                sub.unsubscribe();
                                resolve(); // Proceed anyway, model might be ready
                            }, 30000);
                        });

                        console.log(`[Test] Fetching audio: /assets/test-recordings/${filename}`);

                        // Fetch audio file
                        const response = await fetch(`/assets/test-recordings/${filename}`);
                        if (!response.ok) throw new Error(`Failed to fetch audio: ${response.statusText}`);
                        const arrayBuffer = await response.arrayBuffer();

                        // Decode audio using default context first
                        const decodeCtx = new AudioContext();
                        const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
                        await decodeCtx.close();

                        // Create a 16kHz AudioContext to match SpeechService's Vosk sampleRate
                        const audioCtx = new AudioContext({ sampleRate: 16000 });

                        // Resample the buffer to 16kHz if needed
                        let resampled = audioBuffer;
                        if (audioBuffer.sampleRate !== 16000) {
                            const offlineCtx = new OfflineAudioContext(
                                1,
                                Math.ceil(audioBuffer.length * 16000 / audioBuffer.sampleRate),
                                16000
                            );
                            const offlineSource = offlineCtx.createBufferSource();
                            offlineSource.buffer = audioBuffer;
                            offlineSource.connect(offlineCtx.destination);
                            offlineSource.start();
                            resampled = await offlineCtx.startRendering();
                        }

                        // Create MediaStream from buffer
                        const dest = audioCtx.createMediaStreamDestination();
                        const source = audioCtx.createBufferSource();
                        source.buffer = resampled;
                        source.connect(dest);

                        // Loop the audio so Vosk has time to process (single word audio is very short)
                        source.loop = true;

                        // Set as debug stream
                        service.setDebugInputStream(dest.stream);

                        // Force Vosk usage by simulating cached model (triggers loading)
                        (service as any).voskModelCached = true;

                        return new Promise<{ result?: string, error?: string, matches?: boolean }>((resolve) => {
                            // Start playing audio "microphone"
                            source.start();

                            const sub = service.listen(word, language).subscribe({
                                next: (res: any) => {
                                    if (res.result) {
                                        sub.unsubscribe();
                                        // Use the REAL SpeechService wordsMatch method with Double Metaphone
                                        // This is the exact same logic used in the real app
                                        const recognized = res.result;
                                        const alternatives = res.alternatives || [recognized];
                                        const matches = service.wordsMatch(alternatives, word);
                                        console.log(`[Test] wordsMatch("${alternatives.join(', ')}", "${word}") = ${matches}`);
                                        resolve({ result: recognized, matches });
                                    }
                                    if (res.error) {
                                        sub.unsubscribe();
                                        resolve({ error: res.error });
                                    }
                                },
                                error: (err: any) => {
                                    resolve({ error: String(err) });
                                }
                            });

                            // Failsafe timeout - increased for buffered audio processing
                            setTimeout(() => {
                                sub.unsubscribe();
                                resolve({ error: 'Timeout waiting for recognition' });
                            }, 30000);
                        });

                    }, { filename: rec.filename, word: rec.word, language: rec.language });

                    console.log(`Test result for ${rec.word}:`, result);

                    if (result.error) {
                        throw new Error(`Recognition failed: ${JSON.stringify(result.error)}`);
                    }

                    // Assert that we got a result
                    expect(result.result).toBeTruthy();

                    // Assert that SpeechService's wordsMatch (with Double Metaphone) matched
                    // This uses the exact same logic as the real app
                    console.log(`wordsMatch result: ${result.matches}`);
                    expect(result.matches).toBe(true);
                });
            }
        });
    }
});
