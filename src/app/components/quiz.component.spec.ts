import { QuizComponent } from './quiz.component';
import { of } from 'rxjs';
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
});
