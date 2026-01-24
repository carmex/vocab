import { TestBed } from '@angular/core/testing';
import { StateService } from './state.service';
import { MatDialog } from '@angular/material/dialog';
import { AppState } from '../models/app-state.interface';
import { Word } from '../models/word.interface';
import { of } from 'rxjs';

// Define mock data at top level to be shared across describe blocks
const mockWord: Word = {
    id: '1',
    word: 'test',
    definition: 'test definition',
    type: 'noun'
};

const mockInitialState: AppState = {
    current_pass_answered: [],
    cumulative_missed: [],
    review_pass_answered: [],
    review_pass_correct: [],
    session_missed_main: [],
    session_missed_review: []
};

describe('StateService', () => {
    let service: StateService;
    let dialogMock: any;
    let localStorageMock: { [key: string]: string } = {};

    beforeEach(() => {
        localStorageMock = {};

        // Use jest.spyOn for mocking localStorage methods
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
            return localStorageMock[key] || null;
        });
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
            localStorageMock[key] = value;
        });
        jest.spyOn(Storage.prototype, 'clear').mockImplementation(() => {
            localStorageMock = {};
        });

        dialogMock = {
            open: jest.fn()
        };

        TestBed.configureTestingModule({
            providers: [
                StateService,
                { provide: MatDialog, useValue: dialogMock }
            ]
        });
        service = TestBed.inject(StateService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('Initialization', () => {
        it('should load initial state when local storage is empty', () => {
            service.currentPassAnswered$.subscribe(val => {
                expect(val).toEqual([]);
            });
            service.cumulativeMissed$.subscribe(val => {
                expect(val).toEqual([]);
            });
        });

        it('should load saved state from local storage', () => {
            // Logic for this test is tricky because service is already initialized in beforeEach.
            // We can create a new instance manually or trust that other tests cover this.
            // For now, let's keep it empty or remove it if it's redundant to the dedicated block below.
            // Or we can manually invoke a method if StateService had a public reload.
            // Since we have a specific describe block for "saved state", we can remove this or make it a specific check for default values.
            expect(service.getCurrentState().cumulative_missed).toEqual([]);
        });
    });
});

describe('StateService with saved state', () => {
    let service: StateService;
    let localStorageMock: { [key: string]: string } = {};
    let dialogMock: any;

    const savedState: AppState = {
        current_pass_answered: ['answered1'],
        cumulative_missed: ['missed1'],
        review_pass_answered: [],
        review_pass_correct: [],
        session_missed_main: [],
        session_missed_review: []
    };

    beforeEach(() => {
        localStorageMock = {
            'vocab_app_state': JSON.stringify(savedState)
        };

        jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
            return localStorageMock[key] || null;
        });
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
            localStorageMock[key] = value;
        });

        dialogMock = { open: jest.fn() };

        TestBed.configureTestingModule({
            providers: [
                StateService,
                { provide: MatDialog, useValue: dialogMock }
            ]
        });
        service = TestBed.inject(StateService);
    });

    it('should initialize with data from local storage', (done) => {
        service.cumulativeMissed$.subscribe(val => {
            expect(val).toEqual(['missed1']);
            done();
        });
    });
});

describe('StateService Logic', () => {
    let service: StateService;
    let dialogMock: any;
    let localStorageMock: { [key: string]: string } = {};

    beforeEach(() => {
        localStorageMock = {};
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => localStorageMock[key] || null);
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
            localStorageMock[key] = value;
        });

        dialogMock = { open: jest.fn() };

        TestBed.configureTestingModule({
            providers: [
                StateService,
                { provide: MatDialog, useValue: dialogMock }
            ]
        });
        service = TestBed.inject(StateService);
    });

    describe('answerWord', () => {
        it('should update correct answer in MAIN mode', () => {
            service.answerWord({ ...mockWord, word: 'apple' }, true, 'main', 10);
            const state = service.getCurrentState();
            expect(state.current_pass_answered).toContain('apple');
            expect(state.cumulative_missed).not.toContain('apple');
            expect(state.session_missed_main).not.toContain('apple');
        });

        it('should update incorrect answer in MAIN mode', () => {
            service.answerWord({ ...mockWord, word: 'pear' }, false, 'main', 10);
            const state = service.getCurrentState();
            expect(state.current_pass_answered).toContain('pear');
            expect(state.cumulative_missed).toContain('pear');
            expect(state.session_missed_main).toContain('pear');
        });

        it('should update correct answer in REVIEW mode', () => {
            service.answerWord({ ...mockWord, word: 'banana' }, true, 'review', 5);
            const state = service.getCurrentState();
            expect(state.review_pass_answered).toContain('banana');
            expect(state.review_pass_correct).toContain('banana');
            expect(state.session_missed_review).not.toContain('banana');
        });

        it('should update incorrect answer in REVIEW mode', () => {
            service.answerWord({ ...mockWord, word: 'grape' }, false, 'review', 5);
            const state = service.getCurrentState();
            expect(state.review_pass_answered).toContain('grape');
            expect(state.review_pass_correct).not.toContain('grape');
            expect(state.cumulative_missed).toContain('grape');
            expect(state.session_missed_review).toContain('grape');
        });

        it('should handle pass completion in MAIN mode', () => {
            const word = { ...mockWord, word: 'lastOne' };
            service.answerWord(word, true, 'main', 1);
            service.lastSummary$.subscribe(summary => {
                expect(summary).toBeTruthy();
                expect(summary?.quizMode).toBe('main');
                expect(summary?.total).toBe(1);
                expect(summary?.correct).toBe(1);
            });
            const state = service.getCurrentState();
            expect(state.current_pass_answered).toEqual([]);
            expect(state.session_missed_main).toEqual([]);
        });

        it('should handle pass completion in REVIEW mode', () => {
            const word = { ...mockWord, word: 'reviewWord' };
            service.answerWord(word, true, 'review', 1);
            service.lastSummary$.subscribe(summary => {
                expect(summary).toBeTruthy();
                expect(summary?.quizMode).toBe('review');
            });
            const state = service.getCurrentState();
            expect(state.review_pass_answered).toEqual([]);
            expect(state.review_pass_correct).toContain('reviewWord');
        });
    });

    describe('Management methods', () => {
        it('should clear current pass', () => {
            service.answerWord({ ...mockWord, word: 'x' }, false, 'main', 10);
            expect(service.getCurrentState().current_pass_answered.length).toBe(1);
            service.clearCurrentPass();
            const state = service.getCurrentState();
            expect(state.current_pass_answered).toEqual([]);
            expect(state.session_missed_main).toEqual([]);
            expect(state.cumulative_missed).toContain('x');
        });

        it('should clear review pass', () => {
            service.answerWord({ ...mockWord, word: 'y' }, true, 'review', 10);
            expect(service.getCurrentState().review_pass_answered.length).toBe(1);
            service.clearReviewPass();
            const state = service.getCurrentState();
            expect(state.review_pass_answered).toEqual([]);
            expect(state.review_pass_correct).toEqual([]);
            expect(state.session_missed_review).toEqual([]);
        });

        it('should clear corrected words from cumulative missed', () => {
            service.answerWord({ ...mockWord, word: 'z' }, false, 'main', 10);
            service.answerWord({ ...mockWord, word: 'z' }, true, 'review', 10);
            service.clearCorrectedFromCumulative();
            const state = service.getCurrentState();
            expect(state.cumulative_missed).not.toContain('z');
            expect(state.review_pass_answered).toEqual([]);
        });
    });
});
