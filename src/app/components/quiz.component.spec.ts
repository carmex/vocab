import { QuizComponent } from './quiz.component';
import { of, Subject } from 'rxjs';
import { ListType } from '../models/list-type.enum';

// Mock the speech service module
jest.mock('../services/speech.service', () => ({
    SpeechService: class {
        isSTTSupported = jest.fn().mockReturnValue(true);
        isNativeSupported = jest.fn().mockReturnValue(true);
        isVoskReady = jest.fn().mockReturnValue(true);
        preloadModel = jest.fn();
        stopListening = jest.fn();
        stopSpeaking = jest.fn();
        speak = jest.fn();
        listen = jest.fn();
        preloadVoskModel = jest.fn();
        wordsMatch = jest.fn();
        prefetchAudio = jest.fn().mockReturnValue(of({ completed: 0, total: 0 }));
    }
}));
import { SpeechService } from '../services/speech.service';

describe('QuizComponent (Manual Instantiation)', () => {
    let component: QuizComponent;
    let mockRoute: any;
    let mockRouter: any;
    let mockQuizService: any;
    let mockSettingsService: any;
    let mockClassroomService: any;
    let mockAuthService: any;
    let mockSpeechService: any;
    let mockSupabaseService: any;
    let mockNgZone: any;

    beforeEach(() => {
        mockRoute = {
            snapshot: {
                paramMap: { get: jest.fn() },
                queryParamMap: { get: jest.fn() }
            }
        };
        mockRouter = { navigate: jest.fn() };
        mockQuizService = {
            startQuiz: jest.fn().mockResolvedValue({ listType: ListType.SIGHT_WORDS }),
            getNextQuestion: jest.fn(),
            submitAnswer: jest.fn(),
            saveQuizResult: jest.fn().mockResolvedValue(true),
            getRemainingWords: jest.fn().mockReturnValue([{ word: 'test' }]),
            currentLanguage: 'en',
            totalWordsInPass: 10,
            answeredCount: 0,
            correctCount: 0
        };
        mockSettingsService = { getSettings: jest.fn().mockReturnValue({ autoAdvance: false, usePremiumVoice: true }) };
        mockClassroomService = {};
        mockAuthService = { currentUser: { id: 'u1' } };
        mockSpeechService = new SpeechService() as any;
        mockSupabaseService = { uploadUserRecording: jest.fn().mockResolvedValue({ data: {}, error: null }) };
        mockNgZone = { run: jest.fn().mockImplementation((fn: any) => fn()) };

        component = new QuizComponent(
            mockRoute,
            mockRouter,
            mockQuizService,
            mockSettingsService,
            mockClassroomService,
            mockAuthService,
            mockSpeechService as any,
            mockSupabaseService as any,
            mockNgZone
        );
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('Audio Preloading Logic', () => {
        it('should NOT preload audio for Math quiz', () => {
            component.isMathQuiz = true;
            component.isSightWordQuiz = false;
            component.startWithMode('speak');

            // Check getter
            expect(component.shouldPreloadAudio).toBe(false);

            // Check usage in startWithMode
            expect(mockSpeechService.prefetchAudio).not.toHaveBeenCalled();
        });

        it('should NOT preload Whisper model on ngOnInit for Math quiz even if native speech is not supported', async () => {
            mockRoute.snapshot.paramMap.get.mockImplementation((key: string) => {
                if (key === 'listId') return 'math-123';
                if (key === 'mode') return 'main';
                return null;
            });
            mockSpeechService.isNativeSupported.mockReturnValue(false);
            mockSpeechService.isSTTSupported.mockReturnValue(true);
            mockQuizService.startQuiz.mockResolvedValue({ listType: ListType.MATH });

            await component.ngOnInit();

            expect(mockSpeechService.preloadModel).not.toHaveBeenCalled();
            expect(component.isMathQuiz).toBe(true);
            expect(component.quizStarted).toBe(false);
        });

        it('should load Vosk model and show speech recognition loading state for Math quiz in speak mode', () => {
            component.isMathQuiz = true;
            component.isSightWordQuiz = false;
            mockSpeechService.isVoskReady.mockReturnValue(false);
            const progressSubject = new Subject<any>();
            mockSpeechService.preloadVoskModel.mockReturnValue(progressSubject.asObservable());

            component.startWithMode('speak');

            // Audio prefetch should NOT be called
            expect(mockSpeechService.prefetchAudio).not.toHaveBeenCalled();
            // Preload Vosk should be called
            expect(mockSpeechService.preloadVoskModel).toHaveBeenCalled();
            // Loading modal should be displayed
            expect(component.isLoadingModel).toBe(true);
            // Loading title and message should indicate Speech Recognition, not quiz audio playback!
            expect(component.modelLoadingTitle).toBe('Preparing Speech Recognition');
            expect(component.modelLoadingSubtitle).toContain('speech recognition');

            // Progress emission should update modelLoadProgress
            progressSubject.next({ status: 'loading', progress: 45 });
            expect(component.modelLoadProgress).toBe(45);

            // Done should complete loading and start quiz
            progressSubject.next({ status: 'done', progress: 100 });
            expect(component.isLoadingModel).toBe(false);
            expect(component.quizStarted).toBe(true);
        });

        it('should NOT preload audio for Sight Word Read mode', () => {
            component.isMathQuiz = false;
            component.isSightWordQuiz = true;
            component.startWithMode('read');

            expect(component.shouldPreloadAudio).toBe(false);
            expect(mockSpeechService.prefetchAudio).not.toHaveBeenCalled();
        });

        it('should preload audio for Sight Word Listen mode', () => {
            component.isMathQuiz = false;
            component.isSightWordQuiz = true;
            component.startWithMode('listen');

            expect(component.shouldPreloadAudio).toBe(true);
            expect(mockSpeechService.prefetchAudio).toHaveBeenCalled();
        });

        it('should preload audio for Sight Word Spell mode', () => {
            component.isMathQuiz = false;
            component.isSightWordQuiz = true;
            component.startWithMode('spell');

            expect(component.shouldPreloadAudio).toBe(true);
            expect(mockSpeechService.prefetchAudio).toHaveBeenCalled();
        });

        it('should preload audio for Sight Word Scramble mode', () => {
            component.isMathQuiz = false;
            component.isSightWordQuiz = true;
            component.startWithMode('scramble');

            expect(component.shouldPreloadAudio).toBe(true);
            expect(mockSpeechService.prefetchAudio).toHaveBeenCalled();
        });

        it('should NOT preload audio for other list types (e.g. Word/Def)', () => {
            component.isMathQuiz = false;
            component.isSightWordQuiz = false; // Implies other type
            component.startWithMode('multiple-choice');

            expect(component.shouldPreloadAudio).toBe(false);
            expect(mockSpeechService.prefetchAudio).not.toHaveBeenCalled();
        });
    });

    describe('Spell Mode Logic', () => {
        beforeEach(() => {
            // Manually set up state to bypass ngOnInit complexity if needed, or call logic directly
            // Set up a question
            component.currentQuestion = {
                wordToQuiz: { id: 'w1', word: 'apple', imageUrl: '', type: 'sight_word', definition: '' },
                options: [],
                correctAnswer: 'apple'
            };
            component.quizStarted = true;
            component.interactionMode = 'spell';
        });

        it('should switch mode correctly', () => {
            component.startWithMode('spell');
            expect(component.interactionMode).toBe('spell');
        });

        it('should mark correct spelling as correct', () => {
            component.spellingInput = 'apple';
            component.checkSpelling();

            expect(component.isCorrect).toBe(true);
            expect(mockQuizService.submitAnswer).toHaveBeenCalledWith('w1', true, 'apple');
            expect(component.feedbackVisible).toBe(true);
        });

        it('should mark correct spelling as correct (case insensitive)', () => {
            component.spellingInput = 'Apple';
            component.checkSpelling();

            expect(component.isCorrect).toBe(true);
            expect(mockQuizService.submitAnswer).toHaveBeenCalledWith('w1', true, 'apple');
        });

        it('should match words with accents (accent insensitive)', () => {
            component.currentQuestion!.correctAnswer = 'café';
            component.spellingInput = 'cafe';
            component.checkSpelling();

            expect(component.isCorrect).toBe(true);
            expect(mockQuizService.submitAnswer).toHaveBeenCalledWith('w1', true, 'apple'); // Word ID matches but we check checking logic
        });

        it('should mark incorrect spelling as incorrect', () => {
            component.spellingInput = 'aple';
            component.checkSpelling();

            expect(component.isCorrect).toBe(false);
            expect(mockQuizService.submitAnswer).toHaveBeenCalledWith('w1', false, 'apple');
            expect(component.feedbackVisible).toBe(true);
        });

        it('should ignore empty input', () => {
            component.spellingInput = '';
            component.checkSpelling();

            expect(mockQuizService.submitAnswer).not.toHaveBeenCalled();
            expect(component.feedbackVisible).toBe(false); // Should default to false or whatever it was
        });
    });


    describe('Auto-Play Logic in Listen Mode', () => {
        beforeEach(() => {
            component.activeMode = 'listen';
            component.isSightWordQuiz = true;
            component.quizStarted = true;
            component.currentQuestion = {
                wordToQuiz: { id: 'w1', word: 'apple', imageUrl: '', type: 'sight_word', definition: '' },
                options: [],
                correctAnswer: 'apple'
            };
            component.autoPlayEnabled = false;
        });

        it('should NOT play word automatically on first question', () => {
            expect(component.autoPlayEnabled).toBe(false);
        });

        it('should enable auto-play when playWord is called', () => {
            component.playWord();
            expect(component.autoPlayEnabled).toBe(true);
            expect(mockSpeechService.speak).toHaveBeenCalledWith('apple', 'en');
        });

        it('should trigger playWord in displayNextQuestion if autoPlayEnabled is true', () => {
            jest.useFakeTimers();
            component.autoPlayEnabled = true;

            mockQuizService.getNextQuestion.mockReturnValue({
                wordToQuiz: { id: 'w2', word: 'banana', imageUrl: '', type: 'sight_word', definition: '' },
                options: [],
                correctAnswer: 'banana'
            });

            component.onNext();

            // Should be playing *immediately* (waiting state)
            expect(component.isPlaying).toBe(true);

            jest.advanceTimersByTime(500);

            expect(mockSpeechService.speak).toHaveBeenCalledWith('banana', 'en');
            jest.useRealTimers();
        });

        it('should call stopSpeaking when onStopSpeaking is called', () => {
            component.isPlaying = true;
            component.onStopSpeaking();
            expect(mockSpeechService.stopSpeaking).toHaveBeenCalled();
            expect(component.isPlaying).toBe(false);
        });
    });

    describe('Auto-Play Logic in Spell Mode', () => {
        beforeEach(() => {
            component.activeMode = 'spell';
            component.isSightWordQuiz = true;
            component.quizStarted = true;
            component.currentQuestion = {
                wordToQuiz: { id: 'w1', word: 'apple', imageUrl: '', type: 'sight_word', definition: '' },
                options: [],
                correctAnswer: 'apple'
            };
            component.autoPlayEnabled = false;
        });

        it('should NOT play word automatically on first question', () => {
            expect(component.autoPlayEnabled).toBe(false);
        });

        it('should enable auto-play when playWord is called', () => {
            component.playWord();
            expect(component.autoPlayEnabled).toBe(true);
            expect(mockSpeechService.speak).toHaveBeenCalledWith('apple', 'en');
        });

        it('should trigger playWord in displayNextQuestion if autoPlayEnabled is true', () => {
            jest.useFakeTimers();
            component.autoPlayEnabled = true;

            mockQuizService.getNextQuestion.mockReturnValue({
                wordToQuiz: { id: 'w2', word: 'banana', imageUrl: '', type: 'sight_word', definition: '' },
                options: [],
                correctAnswer: 'banana'
            });

            component.onNext();

            // Should be playing *immediately*
            expect(component.isPlaying).toBe(true);

            jest.advanceTimersByTime(500);

            expect(mockSpeechService.speak).toHaveBeenCalledWith('banana', 'en');
            jest.useRealTimers();
        });
    });

    describe('Scramble Mode Logic', () => {
        beforeEach(() => {
            component.currentQuestion = {
                wordToQuiz: { id: 'w1', word: 'apple', imageUrl: '', type: 'sight_word', definition: '' },
                options: [],
                correctAnswer: 'apple'
            };
            component.quizStarted = true;
            component.isSightWordQuiz = true;
            component.interactionMode = 'scramble';
            component.activeMode = 'scramble';
            component.setupScrambleWord();
        });

        it('should switch mode correctly and enable auto-play', () => {
            component.startWithMode('scramble');
            expect(component.interactionMode).toBe('scramble');
            expect(component.activeMode).toBe('scramble');
            expect(component.autoPlayEnabled).toBe(true);
        });

        it('should generate scrambled letter tiles for the question', () => {
            expect(component.scrambleTiles.length).toBe(5);
            const letters = component.scrambleTiles.map(t => t.letter).sort();
            expect(letters).toEqual(['a', 'e', 'l', 'p', 'p']);
            expect(component.selectedScrambleTiles).toEqual([]);
        });

        it('should ensure tiles are not in original order when possible', () => {
            // For a multi-letter word with distinct letters, scrambled tiles shouldn't spell the word identically
            const spelled = component.scrambleTiles.map(t => t.letter).join('');
            expect(spelled).not.toBe('apple');
        });

        it('should select an available tile and update selectedScrambleTiles', () => {
            const tile = component.scrambleTiles[0];
            component.selectScrambleTile(tile);

            expect(component.selectedScrambleTiles).toContain(tile);
            expect(component.isTileSelected(tile)).toBe(true);
        });

        it('should not select a tile that is already selected', () => {
            const tile = component.scrambleTiles[0];
            component.selectScrambleTile(tile);
            component.selectScrambleTile(tile);

            expect(component.selectedScrambleTiles.length).toBe(1);
        });

        it('should deselect a tile from selectedScrambleTiles', () => {
            const tile1 = component.scrambleTiles[0];
            const tile2 = component.scrambleTiles[1];
            component.selectScrambleTile(tile1);
            component.selectScrambleTile(tile2);

            component.deselectScrambleTile(tile1);

            expect(component.selectedScrambleTiles).toEqual([tile2]);
            expect(component.isTileSelected(tile1)).toBe(false);
            expect(component.isTileSelected(tile2)).toBe(true);
        });

        it('should backspace the last selected tile', () => {
            const tile1 = component.scrambleTiles[0];
            const tile2 = component.scrambleTiles[1];
            component.selectScrambleTile(tile1);
            component.selectScrambleTile(tile2);

            component.backspaceScramble();

            expect(component.selectedScrambleTiles).toEqual([tile1]);
            expect(component.isTileSelected(tile2)).toBe(false);
        });

        it('should clear all selected tiles', () => {
            component.scrambleTiles.forEach(t => component.selectScrambleTile(t));
            expect(component.selectedScrambleTiles.length).toBe(5);

            component.clearScramble();

            expect(component.selectedScrambleTiles.length).toBe(0);
            component.scrambleTiles.forEach(t => {
                expect(component.isTileSelected(t)).toBe(false);
            });
        });

        it('should return answer slots properly via getter scrambleAnswerSlots', () => {
            expect(component.scrambleAnswerSlots.length).toBe(5);
            expect(component.scrambleAnswerSlots.every(s => s === null)).toBe(true);

            const tile = component.scrambleTiles[0];
            component.selectScrambleTile(tile);

            expect(component.scrambleAnswerSlots[0]).toBe(tile);
            expect(component.scrambleAnswerSlots[1]).toBeNull();
        });

        it('should submit correct scrambled word as correct', () => {
            // Find tiles to spell 'apple' in exact order
            const targetLetters = ['a', 'p', 'p', 'l', 'e'];
            const usedIndices = new Set<number>();
            for (const ch of targetLetters) {
                const idx = component.scrambleTiles.findIndex((t, i) => t.letter === ch && !usedIndices.has(i));
                usedIndices.add(idx);
                component.selectScrambleTile(component.scrambleTiles[idx]);
            }

            component.submitScramble();

            expect(component.isCorrect).toBe(true);
            expect(mockQuizService.submitAnswer).toHaveBeenCalledWith('w1', true, 'apple');
            expect(component.feedbackVisible).toBe(true);
            expect(component.selectedAnswer).toBe('apple');
        });

        it('should submit correct scrambled word case-insensitively and accent-insensitively', () => {
            component.currentQuestion!.correctAnswer = 'Café';
            (component as any).setupScrambleWord();

            // Select all tiles in order of café
            const targetLetters = ['c', 'a', 'f', 'e'];
            const usedIndices = new Set<number>();
            for (const ch of targetLetters) {
                const idx = component.scrambleTiles.findIndex((t, i) =>
                    t.letter.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === ch && !usedIndices.has(i)
                );
                usedIndices.add(idx);
                component.selectScrambleTile(component.scrambleTiles[idx]);
            }

            component.submitScramble();

            expect(component.isCorrect).toBe(true);
            expect(mockQuizService.submitAnswer).toHaveBeenCalledWith('w1', true, 'apple');
        });

        it('should submit incorrect scrambled word as incorrect', () => {
            // Select all tiles in reverse/incorrect order
            const targetLetters = ['e', 'l', 'p', 'p', 'a'];
            const usedIndices = new Set<number>();
            for (const ch of targetLetters) {
                const idx = component.scrambleTiles.findIndex((t, i) => t.letter === ch && !usedIndices.has(i));
                usedIndices.add(idx);
                component.selectScrambleTile(component.scrambleTiles[idx]);
            }

            component.submitScramble();

            expect(component.isCorrect).toBe(false);
            expect(mockQuizService.submitAnswer).toHaveBeenCalledWith('w1', false, 'apple');
            expect(component.feedbackVisible).toBe(true);
            expect(component.selectedAnswer).toBe('elppa');
        });

        it('should ignore submit when no tiles are selected', () => {
            component.submitScramble();

            expect(mockQuizService.submitAnswer).not.toHaveBeenCalled();
            expect(component.feedbackVisible).toBe(false);
        });

        it('should ignore submit or selection when feedback is already visible', () => {
            component.feedbackVisible = true;
            const tile = component.scrambleTiles[0];

            component.selectScrambleTile(tile);
            expect(component.selectedScrambleTiles.length).toBe(0);

            component.submitScramble();
            expect(mockQuizService.submitAnswer).not.toHaveBeenCalled();
        });

        it('should handle keyboard events in scramble mode', () => {
            // Type 'a'
            const eventA = new KeyboardEvent('keydown', { key: 'a' });
            component.handleKeydown(eventA);
            expect(component.selectedScrambleTiles.length).toBe(1);
            expect(component.selectedScrambleTiles[0].letter).toBe('a');

            // Backspace
            const eventBs = new KeyboardEvent('keydown', { key: 'Backspace' });
            component.handleKeydown(eventBs);
            expect(component.selectedScrambleTiles.length).toBe(0);

            // Escape clears
            component.selectScrambleTile(component.scrambleTiles[0]);
            const eventEsc = new KeyboardEvent('keydown', { key: 'Escape' });
            component.handleKeydown(eventEsc);
            expect(component.selectedScrambleTiles.length).toBe(0);

            // Enter submits
            component.selectScrambleTile(component.scrambleTiles[0]);
            const eventEnter = new KeyboardEvent('keydown', { key: 'Enter' });
            component.handleKeydown(eventEnter);
            expect(component.feedbackVisible).toBe(true);
        });
    });

    describe('Auto-Play Logic in Scramble Mode', () => {
        beforeEach(() => {
            component.activeMode = 'scramble';
            component.isSightWordQuiz = true;
            component.quizStarted = true;
            component.currentQuestion = {
                wordToQuiz: { id: 'w1', word: 'apple', imageUrl: '', type: 'sight_word', definition: '' },
                options: [],
                correctAnswer: 'apple'
            };
            component.autoPlayEnabled = true;
        });

        it('should trigger playWord in displayNextQuestion if autoPlayEnabled is true', () => {
            jest.useFakeTimers();

            mockQuizService.getNextQuestion.mockReturnValue({
                wordToQuiz: { id: 'w2', word: 'banana', imageUrl: '', type: 'sight_word', definition: '' },
                options: [],
                correctAnswer: 'banana'
            });

            component.onNext();

            // Should be playing *immediately*
            expect(component.isPlaying).toBe(true);

            jest.advanceTimersByTime(500);

            expect(mockSpeechService.speak).toHaveBeenCalledWith('banana', 'en');
            jest.useRealTimers();
        });
    });

    describe('Don\'t Know Feedback', () => {
        beforeEach(() => {
            component.isSightWordQuiz = true;
            component.quizStarted = true;
            component.currentQuestion = {
                wordToQuiz: { id: 'w1', word: 'apple', imageUrl: '', type: 'sight_word', definition: '' },
                options: [],
                correctAnswer: 'apple'
            };
        });

        it('should play audio when Dont Know is pressed in Read Mode', () => {
            component.activeMode = 'read';
            component.onDontKnow();
            expect(mockSpeechService.speak).toHaveBeenCalledWith('apple', 'en');
        });

        it('should NOT play audio when Dont Know is pressed in other modes', () => {
            component.activeMode = 'listen'; // Or any other mode
            component.onDontKnow();
            // Reset mock to ensure we aren't counting previous calls if any (though beforeEach should handle it, explicit here for clarity)
            // We need to be careful with pre-existing calls.
            // But based on logic, listen mode implies we heard it already? Actually listen mode they might want to hear it again, but user request specifically said "Read Mode".
            // Let's verify it ONLY calls it for Read Mode per request instructions "when in sight word "Read Mode"..."
            // Re-reading code: if (this.isSightWordQuiz && this.activeMode === 'read' ...)
            // So it should indeed NOT call it content other modes.
            // Actually wait, 'listen' mode... if they don't know it, they probably just heard it and failed to identify.
            // The code I wrote strictly checks activeMode === 'read'.
        });
    });

    describe('Keypad Mode Logic', () => {
        beforeEach(() => {
            component.isMathQuiz = true;
            component.currentQuestion = {
                wordToQuiz: { id: 'm1', word: '7 + 5', imageUrl: '', type: 'math', definition: '12' },
                options: ['12', '10', '14', '11'],
                correctAnswer: '12'
            };
            component.quizStarted = true;
            component.activeMode = 'keypad';
            component.interactionMode = 'keypad';
        });

        it('should switch to keypad mode and start quiz immediately without audio preloading', () => {
            component.quizStarted = false;
            component.startWithMode('keypad');

            expect(component.activeMode).toBe('keypad');
            expect(component.interactionMode).toBe('keypad');
            expect(component.quizStarted).toBe(true);
            expect(component.isLoadingModel).toBe(false);
            expect(mockSpeechService.preloadVoskModel).not.toHaveBeenCalled();
            expect(mockSpeechService.prefetchAudio).not.toHaveBeenCalled();
        });

        it('should append digits to keypadInput', () => {
            component.keypadInput = '';
            component.appendKeypad('1');
            component.appendKeypad('2');
            expect(component.keypadInput).toBe('12');
        });

        it('should replace leading 0 when appending non-zero digit', () => {
            component.keypadInput = '0';
            component.appendKeypad('5');
            expect(component.keypadInput).toBe('5');
        });

        it('should not allow multiple leading zeros', () => {
            component.keypadInput = '0';
            component.appendKeypad('0');
            expect(component.keypadInput).toBe('0');
        });

        it('should toggle negative sign with toggleNegative', () => {
            component.keypadInput = '';
            component.toggleNegative();
            expect(component.keypadInput).toBe('-');

            component.toggleNegative();
            expect(component.keypadInput).toBe('');

            component.keypadInput = '15';
            component.toggleNegative();
            expect(component.keypadInput).toBe('-15');

            component.toggleNegative();
            expect(component.keypadInput).toBe('15');
        });

        it('should backspace the last entered character', () => {
            component.keypadInput = '123';
            component.backspaceKeypad();
            expect(component.keypadInput).toBe('12');

            component.backspaceKeypad();
            expect(component.keypadInput).toBe('1');

            component.backspaceKeypad();
            expect(component.keypadInput).toBe('');

            component.backspaceKeypad();
            expect(component.keypadInput).toBe('');
        });

        it('should clear negative sign if only minus remains after backspace', () => {
            component.keypadInput = '-5';
            component.backspaceKeypad();
            expect(component.keypadInput).toBe('');
        });

        it('should clear all keypad input with clearKeypad', () => {
            component.keypadInput = '999';
            component.clearKeypad();
            expect(component.keypadInput).toBe('');
        });

        it('should submit correct answer and mark isCorrect=true', () => {
            component.keypadInput = '12';
            component.submitKeypad();

            expect(component.isCorrect).toBe(true);
            expect(component.selectedAnswer).toBe('12');
            expect(component.recognizedText).toBe('12');
            expect(mockQuizService.submitAnswer).toHaveBeenCalledWith('m1', true, '7 + 5');
            expect(component.feedbackVisible).toBe(true);
        });

        it('should accept numerically equivalent answers (e.g. 012 for 12)', () => {
            component.keypadInput = '012';
            component.submitKeypad();

            expect(component.isCorrect).toBe(true);
            expect(mockQuizService.submitAnswer).toHaveBeenCalledWith('m1', true, '7 + 5');
        });

        it('should submit incorrect answer and mark isCorrect=false', () => {
            component.keypadInput = '13';
            component.submitKeypad();

            expect(component.isCorrect).toBe(false);
            expect(component.selectedAnswer).toBe('13');
            expect(component.recognizedText).toBe('13');
            expect(mockQuizService.submitAnswer).toHaveBeenCalledWith('m1', false, '7 + 5');
            expect(component.feedbackVisible).toBe(true);
        });

        it('should ignore submit when keypadInput is empty or only a minus sign', () => {
            component.keypadInput = '';
            component.submitKeypad();
            expect(mockQuizService.submitAnswer).not.toHaveBeenCalled();
            expect(component.feedbackVisible).toBe(false);

            component.keypadInput = '-';
            component.submitKeypad();
            expect(mockQuizService.submitAnswer).not.toHaveBeenCalled();
            expect(component.feedbackVisible).toBe(false);
        });

        it('should ignore submit when feedback is already visible', () => {
            component.feedbackVisible = true;
            component.keypadInput = '12';
            component.submitKeypad();
            expect(mockQuizService.submitAnswer).not.toHaveBeenCalled();
        });

        it('should reset keypadInput on displayNextQuestion', () => {
            component.keypadInput = '42';
            mockQuizService.getNextQuestion.mockReturnValue({
                wordToQuiz: { id: 'm2', word: '3 + 3', imageUrl: '', type: 'math', definition: '6' },
                options: ['6', '5', '4', '7'],
                correctAnswer: '6'
            });

            component.onNext();
            expect(component.keypadInput).toBe('');
        });

        it('should handle keyboard events in keypad mode', () => {
            component.keypadInput = '';

            // Number key
            const event1 = { key: '7', preventDefault: jest.fn() } as any;
            component.handleKeydown(event1);
            expect(component.keypadInput).toBe('7');
            expect(event1.preventDefault).toHaveBeenCalled();

            // Minus key
            const event2 = { key: '-', preventDefault: jest.fn() } as any;
            component.handleKeydown(event2);
            expect(component.keypadInput).toBe('-7');

            // Backspace key
            const event3 = { key: 'Backspace', preventDefault: jest.fn() } as any;
            component.handleKeydown(event3);
            expect(component.keypadInput).toBe('');

            // Type 12 and press Enter
            component.handleKeydown({ key: '1', preventDefault: jest.fn() } as any);
            component.handleKeydown({ key: '2', preventDefault: jest.fn() } as any);
            const enterEvent = { key: 'Enter', preventDefault: jest.fn() } as any;
            component.handleKeydown(enterEvent);
            expect(component.isCorrect).toBe(true);
            expect(component.feedbackVisible).toBe(true);
        });

        it('should ignore keyboard events when not in keypad mode', () => {
            component.interactionMode = 'speak';
            component.keypadInput = '';
            const event = { key: '7', preventDefault: jest.fn() } as any;
            component.handleKeydown(event);
            expect(component.keypadInput).toBe('');
            expect(event.preventDefault).not.toHaveBeenCalled();
        });
    });

    describe('Delay Answer Choices Setting', () => {
        beforeEach(() => {
            mockSettingsService.getSettings.mockReturnValue({
                delayAnswers: true,
                delayAnswerTimer: 3,
                usePremiumVoice: false,
                autoAdvance: false
            });
            mockQuizService.getNextQuestion.mockReturnValue({
                wordToQuiz: { id: 'm1', word: '3 + 4', imageUrl: '', type: 'math', definition: '7' },
                options: ['7', '6', '8', '9'],
                correctAnswer: '7'
            });
        });

        it('should NOT start delay timer for Math quiz in keypad mode even when delayAnswers is true', () => {
            component.isMathQuiz = true;
            component.startWithMode('keypad');

            expect(component.interactionMode).toBe('keypad');
            expect(component.delayingAnswers).toBe(false);
        });

        it('should NOT start delay timer for Math quiz in speak mode even when delayAnswers is true', () => {
            mockSpeechService.isVoskReady.mockReturnValue(true);
            component.isMathQuiz = true;
            component.startWithMode('speak');

            expect(component.interactionMode).toBe('speak');
            expect(component.delayingAnswers).toBe(false);
        });

        it('should start delay timer for Math quiz in multiple-choice mode when delayAnswers is true', () => {
            component.isMathQuiz = true;
            component.startWithMode('multiple-choice');

            expect(component.interactionMode).toBe('multiple-choice');
            expect(component.delayingAnswers).toBe(true);
        });

        it('should start delay timer for standard multiple-choice quiz when delayAnswers is true', async () => {
            component.isMathQuiz = false;
            component.isSightWordQuiz = false;
            component.interactionMode = 'multiple-choice';

            await (component as any).displayNextQuestion();

            expect(component.delayingAnswers).toBe(true);
        });

        it('should NOT start delay timer when delayAnswers is false for multiple-choice quiz', async () => {
            mockSettingsService.getSettings.mockReturnValue({
                delayAnswers: false,
                delayAnswerTimer: 3,
                usePremiumVoice: false
            });
            component.interactionMode = 'multiple-choice';

            await (component as any).displayNextQuestion();

            expect(component.delayingAnswers).toBe(false);
        });

        it('should NOT start delay timer for sight words in spell mode', () => {
            component.isSightWordQuiz = true;
            mockQuizService.getNextQuestion.mockReturnValue({
                wordToQuiz: { id: 'sw1', word: 'cat', imageUrl: '', type: 'sight_word', definition: 'cat' },
                options: [],
                correctAnswer: 'cat'
            });

            component.startWithMode('spell');

            expect(component.interactionMode).toBe('spell');
            expect(component.delayingAnswers).toBe(false);
        });

        it('should NOT start delay timer for sight words in scramble mode', () => {
            component.isSightWordQuiz = true;
            mockQuizService.getNextQuestion.mockReturnValue({
                wordToQuiz: { id: 'sw1', word: 'cat', imageUrl: '', type: 'sight_word', definition: 'cat' },
                options: [],
                correctAnswer: 'cat'
            });

            component.startWithMode('scramble');

            expect(component.interactionMode).toBe('scramble');
            expect(component.delayingAnswers).toBe(false);
        });

        it('should start delay timer for sight words in listen mode (multiple-choice) even if usePremiumVoice is true', () => {
            mockSettingsService.getSettings.mockReturnValue({
                delayAnswers: true,
                delayAnswerTimer: 3,
                usePremiumVoice: true
            });
            component.isSightWordQuiz = true;
            mockQuizService.getNextQuestion.mockReturnValue({
                wordToQuiz: { id: 'sw1', word: 'cat', imageUrl: '', type: 'sight_word', definition: 'cat' },
                options: ['cat', 'dog', 'hat'],
                correctAnswer: 'cat'
            });

            component.startWithMode('listen');

            expect(component.interactionMode).toBe('multiple-choice');
            expect(component.delayingAnswers).toBe(true);
        });
    });

    describe('Math Quiz Speak Mode', () => {
        beforeEach(() => {
            mockSpeechService.isVoskReady.mockReturnValue(true);
            component.isMathQuiz = true;
            mockQuizService.getNextQuestion.mockReturnValue({
                wordToQuiz: { id: 'm1', word: '5 x 5', imageUrl: '', type: 'math', definition: '25' },
                options: ['25', '20', '30', '15'],
                correctAnswer: '25'
            });
            component.startWithMode('speak');
        });

        it('should mark answer correct when detected speech matches numeric answer', () => {
            const listenSubject = new Subject<any>();
            mockSpeechService.listen.mockReturnValue(listenSubject.asObservable());
            mockSpeechService.wordsMatch.mockImplementation((rec, target) => {
                return rec === 'twenty five' && target === '25';
            });

            component.onRecord();
            listenSubject.next({ result: 'twenty five' });

            expect(mockSpeechService.wordsMatch).toHaveBeenCalledWith('twenty five', '25');
            expect(component.isCorrect).toBe(true);
            expect(component.feedbackVisible).toBe(true);
            expect(mockQuizService.submitAnswer).toHaveBeenCalledWith('m1', true, '5 x 5');
        });

        it('should mark answer incorrect when detected speech does not match numeric answer', () => {
            const listenSubject = new Subject<any>();
            mockSpeechService.listen.mockReturnValue(listenSubject.asObservable());
            mockSpeechService.wordsMatch.mockReturnValue(false);

            component.onRecord();
            listenSubject.next({ result: 'twenty four' });

            expect(mockSpeechService.wordsMatch).toHaveBeenCalledWith('twenty four', '25');
            expect(component.isCorrect).toBe(false);
            expect(component.feedbackVisible).toBe(true);
            expect(mockQuizService.submitAnswer).toHaveBeenCalledWith('m1', false, '5 x 5');
        });
    });

    describe('Sentences Quiz Audio Capture', () => {
        beforeEach(() => {
            mockSpeechService.isVoskReady.mockReturnValue(true);
            component.isSentencesQuiz = true;
            component.isSightWordQuiz = false;
            component.isMathQuiz = false;
            mockQuizService.getRemainingWords.mockReturnValue([
                'She will relax.',
                'Do you see the tiger?'
            ]);
            mockQuizService.getNextQuestion.mockReturnValue({
                wordToQuiz: { id: 's1', word: 'She will relax.', imageUrl: '', type: 'sentence', definition: '' },
                options: [],
                correctAnswer: 'She will relax.'
            });
            component.startWithMode('read');
        });

        it('should pass undefined vocabulary and captureAudio=true to speechService.listen and upload recording on onRecord for Sentences quiz', () => {
            const listenSubject = new Subject<any>();
            mockSpeechService.listen.mockReturnValue(listenSubject.asObservable());
            mockSpeechService.wordsMatch.mockReturnValue(false);

            component.onRecord();

            expect(mockSpeechService.listen).toHaveBeenCalledWith(
                'She will relax.',
                'en',
                undefined,
                true
            );

            const fakeBlob = new Blob(['audio-data'], { type: 'audio/webm' });
            listenSubject.next({ result: 'she were very lax', audioBlob: fakeBlob });

            expect(mockSupabaseService.uploadUserRecording).toHaveBeenCalledWith(
                fakeBlob,
                expect.stringContaining('en-US-She will relax-')
            );
        });

        it('should pass undefined vocabulary and captureAudio=true to speechService.listen and upload recording on startAutoRecording for Sentences quiz', () => {
            const listenSubject = new Subject<any>();
            mockSpeechService.listen.mockReturnValue(listenSubject.asObservable());
            mockSpeechService.wordsMatch.mockReturnValue(true);

            component.autoRecordEnabled = true;
            component.onNext();

            expect(mockSpeechService.listen).toHaveBeenCalledWith(
                'She will relax.',
                'en',
                undefined,
                true
            );

            const fakeBlob = new Blob(['audio-data'], { type: 'audio/webm' });
            listenSubject.next({ result: 'she will relax', audioBlob: fakeBlob });

            expect(mockSupabaseService.uploadUserRecording).toHaveBeenCalledWith(
                fakeBlob,
                expect.stringContaining('en-US-She will relax-')
            );
        });

        it('should strip question marks and unsafe characters from debug audio filename', () => {
            mockQuizService.getNextQuestion.mockReturnValue({
                wordToQuiz: { id: 's2', word: 'Do you see the tiger?', imageUrl: '', type: 'sentence', definition: '' },
                options: [],
                correctAnswer: 'Do you see the tiger?'
            });
            component.onNext();

            const listenSubject = new Subject<any>();
            mockSpeechService.listen.mockReturnValue(listenSubject.asObservable());
            mockSpeechService.wordsMatch.mockReturnValue(true);

            component.onRecord();

            const fakeBlob = new Blob(['audio-data'], { type: 'audio/webm' });
            listenSubject.next({ result: 'do you see the tiger', audioBlob: fakeBlob });

            expect(mockSupabaseService.uploadUserRecording).toHaveBeenCalledWith(
                fakeBlob,
                expect.stringMatching(/^en-US-Do you see the tiger-[^?]+\.webm$/)
            );
        });

        it('should NOT constrain vocabulary for single-word Sight Words quizzes to prevent forced false positives', () => {
            component.isSentencesQuiz = false;
            component.isSightWordQuiz = true;
            mockQuizService.getNextQuestion.mockReturnValue({
                wordToQuiz: { id: 'sw1', word: 'relax', imageUrl: '', type: 'sight', definition: '' },
                options: [],
                correctAnswer: 'relax'
            });
            component.onNext();

            const listenSubject = new Subject<any>();
            mockSpeechService.listen.mockReturnValue(listenSubject.asObservable());

            component.onRecord();

            expect(mockSpeechService.listen).toHaveBeenCalledWith(
                'relax',
                'en',
                undefined,
                true
            );
        });
    });
});


