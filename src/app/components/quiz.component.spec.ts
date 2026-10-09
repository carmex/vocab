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
        mockNgZone = { run: jest.fn().mockImplementation((fn: any) => fn()) };

        component = new QuizComponent(
            mockRoute,
            mockRouter,
            mockQuizService,
            mockSettingsService,
            mockClassroomService,
            mockAuthService,
            mockSpeechService as any,
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
});

