import { TestBed } from '@angular/core/testing';
import { SpeechService } from './speech.service';
import { SettingsService } from './settings.service';
import { SupabaseService } from './supabase.service';
import { wordsToNumber } from '../utils/number-words.util';

/**
 * Unit tests for SpeechService - Testing pure logic functions
 * 
 * Note: These tests focus on the wordsMatch logic which is publicly accessible.
 * The private helper methods (calculateSimilarity, levenshteinDistance) are
 * tested indirectly through wordsMatch.
 */

// Simple standalone tests for the matching logic (Legacy tests preserved)
describe('SpeechService wordsMatch logic', () => {
    // Recreate the core matching logic for testing without Angular DI
    const homophones: { [key: string]: string[] } = {
        'to': ['too', 'two'],
        'too': ['to', 'two'],
        'two': ['to', 'too'],
        'there': ['their', "they're"],
        'their': ['there', "they're"],
        "they're": ['there', 'their'],
        'here': ['hear'],
        'hear': ['here'],
        'for': ['four', 'fore'],
        'four': ['for', 'fore'],
        'bye': ['by', 'buy'],
        'by': ['bye', 'buy'],
        'buy': ['bye', 'by'],
        'right': ['write', 'rite'],
        'write': ['right', 'rite'],
        'no': ['know'],
        'know': ['no'],
        'sea': ['see'],
        'see': ['sea'],
        'i': ['eye'],
        'eye': ['i'],
        'one': ['won'],
        'won': ['one'],
        'be': ['bee'],
        'bee': ['be'],
    };

    function levenshteinDistance(str1: string, str2: string): number {
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
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[str2.length][str1.length];
    }

    function calculateSimilarity(str1: string, str2: string): number {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        if (longer.length === 0) return 1.0;
        const editDistance = levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    function wordsMatch(recognized: string | string[], target: string): boolean {
        // Use a regex that preserves letters (including Hiragana) and numbers, stripping only punctuation
        const cleanTarget = target.toLowerCase().replace(/[.,!?;:()"\u3001\u3002\uff01\uff1f]/g, '').trim();

        const checkSingleMatch = (rec: string): boolean => {
            const cleanRecognized = rec.toLowerCase().replace(/[.,!?;:()"\u3001\u3002\uff01\uff1f]/g, '').trim();

            if (!cleanRecognized || !cleanTarget) {
                // If either is empty after cleaning, only match if both were already very short
                // This prevents "" matching "" erroneously for unsupported char sets
                return rec.trim() === target.trim();
            }

            if (cleanRecognized === cleanTarget) return true;

            const targetNum = wordsToNumber(cleanTarget);
            const recNum = wordsToNumber(cleanRecognized);
            if (targetNum !== null && recNum !== null) {
                return targetNum === recNum;
            }

            if (cleanRecognized.includes(cleanTarget)) return true;

            const targetHomophones = homophones[cleanTarget];
            if (targetHomophones && targetHomophones.some(h => h.toLowerCase() === cleanRecognized)) {
                return true;
            }

            for (const [key, values] of Object.entries(homophones)) {
                if (key === cleanRecognized && values.some(v => v.toLowerCase() === cleanTarget)) {
                    return true;
                }
                if (values.includes(cleanRecognized) && (key === cleanTarget || values.includes(cleanTarget))) {
                    return true;
                }
            }

            // Calculate simple similarity for near-matches
            const similarity = calculateSimilarity(cleanRecognized, cleanTarget);
            if (similarity >= 0.8) return true;

            // Updated logic to match service
            if (cleanTarget.length >= 4) {
                const dist = levenshteinDistance(cleanRecognized, cleanTarget);
                if (dist <= 1) return true;
            }
            return false;
        };

        if (Array.isArray(recognized)) {
            return recognized.some(rec => checkSingleMatch(rec));
        }

        return checkSingleMatch(recognized);
    }

    describe('N-Best Alternatives matching', () => {
        it('should match if ANY alternative is correct', () => {
            expect(wordsMatch(['ah', 'uh', 'at'], 'at')).toBe(true);
        });

        it('should match if ANY alternative is a homophone', () => {
            expect(wordsMatch(['too', 'tue', 'foo'], 'two')).toBe(true);
        });

        it('should match if ANY alternative is similar enough', () => {
            expect(wordsMatch(['hello', 'hallow', 'yellow'], 'hallo')).toBe(true);
        });

        it('should fail if NO alternative matches', () => {
            expect(wordsMatch(['cat', 'bat', 'hat'], 'dog')).toBe(false);
        });
    });

    describe('Exact matching', () => {
        it('should match identical words', () => {
            expect(wordsMatch('hello', 'hello')).toBe(true);
        });

        it('should match words case-insensitively', () => {
            expect(wordsMatch('Hello', 'hello')).toBe(true);
            expect(wordsMatch('HELLO', 'hello')).toBe(true);
        });

        it('should match words with different punctuation', () => {
            expect(wordsMatch('hello!', 'hello')).toBe(true);
            expect(wordsMatch('hello,', 'hello')).toBe(true);
        });
    });

    describe('Homophone matching', () => {
        it('should match "to", "too", "two"', () => {
            expect(wordsMatch('to', 'too')).toBe(true);
            expect(wordsMatch('two', 'to')).toBe(true);
            expect(wordsMatch('too', 'two')).toBe(true);
        });

        it('should match "there", "their", "they\'re"', () => {
            expect(wordsMatch('there', 'their')).toBe(true);
            expect(wordsMatch('their', 'there')).toBe(true);
        });

        it('should match "see" and "sea"', () => {
            expect(wordsMatch('see', 'sea')).toBe(true);
            expect(wordsMatch('sea', 'see')).toBe(true);
        });

        it('should match "i" and "eye"', () => {
            expect(wordsMatch('i', 'eye')).toBe(true);
            expect(wordsMatch('eye', 'i')).toBe(true);
        });
    });

    describe('Similarity matching', () => {
        it('should match similar words within 80% threshold', () => {
            // "hello" vs "helo" - 1 char diff in 5 chars = 80% similar
            expect(wordsMatch('hello', 'helo')).toBe(true);
        });

        it('should not match completely different words', () => {
            expect(wordsMatch('apple', 'orange')).toBe(false);
            expect(wordsMatch('cat', 'dog')).toBe(false);
        });
    });

    describe('Japanese (Hiragana) matching', () => {
        it('should match Hiragana characters exactly', () => {
            expect(wordsMatch('あ', 'あ')).toBe(true);
            expect(wordsMatch('い', 'い')).toBe(true);
        });

        it('should match Hiragana with punctuation', () => {
            expect(wordsMatch('あ！', 'あ')).toBe(true);
            expect(wordsMatch('う、', 'う')).toBe(true);
        });

        it('should match multiple Hiragana characters', () => {
            expect(wordsMatch('あいう', 'あいう')).toBe(true);
        });

        it('should fail if Hiragana characters do not match', () => {
            expect(wordsMatch('あ', 'い')).toBe(false);
        });
    });

    describe('Refined Matching (Length >= 4)', () => {
        it('should match words with <= 1 edit distance if length >= 4', () => {
            expect(wordsMatch('see', 'seer')).toBe(true); // 4 chars target, 1 edit
            expect(wordsMatch('fast', 'past')).toBe(true); // 4 chars, 1 edit
            expect(wordsMatch('sleep', 'seep')).toBe(true); // 4 chars target, 1 edit
        });

        it('should NOT match words with 1 edit distance if length < 4', () => {
            expect(wordsMatch('cat', 'bat')).toBe(false); // 3 chars, 1 edit - too risky
            expect(wordsMatch('see', 'bee')).toBe(false); // 3 chars
            expect(wordsMatch('dog', 'log')).toBe(false); // 3 chars
        });
    });

    describe('Levenshtein distance', () => {
        it('should return 0 for identical strings', () => {
            expect(levenshteinDistance('hello', 'hello')).toBe(0);
        });

        it('should return correct distance for one substitution', () => {
            expect(levenshteinDistance('hello', 'hallo')).toBe(1);
        });

        it('should return correct distance for one insertion', () => {
            expect(levenshteinDistance('hello', 'helloo')).toBe(1);
        });

        it('should return correct distance for one deletion', () => {
            expect(levenshteinDistance('hello', 'helo')).toBe(1);
        });

        it('should return string length for empty comparisons', () => {
            expect(levenshteinDistance('hello', '')).toBe(5);
            expect(levenshteinDistance('', 'hello')).toBe(5);
        });
    });

    describe('Calculate similarity', () => {
        it('should return 1 for identical strings', () => {
            expect(calculateSimilarity('hello', 'hello')).toBe(1);
        });

        it('should return 0 for completely different strings of same length', () => {
            expect(calculateSimilarity('abc', 'xyz')).toBe(0);
        });

        it('should return value between 0 and 1 for similar strings', () => {
            const similarity = calculateSimilarity('hello', 'hallo');
            expect(similarity).toBeGreaterThan(0);
            expect(similarity).toBeLessThan(1);
        });
    });
});

describe('SpeechService (Angular)', () => {
    let service: SpeechService;
    let mockSupabaseService: any;
    let mockSettingsService: any;
    let mockFunctionsInvoke: any;
    let mockStorageFrom: any;
    let mockGetPublicUrl: any;

    beforeEach(() => {
        mockFunctionsInvoke = jest.fn();
        mockGetPublicUrl = jest.fn();
        mockStorageFrom = jest.fn().mockReturnValue({ getPublicUrl: mockGetPublicUrl });

        mockSupabaseService = {
            client: {
                functions: { invoke: mockFunctionsInvoke },
                storage: { from: mockStorageFrom }
            }
        };

        mockSettingsService = {
            getSettings: jest.fn().mockReturnValue({ usePremiumVoice: false, enhancedTTS: false })
        };

        TestBed.configureTestingModule({
            providers: [
                SpeechService,
                { provide: SupabaseService, useValue: mockSupabaseService },
                { provide: SettingsService, useValue: mockSettingsService }
            ]
        });

        service = TestBed.inject(SpeechService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('forceRegenerateAudio', () => {
        it('should call generate-audio edge function and return new url', async () => {
            // Mock successful edge function response
            mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null });

            // Mock successful public URL generation
            const mockUrl = 'https://example.com/audio/en-cat.wav?t=123';
            mockGetPublicUrl.mockReturnValue({ data: { publicUrl: mockUrl } });

            // Mock fetch (global)
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                blob: () => Promise.resolve(new Blob(['fake-audio'], { type: 'audio/wav' }))
            });

            // Mock URL.createObjectURL (global)
            global.URL.createObjectURL = jest.fn().mockReturnValue('blob:test');

            if (!global.crypto) {
                global.crypto = {} as any;
            }
            if (!global.crypto.subtle) {
                (global.crypto as any).subtle = {
                    digest: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer)
                };
            }

            const result = await (service as any).forceRegenerateAudio('cat', 'en');

            expect(mockFunctionsInvoke).toHaveBeenCalledWith('generate-audio', {
                body: { word: 'cat', language: 'en', force: true }
            });
            expect(result).toBe('blob:test');
        });
    });

    describe('initVoskWorker and preloadVoskModel', () => {
        let originalWorker: any;

        beforeEach(() => {
            originalWorker = (global as any).Worker;
        });

        afterEach(() => {
            (global as any).Worker = originalWorker;
        });

        it('should initialize Vosk worker without throwing Invalid base URL', () => {
            const mockPostMessage = jest.fn();
            const mockWorkerInstance = {
                postMessage: mockPostMessage,
                onmessage: null as any
            };
            const mockWorkerConstructor = jest.fn().mockImplementation((url: URL) => {
                expect(url).toBeDefined();
                return mockWorkerInstance;
            });
            (global as any).Worker = mockWorkerConstructor;

            expect(() => {
                (service as any).initVoskWorker();
            }).not.toThrow();

            expect(mockWorkerConstructor).toHaveBeenCalled();
        });
    });

    describe('initWorker, preloadModel, and initTTSWorker error handling', () => {
        let originalWorker: any;

        beforeEach(() => {
            originalWorker = (global as any).Worker;
        });

        afterEach(() => {
            (global as any).Worker = originalWorker;
        });

        it('should handle URL or Worker constructor errors in initWorker without throwing', () => {
            (global as any).Worker = jest.fn().mockImplementation(() => {
                throw new TypeError('URL constructor:  is not a valid URL.');
            });

            expect(() => {
                (service as any).initWorker();
            }).not.toThrow();
        });

        it('should handle errors in preloadModel without throwing', () => {
            (global as any).Worker = jest.fn().mockImplementation(() => {
                throw new TypeError('URL constructor:  is not a valid URL.');
            });

            expect(() => {
                service.preloadModel();
            }).not.toThrow();
        });

        it('should handle URL or Worker constructor errors in initTTSWorker without throwing', () => {
            (global as any).Worker = jest.fn().mockImplementation(() => {
                throw new TypeError('URL constructor:  is not a valid URL.');
            });

            expect(() => {
                (service as any).initTTSWorker();
            }).not.toThrow();
        });
    });

    describe('wordsMatch with spoken numbers', () => {
        it('should match spoken "twenty five" to target "25"', () => {
            expect(service.wordsMatch('twenty five', '25')).toBe(true);
        });

        it('should match hyphenated "twenty-five" to target "25"', () => {
            expect(service.wordsMatch('twenty-five', '25')).toBe(true);
        });

        it('should match array of alternatives containing "twenty five" to target "25"', () => {
            expect(service.wordsMatch(['twenty five', 'twenty-five'], '25')).toBe(true);
        });

        it('should match target "twenty five" when recognized is "25"', () => {
            expect(service.wordsMatch('25', 'twenty five')).toBe(true);
        });

        it('should match large compound numbers like "one hundred forty four" to "144"', () => {
            expect(service.wordsMatch('one hundred forty four', '144')).toBe(true);
            expect(service.wordsMatch('one hundred and forty four', '144')).toBe(true);
        });

        it('should match negative numbers like "negative five" and "minus five" to "-5"', () => {
            expect(service.wordsMatch('negative five', '-5')).toBe(true);
            expect(service.wordsMatch('minus five', '-5')).toBe(true);
        });

        it('should reject incorrect spoken numbers', () => {
            expect(service.wordsMatch('twenty four', '25')).toBe(false);
            expect(service.wordsMatch('twenty five', '5')).toBe(false);
            expect(service.wordsMatch('5', '25')).toBe(false);
        });
    });

    describe('wordsMatch with sentences', () => {
        it('should match exact sentence ignoring punctuation and case', () => {
            expect(service.wordsMatch('she will relax', 'She will relax.')).toBe(true);
        });

        it('should match sentence when Vosk splits a word or produces phonetic equivalents', () => {
            expect(service.wordsMatch('she were very lax', 'She will relax.')).toBe(true);
            expect(service.wordsMatch('she will re lax', 'She will relax.')).toBe(true);
            expect(service.wordsMatch('she well relax', 'She will relax.')).toBe(true);
        });

        it('should match sentence even when recognition contains repeated 3x transcript', () => {
            expect(
                service.wordsMatch(
                    'she were very lax she were very lax she well well lack',
                    'She will relax.'
                )
            ).toBe(true);
        });

        it('should match sentence containing word-level homophones', () => {
            expect(service.wordsMatch('eye sea too cats', 'I see two cats.')).toBe(true);
        });

        it('should match real child sentence recordings with minor function-word drops or substitutions', () => {
            expect(service.wordsMatch("i'll see the robot", 'I see the robot.')).toBe(true);
            expect(service.wordsMatch('listen to that music', 'Listen to the music.')).toBe(true);
            expect(service.wordsMatch('listen do the music', 'Listen to the music.')).toBe(true);
            expect(service.wordsMatch('do you see tiger', 'Do you see the tiger?')).toBe(true);
            expect(service.wordsMatch('has a donut', 'He has a donut.')).toBe(true);
            expect(service.wordsMatch('he was a donut', 'He has a donut.')).toBe(true);
            expect(service.wordsMatch('love rabbit is funny', 'The rabbit is funny.')).toBe(true);
            expect(service.wordsMatch('rabbit is funny', 'The rabbit is funny.')).toBe(true);
            expect(service.wordsMatch('love grass is fresh', 'The grass is fresh.')).toBe(true);
            expect(service.wordsMatch('grass is fresh', 'The grass is fresh.')).toBe(true);
        });

        it('should reject sentences with different meaning or wrong words', () => {
            expect(service.wordsMatch('he will relax', 'She will relax.')).toBe(false);
            expect(service.wordsMatch('she will jump', 'She will relax.')).toBe(false);
            expect(service.wordsMatch('she were very sad', 'She will relax.')).toBe(false);
            expect(service.wordsMatch('the dog ran fast', 'She will relax.')).toBe(false);
            expect(service.wordsMatch('the rabbit is sad', 'The rabbit is funny.')).toBe(false);
            expect(service.wordsMatch('i see the tiger', 'I see the robot.')).toBe(false);
            expect(service.wordsMatch('he has a muffin', 'He has a donut.')).toBe(false);
            expect(service.wordsMatch('the grass is green', 'The grass is fresh.')).toBe(false);
            expect(service.wordsMatch('my dog was frozen', 'My muffin was frozen.')).toBe(false);
            expect(service.wordsMatch('the cat is funny', 'The rabbit is funny.')).toBe(false);
            expect(service.wordsMatch('the water is fresh', 'The grass is fresh.')).toBe(false);
            expect(service.wordsMatch('do you like the tiger', 'Do you see the tiger?')).toBe(false);
            // Spliced wrong-word outputs from Whisper + Wav2Vec2
            expect(service.wordsMatch(['my bundle was frozen', 'my bundle white frerygan'], 'My muffin was frozen.')).toBe(false);
            expect(service.wordsMatch(['she will bundle', 'se wel bundle'], 'She will relax.')).toBe(false);
            expect(service.wordsMatch(['my battle was frozen', 'my batle whas frozen'], 'My muffin was frozen.')).toBe(false);
            expect(service.wordsMatch(['she will battle', 'se you round batle'], 'She will relax.')).toBe(false);
            expect(service.wordsMatch(['my mama was frozen', 'my comical whas frozin'], 'My muffin was frozen.')).toBe(false);
            expect(service.wordsMatch(['she will', 'se you welcomical'], 'She will relax.')).toBe(false);
        });

        it('should not falsely match single-letter or short sight words as substrings of unrelated words', () => {
            expect(service.wordsMatch('banana', 'a')).toBe(false);
            expect(service.wordsMatch('cat', 'a')).toBe(false);
            expect(service.wordsMatch('static', 'at')).toBe(false);
            expect(service.wordsMatch('winter', 'in')).toBe(false);
            expect(service.wordsMatch('im in for it usually', 'in')).toBe(false);
            // Repeated single words should still match
            expect(service.wordsMatch('a a', 'a')).toBe(true);
            expect(service.wordsMatch('comfortable comfortable', 'comfortable')).toBe(true);
            expect(service.wordsMatch('aunt aunt', 'aunt')).toBe(true);
            expect(service.wordsMatch(['im a cool', 'amical'], 'comical')).toBe(true);
        });

        it('should match all 18 real Supabase sentence recordings (Whisper + Wav2Vec2 outputs) and reject all 162 cross-sentence pairs', () => {
            const allSentences = [
                'Do you see the tiger?',
                'He has a donut.',
                'He will open it.',
                'I see the robot.',
                'Listen to the music.',
                'My muffin was frozen.',
                'She will relax.',
                'The grass is fresh.',
                'The rabbit is funny.',
                'We love music.'
            ];

            // Real Whisper-base.en + Wav2Vec2-base-960h outputs from the 18 user recordings
            const realRecordings: { file: string; target: string; alternatives: string[] }[] = [
                {
                    file: 'en-US-Do you see the tiger',
                    target: 'Do you see the tiger?',
                    alternatives: ['do you see that tiger?', 'do you se that diker']
                },
                {
                    file: 'en-US-He has a donut.-2026-10-27T00-00-58-878Z.webm',
                    target: 'He has a donut.',
                    alternatives: ['he has a donut!', 'has a donat u']
                },
                {
                    file: 'en-US-He has a donut.-2026-10-27T00-08-54-335Z.webm',
                    target: 'He has a donut.',
                    alternatives: ['he has a donut.', 'he has a donat']
                },
                {
                    file: 'en-US-He will open it.-2026-10-26T23-59-33-460Z.webm',
                    target: 'He will open it.',
                    alternatives: ['he will open it.', 'he wil open it']
                },
                {
                    file: 'en-US-He will open it.-2026-10-27T00-09-51-081Z.webm',
                    target: 'He will open it.',
                    alternatives: ['be well-open it.', 'we wil open ect']
                },
                {
                    file: 'en-US-I see the robot.-2026-10-27T00-01-28-485Z.webm',
                    target: 'I see the robot.',
                    alternatives: ['i see the robot.', 'i she dont no bat']
                },
                {
                    file: 'en-US-I see the robot.-2026-10-27T00-06-58-922Z.webm',
                    target: 'I see the robot.',
                    alternatives: ['i see the robot.', 'i se the roit']
                },
                {
                    file: 'en-US-Listen to the music.-2026-10-27T00-00-41-557Z.webm',
                    target: 'Listen to the music.',
                    alternatives: ['listen to the music.', 'liten to tha music']
                },
                {
                    file: 'en-US-Listen to the music.-2026-10-27T00-08-19-304Z.webm',
                    target: 'Listen to the music.',
                    alternatives: ['listen to the music!', 'lisen to them music']
                },
                {
                    file: 'en-US-My muffin was frozen.-2026-10-26T23-59-51-930Z.webm',
                    target: 'My muffin was frozen.',
                    alternatives: ['my mother was frozen', 'my mufen was frozin']
                },
                {
                    file: 'en-US-My muffin was frozen.-2026-10-27T00-04-55-439Z.webm',
                    target: 'My muffin was frozen.',
                    alternatives: ['my muffin was frozen.', 'my mufin wods froze in']
                },
                {
                    file: 'en-US-She will relax.-2026-10-27T00-04-30-914Z.webm',
                    target: 'She will relax.',
                    alternatives: ['she will relax.', 'she wil relax']
                },
                {
                    file: 'en-US-The grass is fresh.-2026-10-27T00-01-06-683Z.webm',
                    target: 'The grass is fresh.',
                    alternatives: ['the grass is fresh.', 'the gras is fresh']
                },
                {
                    file: 'en-US-The grass is fresh.-2026-10-27T00-06-42-054Z.webm',
                    target: 'The grass is fresh.',
                    alternatives: ['the grass is fresh.', 'the gras is rash']
                },
                {
                    file: 'en-US-The rabbit is funny.-2026-10-26T23-59-43-172Z.webm',
                    target: 'The rabbit is funny.',
                    alternatives: ['the rabbit is funny.', 'the rabit gis funy']
                },
                {
                    file: 'en-US-The rabbit is funny.-2026-10-27T00-09-10-261Z.webm',
                    target: 'The rabbit is funny.',
                    alternatives: ['the rabbit is funny.', 'ba a rabit egtrine']
                },
                {
                    file: 'en-US-We love music.-2026-10-27T00-00-50-715Z.webm',
                    target: 'We love music.',
                    alternatives: ['we love music.', 'we love music']
                },
                {
                    file: 'en-US-We love music.-2026-10-27T00-06-17-423Z.webm',
                    target: 'We love music.',
                    alternatives: ['we love music.', 'we love usic']
                }
            ];

            for (const rec of realRecordings) {
                expect({ file: rec.file, target: rec.target, matched: service.wordsMatch(rec.alternatives, rec.target) })
                    .toEqual({ file: rec.file, target: rec.target, matched: true });
                for (const otherSentence of allSentences) {
                    if (otherSentence !== rec.target) {
                        expect({ file: rec.file, otherSentence, matched: service.wordsMatch(rec.alternatives, otherSentence) })
                            .toEqual({ file: rec.file, otherSentence, matched: false });
                    }
                }
            }
        });
    });

    describe('listenWithVosk intermediate result accumulation', () => {
        let workerMessageHandler: ((event: any) => void) | null;

        beforeEach(() => {
            workerMessageHandler = null;
            (service as any).voskWorker = {
                postMessage: jest.fn(),
                addEventListener: jest.fn((type: string, handler: any) => {
                    if (type === 'message') workerMessageHandler = handler;
                }),
                removeEventListener: jest.fn()
            };
            (service as any).voskModelReady = true;
            jest.spyOn(service as any, 'playListeningSound').mockImplementation(() => {});
            jest.spyOn(service as any, 'playStopSound').mockImplementation(() => {});
            jest.spyOn(service as any, 'startVoskAudioCapture').mockResolvedValue(null as any);
            jest.spyOn(service as any, 'stopAudioCapture').mockImplementation(() => {});
        });

        it('should wait for final result when an intermediate result arrives while isVoskProcessing is true and does not match targetWord', () => {
            const emitted: any[] = [];
            (service as any).isVoskProcessing = true;

            (service as any).listenWithVosk('I see the robot.', undefined, false).subscribe((val: any) => {
                emitted.push(val);
            });

            expect(workerMessageHandler).toBeDefined();
            const sessionId = (service as any).voskSessionId;

            // Intermediate result (first half of sentence before pause) arrives while chunks are still streaming (isVoskProcessing = true)
            workerMessageHandler!({
                data: {
                    type: 'result',
                    text: 'i see',
                    alternatives: ['i see'],
                    isFinal: false,
                    sessionId
                }
            });

            // Should NOT have emitted final result yet because isVoskProcessing is true and it didn't match
            expect(emitted.filter(e => 'result' in e).length).toBe(0);

            // Final result arrives from stop handler with full sentence alternatives
            (service as any).isVoskProcessing = false;
            workerMessageHandler!({
                data: {
                    type: 'result',
                    text: 'i see the robot',
                    alternatives: ['i see', 'i see the robot'],
                    isFinal: true,
                    sessionId
                }
            });

            const finalEmissions = emitted.filter(e => 'result' in e);
            expect(finalEmissions.length).toBe(1);
            expect(finalEmissions[0].alternatives).toContain('i see the robot');
            expect(finalEmissions[0].alternatives).toContain('i see');
        });
    });

    describe('Vosk audio capture for sentences vs single words', () => {
        let mockAudioMessages: any[];
        let workletMessageHandler: ((event: any) => void) | null;
        let originalAudioContext: any;
        let originalAudioWorkletNode: any;
        let originalMediaDevices: any;

        beforeEach(() => {
            mockAudioMessages = [];
            workletMessageHandler = null;
            originalAudioContext = (window as any).AudioContext;
            originalAudioWorkletNode = (window as any).AudioWorkletNode;
            originalMediaDevices = navigator.mediaDevices;

            (service as any).voskWorker = {
                postMessage: jest.fn((msg: any) => {
                    if (msg.type === 'audio') {
                        mockAudioMessages.push(msg);
                    }
                }),
                addEventListener: jest.fn(),
                removeEventListener: jest.fn()
            };
            (service as any).voskModelReady = true;

            (window as any).AudioContext = jest.fn().mockImplementation(() => ({
                sampleRate: 16000,
                state: 'running',
                currentTime: 0,
                destination: {},
                createMediaStreamSource: jest.fn().mockReturnValue({ connect: jest.fn() }),
                createOscillator: jest.fn().mockReturnValue({
                    connect: jest.fn(),
                    frequency: { setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
                    start: jest.fn(),
                    stop: jest.fn()
                }),
                createGain: jest.fn().mockReturnValue({
                    connect: jest.fn(),
                    gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() }
                }),
                audioWorklet: {
                    addModule: jest.fn().mockResolvedValue(undefined)
                },
                close: jest.fn()
            }));

            (window as any).AudioWorkletNode = jest.fn().mockImplementation(() => ({
                port: {
                    set onmessage(fn: any) {
                        workletMessageHandler = fn;
                    },
                    get onmessage() {
                        return workletMessageHandler;
                    }
                },
                connect: jest.fn(),
                disconnect: jest.fn()
            }));

            Object.defineProperty(navigator, 'mediaDevices', {
                value: {
                    getUserMedia: jest.fn().mockResolvedValue({
                        getTracks: () => [{ stop: jest.fn() }]
                    })
                },
                configurable: true
            });
        });

        afterEach(() => {
            (window as any).AudioContext = originalAudioContext;
            (window as any).AudioWorkletNode = originalAudioWorkletNode;
            Object.defineProperty(navigator, 'mediaDevices', {
                value: originalMediaDevices,
                configurable: true
            });
            jest.useRealTimers();
        });

        it('should NOT repeat buffered audio 3x when target is a multi-word sentence', async () => {
            jest.useFakeTimers();

            await (service as any).startVoskAudioCapture(undefined, 'She will relax.');
            expect(workletMessageHandler).toBeDefined();

            // Send 1 chunk of speech (4000 samples)
            const speechChunk = new Float32Array(4000).fill(0.1);
            workletMessageHandler!({ data: speechChunk });

            // Send silence chunks after > 600ms to trigger processing
            const silenceChunk = new Float32Array(4000).fill(0);
            jest.advanceTimersByTime(100);
            workletMessageHandler!({ data: silenceChunk });
            jest.advanceTimersByTime(700);
            workletMessageHandler!({ data: silenceChunk });

            // Advance timers to flush all chunks to voskWorker
            jest.advanceTimersByTime(5000);

            const totalSentSamples = mockAudioMessages.reduce((acc, m) => acc + m.audio.length, 0);
            // 3 chunks of 4000 = 12000 samples.
            // With 1x repetition + 2 * 8000 silence padding = 28000 samples.
            // (If repeated 3x, it would be 3 * 12000 + 16000 = 52000 samples).
            expect(totalSentSamples).toBe(28000);
        });

        it('should NOT cut off real microphone recording at 2000ms while user is still speaking', async () => {
            jest.useFakeTimers();

            await (service as any).startVoskAudioCapture(undefined, 'She will relax.');
            expect(workletMessageHandler).toBeDefined();

            const speechChunk = new Float32Array(4000).fill(0.1);
            // User starts speaking at t=1500ms and continues past t=2500ms
            jest.advanceTimersByTime(1500);
            workletMessageHandler!({ data: speechChunk });
            jest.advanceTimersByTime(1000); // t=2500ms (elapsed > 2000ms, still speaking)
            workletMessageHandler!({ data: speechChunk });

            // Should NOT have started streaming to Vosk yet because user is still speaking!
            expect((service as any).isVoskProcessing).toBe(false);
        });
    });
});


