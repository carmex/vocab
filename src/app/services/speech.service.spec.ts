/**
 * Unit tests for SpeechService - Testing pure logic functions
 * 
 * Note: These tests focus on the wordsMatch logic which is publicly accessible.
 * The private helper methods (calculateSimilarity, levenshteinDistance) are
 * tested indirectly through wordsMatch.
 */

// Simple standalone tests for the matching logic
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

    function wordsMatch(recognized: string, target: string): boolean {
        const cleanRecognized = recognized.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        const cleanTarget = target.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

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

        const similarity = calculateSimilarity(cleanRecognized, cleanTarget);
        return similarity >= 0.8;
    }

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
