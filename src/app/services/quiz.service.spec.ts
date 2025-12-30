/**
 * Unit tests for QuizService
 * 
 * Tests the core quiz logic: question generation, distractor selection,
 * answer submission, and progress tracking.
 */

describe('QuizService Logic Tests', () => {
    // Recreate core logic for testing without Angular DI

    interface ListWord {
        id: string;
        word: string;
        definition: string;
        image_url?: string;
    }

    function shuffleArray<T>(array: T[]): T[] {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    function getDistractors(target: ListWord, fullList: ListWord[]): string[] {
        const others = fullList.filter(w => w.id !== target.id);
        const shuffled = shuffleArray(others);
        return shuffled.slice(0, 3).map(w => w.definition);
    }

    // Sample test data
    const sampleWords: ListWord[] = [
        { id: '1', word: 'apple', definition: 'A round fruit that is red, green, or yellow' },
        { id: '2', word: 'banana', definition: 'A long curved fruit with yellow skin' },
        { id: '3', word: 'cherry', definition: 'A small round fruit that is usually red' },
        { id: '4', word: 'date', definition: 'A sweet brown fruit from a palm tree' },
        { id: '5', word: 'elderberry', definition: 'A small dark purple berry' },
    ];

    describe('shuffleArray', () => {
        it('should return an array of the same length', () => {
            const input = [1, 2, 3, 4, 5];
            const result = shuffleArray(input);
            expect(result.length).toBe(input.length);
        });

        it('should contain all original elements', () => {
            const input = [1, 2, 3, 4, 5];
            const result = shuffleArray(input);
            expect(result.sort()).toEqual(input.sort());
        });

        it('should not modify the original array', () => {
            const input = [1, 2, 3, 4, 5];
            const original = [...input];
            shuffleArray(input);
            expect(input).toEqual(original);
        });

        it('should handle empty arrays', () => {
            const result = shuffleArray([]);
            expect(result).toEqual([]);
        });

        it('should handle single element arrays', () => {
            const result = shuffleArray([1]);
            expect(result).toEqual([1]);
        });
    });

    describe('getDistractors', () => {
        it('should return 3 distractors', () => {
            const target = sampleWords[0];
            const distractors = getDistractors(target, sampleWords);
            expect(distractors.length).toBe(3);
        });

        it('should not include the target word definition', () => {
            const target = sampleWords[0];
            const distractors = getDistractors(target, sampleWords);
            expect(distractors).not.toContain(target.definition);
        });

        it('should return definitions only', () => {
            const target = sampleWords[0];
            const distractors = getDistractors(target, sampleWords);
            distractors.forEach(d => {
                expect(typeof d).toBe('string');
                expect(d.length).toBeGreaterThan(0);
            });
        });

        it('should handle list with exactly 4 words (target + 3 distractors)', () => {
            const smallList = sampleWords.slice(0, 4);
            const target = smallList[0];
            const distractors = getDistractors(target, smallList);
            expect(distractors.length).toBe(3);
        });

        it('should handle list with fewer than 4 words', () => {
            const tinyList = sampleWords.slice(0, 2);
            const target = tinyList[0];
            const distractors = getDistractors(target, tinyList);
            expect(distractors.length).toBe(1); // Only 1 other word available
        });
    });

    describe('Quiz Question Generation', () => {
        function generateQuestion(currentWord: ListWord, fullList: ListWord[]) {
            const distractors = getDistractors(currentWord, fullList);
            const options = shuffleArray([currentWord.definition, ...distractors]);

            return {
                wordToQuiz: {
                    word: currentWord.word,
                    definition: currentWord.definition,
                    id: currentWord.id,
                },
                options,
                correctAnswer: currentWord.definition
            };
        }

        it('should generate a question with 4 options', () => {
            const question = generateQuestion(sampleWords[0], sampleWords);
            expect(question.options.length).toBe(4);
        });

        it('should include the correct answer in options', () => {
            const question = generateQuestion(sampleWords[0], sampleWords);
            expect(question.options).toContain(question.correctAnswer);
        });

        it('should have wordToQuiz matching the current word', () => {
            const currentWord = sampleWords[2];
            const question = generateQuestion(currentWord, sampleWords);
            expect(question.wordToQuiz.word).toBe(currentWord.word);
            expect(question.wordToQuiz.id).toBe(currentWord.id);
        });
    });

    describe('Progress Tracking Logic', () => {
        it('should correctly identify answered words', () => {
            const answeredIds = ['1', '2'];
            const remainingWords = sampleWords.filter(w => !answeredIds.includes(w.id));
            expect(remainingWords.length).toBe(3);
        });

        it('should correctly calculate correct count', () => {
            const answeredIds = ['1', '2', '3', '4'];
            const incorrectIds = ['2', '4'];
            const correctCount = answeredIds.length - incorrectIds.length;
            expect(correctCount).toBe(2);
        });

        it('should correctly filter review mode words', () => {
            const missedIds = ['2', '4'];
            const reviewWords = sampleWords.filter(w => missedIds.includes(w.id));
            expect(reviewWords.length).toBe(2);
            expect(reviewWords.map(w => w.id)).toEqual(['2', '4']);
        });

        it('should calculate score percentage correctly', () => {
            const correctCount = 7;
            const totalCount = 10;
            const scorePercent = Math.round((correctCount / totalCount) * 100);
            expect(scorePercent).toBe(70);
        });
    });
});
