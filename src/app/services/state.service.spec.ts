import { TestBed } from '@angular/core/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { StateService } from './state.service';
import { AppState } from '../models/app-state.interface';
import { QuizSummary } from '../models/quiz-summary.interface';
import { Word } from '../models/word.interface';

describe('StateService', () => {
  let service: StateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MatDialogModule],
      providers: [StateService]
    });
    service = TestBed.inject(StateService);
    
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with default state', () => {
    const state = service.getCurrentState();
    expect(state.current_pass_answered).toEqual([]);
    expect(state.cumulative_missed).toEqual([]);
    expect(state.review_pass_answered).toEqual([]);
    expect(state.review_pass_correct).toEqual([]);
    expect(state.session_missed_main).toEqual([]);
    expect(state.session_missed_review).toEqual([]);
  });

  it('should emit observables when state changes', (done) => {
    let callCount = 0;
    service.currentPassAnswered$.subscribe(words => {
      callCount++;
      if (callCount === 1) {
        // Initial emission should be empty
        expect(words).toEqual([]);
        const testWord: Word = {
          word: 'test-word',
          type: 'n.',
          definition: 'A test definition'
        };
        service.answerWord(testWord, true, 'main', 5);
      } else if (callCount === 2) {
        // After answering, should contain the word
        expect(words).toContain('test-word');
        done();
      }
    });
  });

  it('should track progress in main quiz mode', (done) => {
    service.currentPassAnswered$.pipe().subscribe(words => {
      expect(words).toContain('test-word');
      done();
    });

    const testWord: Word = {
      word: 'test-word',
      type: 'n.',
      definition: 'A test definition'
    };
    service.answerWord(testWord, true, 'main', 5);
  });

  it('should add incorrect answers to cumulative missed', (done) => {
    service.cumulativeMissed$.subscribe(missed => {
      expect(missed).toContain('missed-word');
      done();
    });

    const testWord: Word = {
      word: 'missed-word',
      type: 'n.',
      definition: 'A missed definition'
    };
    service.answerWord(testWord, false, 'main', 5);
  });

  it('should track review mode correctly', (done) => {
    let answeredCallCount = 0;
    let correctCallCount = 0;

    service.reviewPassAnswered$.subscribe(words => {
      answeredCallCount++;
      expect(words).toContain('review-word');
      if (answeredCallCount === 1 && correctCallCount === 1) {
        done();
      }
    });

    service.reviewPassCorrect$.subscribe(correct => {
      correctCallCount++;
      expect(correct).toContain('review-word');
      if (answeredCallCount === 1 && correctCallCount === 1) {
        done();
      }
    });

    const testWord: Word = {
      word: 'review-word',
      type: 'n.',
      definition: 'A review definition'
    };
    service.answerWord(testWord, true, 'review', 5);
  });

  it('should not duplicate words in cumulative missed', (done) => {
    service.cumulativeMissed$.subscribe(missed => {
      const occurrences = missed.filter(word => word === 'duplicate-word').length;
      expect(occurrences).toBe(1);
      done();
    });

    const testWord: Word = {
      word: 'duplicate-word',
      type: 'n.',
      definition: 'A definition'
    };

    service.answerWord(testWord, false, 'main', 5);
    service.answerWord(testWord, false, 'main', 5);
  });

  it('should complete pass when all words answered', (done) => {
    service.lastSummary$.subscribe(summary => {
      if (summary) {
        expect(summary.total).toBe(2);
        expect(summary.correct).toBe(2);
        expect(summary.missed).toBe(0);
        expect(summary.quizMode).toBe('main');
        expect(summary.score).toBe(100);
        done();
      }
    });

    const word1: Word = { word: 'word1', type: 'n.', definition: 'Definition 1' };
    const word2: Word = { word: 'word2', type: 'n.', definition: 'Definition 2' };

    service.answerWord(word1, true, 'main', 2);
    service.answerWord(word2, true, 'main', 2);
  });

  it('should clear current pass after completion', (done) => {
    const word1: Word = { word: 'word1', type: 'n.', definition: 'Definition 1' };
    const word2: Word = { word: 'word2', type: 'n.', definition: 'Definition 2' };

    service.answerWord(word1, true, 'main', 2);
    service.answerWord(word2, true, 'main', 2);

    setTimeout(() => {
      service.currentPassAnswered$.subscribe(words => {
        expect(words.length).toBe(0);
        done();
      });
    }, 200);
  });

  it('should clear current pass manually', (done) => {
    const testWord: Word = {
      word: 'test-word',
      type: 'n.',
      definition: 'A test definition'
    };

    service.answerWord(testWord, true, 'main', 5);
    
    setTimeout(() => {
      service.clearCurrentPass();
      
      service.currentPassAnswered$.subscribe(words => {
        expect(words).toEqual([]);
        done();
      });
    }, 50);
  });

  it('should clear review pass and correct words', (done) => {
    const testWord: Word = {
      word: 'review-word',
      type: 'n.',
      definition: 'A review definition'
    };

    service.answerWord(testWord, true, 'review', 5);

    setTimeout(() => {
      service.clearReviewPass();

      let callCount = 0;
      service.reviewPassAnswered$.subscribe(words => {
        callCount++;
        if (callCount === 1) {
          expect(words).toEqual([]);
        }
      });

      service.reviewPassCorrect$.subscribe(correct => {
        expect(correct).toEqual([]);
        done();
      });
    }, 50);
  });

  it('should remove corrected words from cumulative missed', (done) => {
    const missedWord: Word = { word: 'missed', type: 'n.', definition: 'Definition' };
    service.answerWord(missedWord, false, 'main', 5);

    setTimeout(() => {
      service.answerWord(missedWord, true, 'review', 1);
      
      setTimeout(() => {
        service.clearCorrectedFromCumulative();

        service.cumulativeMissed$.subscribe(missed => {
          expect(missed).not.toContain('missed');
          done();
        });
      }, 50);
    }, 50);
  });

  it('should add word to missed words manually', (done) => {
    service.cumulativeMissed$.subscribe(missed => {
      expect(missed).toContain('correct');
      done();
    });

    const correctWord: Word = { word: 'correct', type: 'n.', definition: 'Definition' };
    service.addToMissedWords(correctWord);
  });

  it('should not add duplicate words manually', (done) => {
    service.cumulativeMissed$.subscribe(missed => {
      const occurrences = missed.filter(word => word === 'duplicate').length;
      expect(occurrences).toBe(1);
      done();
    });

    const correctWord: Word = { word: 'duplicate', type: 'n.', definition: 'Definition' };
    service.addToMissedWords(correctWord);
    service.addToMissedWords(correctWord);
  });

  it('should determine if quiz is in progress', (done) => {
    let callCount = 0;
    service.hasQuizInProgress$.subscribe(hasProgress => {
      callCount++;
      if (callCount === 1) {
        expect(hasProgress).toBe(false);
        const testWord: Word = { word: 'test', type: 'n.', definition: 'Definition' };
        service.answerWord(testWord, true, 'main', 5);
      } else if (callCount === 2) {
        expect(hasProgress).toBe(true);
        done();
      }
    });
  });

  it('should determine if there are missed words', (done) => {
    let callCount = 0;
    service.hasMissedWords$.subscribe(hasMissed => {
      callCount++;
      if (callCount === 1) {
        expect(hasMissed).toBe(false);
        const testWord: Word = { word: 'missed', type: 'n.', definition: 'Definition' };
        service.answerWord(testWord, false, 'main', 5);
      } else if (callCount === 2) {
        expect(hasMissed).toBe(true);
        done();
      }
    });
  });

  it('should track returning user status', (done) => {
    let callCount = 0;
    service.isReturningUser$.subscribe(isReturning => {
      callCount++;
      if (callCount === 1) {
        expect(isReturning).toBe(false);
        const testWord: Word = { word: 'test', type: 'n.', definition: 'Definition' };
        service.answerWord(testWord, true, 'main', 5);
      } else if (callCount === 2) {
        expect(isReturning).toBe(true);
        done();
      }
    });
  });

  it('should handle import errors gracefully', () => {
    const invalidFile = new File(['invalid json'], 'test.txt', { type: 'text/plain' });
    expect(() => service.importState(invalidFile)).not.toThrow();
  });

  it('should validate imported state structure', () => {
    const invalidState = {
      invalidProperty: 'value'
    };

    const blob = new Blob([JSON.stringify(invalidState)], { type: 'application/json' });
    const invalidFile = new File([blob], 'test.json', { type: 'application/json' });

    expect(() => service.importState(invalidFile)).not.toThrow();
  });

  it('should handle localStorage errors gracefully', () => {
    spyOn(localStorage, 'setItem').and.throwError('Storage error');
    spyOn(localStorage, 'getItem').and.throwError('Storage error');

    const testWord: Word = { word: 'test', type: 'n.', definition: 'Definition' };
    
    expect(() => service.answerWord(testWord, true, 'main', 5)).not.toThrow();
    expect(() => service.getCurrentState()).not.toThrow();
  });
});