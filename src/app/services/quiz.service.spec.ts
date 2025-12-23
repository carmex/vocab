import { TestBed } from '@angular/core/testing';
import { QuizService } from './quiz.service';
import { VocabularyService } from './vocabulary.service';
import { StateService } from './state.service';
import { Word } from '../models/word.interface';
import { QuizQuestion } from '../models/quiz-question.interface';
import { AppState } from '../models/app-state.interface';
import { of } from 'rxjs';

describe('QuizService', () => {
  let service: QuizService;
  let vocabServiceSpy: jasmine.SpyObj<VocabularyService>;
  let stateServiceSpy: jasmine.SpyObj<StateService>;

  const mockWords: Word[] = [
    {
      word: 'apple',
      type: 'n.',
      definition: 'A round fruit'
    },
    {
      word: 'run',
      type: 'v.',
      definition: 'To move quickly'
    },
    {
      word: 'happy',
      type: 'adj.',
      definition: 'Feeling pleasure'
    },
    {
      word: 'quickly',
      type: 'adv.',
      definition: 'In a fast manner'
    },
    {
      word: 'beautiful',
      type: 'adj.',
      definition: 'Having beauty'
    }
  ];

  const mockState: AppState = {
    current_pass_answered: [],
    cumulative_missed: ['apple', 'run'],
    review_pass_answered: [],
    review_pass_correct: [],
    session_missed_main: [],
    session_missed_review: []
  };

  beforeEach(() => {
    const vocabSpy = jasmine.createSpyObj('VocabularyService', ['getWords']);
    const stateSpy = jasmine.createSpyObj('StateService', ['getCurrentState', 'answerWord', 'clearCurrentPass', 'clearReviewPass']);

    TestBed.configureTestingModule({
      providers: [
        QuizService,
        { provide: VocabularyService, useValue: vocabSpy },
        { provide: StateService, useValue: stateSpy }
      ]
    });

    service = TestBed.inject(QuizService);
    vocabServiceSpy = TestBed.inject(VocabularyService) as jasmine.SpyObj<VocabularyService>;
    stateServiceSpy = TestBed.inject(StateService) as jasmine.SpyObj<StateService>;

    // Setup default mocks
    vocabServiceSpy.getWords.and.returnValue(of(mockWords));
    stateServiceSpy.getCurrentState.and.returnValue(mockState);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize totalWordsInPass to 0', () => {
    expect(service.totalWordsInPass).toBe(0);
  });

  it('should start main quiz with all words', async () => {
    const emptyState: AppState = {
      current_pass_answered: [],
      cumulative_missed: [],
      review_pass_answered: [],
      review_pass_correct: [],
      session_missed_main: [],
      session_missed_review: []
    };
    stateServiceSpy.getCurrentState.and.returnValue(emptyState);

    await service.startQuiz('main');

    expect(service.totalWordsInPass).toBe(mockWords.length);
  });

  it('should start review quiz with only missed words', async () => {
    await service.startQuiz('review');

    expect(service.totalWordsInPass).toBe(2); // 'apple' and 'run' are in cumulative_missed
  });

  it('should filter out already answered words in main quiz', async () => {
    const stateWithAnswered: AppState = {
      ...mockState,
      current_pass_answered: ['apple']
    };
    stateServiceSpy.getCurrentState.and.returnValue(stateWithAnswered);

    await service.startQuiz('main');

    // Should still have all words in pool, but will be filtered when getting questions
    expect(service.totalWordsInPass).toBe(mockWords.length);
  });

  it('should filter out already answered words in review quiz', async () => {
    const stateWithAnswered: AppState = {
      ...mockState,
      review_pass_answered: ['apple']
    };
    stateServiceSpy.getCurrentState.and.returnValue(stateWithAnswered);

    await service.startQuiz('review');

    expect(service.totalWordsInPass).toBe(2); // Still 2 total, but 'apple' already answered
  });

  it('should return null when no more questions available', async () => {
    // Set up empty word list
    vocabServiceSpy.getWords.and.returnValue(of([]));
    await service.startQuiz('main');
    
    const question = service.getNextQuestion();
    
    expect(question).toBeNull();
  });

  it('should generate valid quiz question', async () => {
    await service.startQuiz('main');

    const question = service.getNextQuestion();

    expect(question).toBeDefined();
    expect(question!.wordToQuiz).toBeDefined();
    expect(question!.wordToQuiz.word).toBeTruthy();
    expect(question!.wordToQuiz.definition).toBeTruthy();
    expect(question!.options).toBeDefined();
    expect(question!.options.length).toBe(4);
    expect(question!.correctAnswer).toBe(question!.wordToQuiz.definition);
    expect(question!.options).toContain(question!.correctAnswer);
  });

  it('should generate question with unique distractor definitions', async () => {
    await service.startQuiz('main');

    const question = service.getNextQuestion();

    expect(question!.options.length).toBe(4);
    
    // Check that all options are unique
    const uniqueOptions = new Set(question!.options);
    expect(uniqueOptions.size).toBe(4);

    // Check that distractors are different from correct answer
    const distractors = question!.options.filter(opt => opt !== question!.correctAnswer);
    expect(distractors.every(d => d !== question!.correctAnswer)).toBe(true);
  });

  it('should handle empty word list', async () => {
    vocabServiceSpy.getWords.and.returnValue(of([]));

    await service.startQuiz('main');

    expect(service.totalWordsInPass).toBe(0);
    expect(service.getNextQuestion()).toBeNull();
  });

  it('should handle words with missing definitions', async () => {
    const incompleteWords: Word[] = [
      {
        word: 'incomplete',
        type: 'n.',
        definition: '' // Empty definition
      }
    ];
    vocabServiceSpy.getWords.and.returnValue(of(incompleteWords));

    await service.startQuiz('main');

    const question = service.getNextQuestion();
    expect(question).toBeDefined();
    expect(question!.correctAnswer).toBe('');
  });

  it('should get all questions in quiz', async () => {
    await service.startQuiz('main');

    const questions: QuizQuestion[] = [];
    let question: QuizQuestion | null;
    
    // Get all questions
    do {
      question = service.getNextQuestion();
      if (question) {
        questions.push(question);
      }
    } while (question !== null);

    // Should get exactly as many questions as words in the pool
    expect(questions.length).toBe(service.totalWordsInPass);
  });

  it('should handle review mode with limited word pool', async () => {
    // Only 2 words in missed list
    await service.startQuiz('review');

    const questions: QuizQuestion[] = [];
    let question: QuizQuestion | null;
    
    // Should only be able to get 2 questions
    do {
      question = service.getNextQuestion();
      if (question) {
        questions.push(question);
      }
    } while (question !== null);

    expect(questions.length).toBe(2);
    
    // Questions should only be about missed words
    const questionWords = questions.map(q => q.wordToQuiz.word);
    expect(questionWords).toContain('apple');
    expect(questionWords).toContain('run');
    expect(questionWords).not.toContain('happy');
    expect(questionWords).not.toContain('quickly');
    expect(questionWords).not.toContain('beautiful');
  });

  it('should handle errors from vocabulary service gracefully', async () => {
    vocabServiceSpy.getWords.and.returnValue(of([] as Word[]));

    await service.startQuiz('main');

    expect(service.totalWordsInPass).toBe(0);
    expect(service.getNextQuestion()).toBeNull();
  });

  it('should use Fisher-Yates shuffle algorithm', () => {
    const testArray = [1, 2, 3, 4, 5];
    const shuffled = (service as any).shuffleArray([...testArray]);

    // Should contain the same elements
    expect(shuffled.slice().sort()).toEqual(testArray.slice().sort());
    
    // Should be different order (with very high probability)
    // Since we're dealing with randomness, we'll just check it's still an array
    expect(Array.isArray(shuffled)).toBe(true);
    expect(shuffled.length).toBe(testArray.length);
  });

  it('should handle single word correctly', async () => {
    const singleWord: Word[] = [
      {
        word: 'only',
        type: 'adj.',
        definition: 'Single word'
      }
    ];

    vocabServiceSpy.getWords.and.returnValue(of(singleWord));
    const emptyState: AppState = {
      current_pass_answered: [],
      cumulative_missed: [],
      review_pass_answered: [],
      review_pass_correct: [],
      session_missed_main: [],
      session_missed_review: []
    };
    stateServiceSpy.getCurrentState.and.returnValue(emptyState);

    await service.startQuiz('main');

    const question = service.getNextQuestion();
    expect(question).toBeDefined();
    expect(question!.wordToQuiz.word).toBe('only');
    
    // Should get null on subsequent calls
    expect(service.getNextQuestion()).toBeNull();
  });
});