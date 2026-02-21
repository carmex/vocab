import { TestBed } from '@angular/core/testing';
import { SpeechService } from './speech.service';
import { SettingsService } from './settings.service';
import { SupabaseService } from './supabase.service';

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

            const result = await (service as any).forceRegenerateAudio('cat', 'en');

            expect(mockFunctionsInvoke).toHaveBeenCalledWith('generate-audio', {
                body: { word: 'cat', language: 'en', force: true }
            });
            expect(result).toBe('blob:test');
        });
    });
});
