import { TestBed } from '@angular/core/testing';
import { QuizService } from './quiz.service';
import { SupabaseService } from './supabase.service';
import { ListType } from '../models/list-type.enum';

describe('QuizService', () => {
    let service: QuizService;
    let supabaseMock: any;
    let dbMock: any;

    const mockWord = {
        id: '1',
        word: 'apple',
        definition: 'A fruit',
        image_url: 'apple.png'
    };

    const mockWord2 = {
        id: '2',
        word: 'banana',
        definition: 'Another fruit',
        image_url: 'banana.png'
    };

    const mockWordList = [mockWord, mockWord2,
        { id: '3', word: 'cat', definition: 'A pet' },
        { id: '4', word: 'dog', definition: 'Another pet' }];

    beforeEach(() => {
        // Create a chainable mock for Supabase query builder
        dbMock = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            delete: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
            then: jest.fn().mockImplementation((callback) => Promise.resolve({ data: [], error: null }).then(callback))
            // Note: .then implementation might be tricky if we want to await the chain. 
            // Usually we just mock the terminal methods (single, maybeSingle, or just await the chain if it's a promise-like)
            // supabase-js returning a PromiseLike builder.
        };

        // Enhance dbMock execution for list responses (default array response)
        // When awaited, the builder returns { data, error }
        // We can simulate this by making the methods return a Promise-like object OR just checking how the service calls it.
        // Service: await this.supabase.client.from(...).select(...).eq(...)
        // If we mock return values of the terminal calls like .single() it works.
        // But .select().eq() returns a PostgrestFilterBuilder which is then awaited.
        // We need to make the chain return a thenable if no terminal method is called?
        // Actually, usually we mock the chain to return the mock itself, and give the mock a 'then' method 
        // OR we configure specific mock implementations for specific sequences.

        // Simpler approach: Mock specific implementations for 'then' based on previous calls? Hard.
        // Let's rely on the terminal methods being called: .single(), .maybeSingle().
        // For the list fetch: .select('*').eq('list_id', listId) -> it IS the terminal.
        // So .eq needs to return a Promise-like value if it is the last call.
        // BUT it is also chainable.
        // Providing a 'then' method on the mock object handles the await.
        dbMock.then = (resolve: any) => resolve({ data: mockWordList, error: null });

        supabaseMock = {
            client: {
                from: jest.fn().mockReturnValue(dbMock),
                rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
                auth: {
                    getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } })
                }
            }
        };

        TestBed.configureTestingModule({
            providers: [
                QuizService,
                { provide: SupabaseService, useValue: supabaseMock }
            ]
        });
        service = TestBed.inject(QuizService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('startQuiz', () => {
        it('should fetch list details and words and initialize queue', async () => {
            // Setup Mocks
            // 1. List Details
            dbMock.single.mockResolvedValueOnce({
                data: { list_type: ListType.WORD_DEFINITION, language: 'en' },
                error: null
            });
            // 2. Words (handled by dbMock.then default)
            // 3. Progress
            dbMock.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

            const result = await service.startQuiz('list1', 'main');

            expect(result.listType).toBe(ListType.WORD_DEFINITION);
            expect(service.totalWordsInPass).toBe(4);
            expect(service.getRemainingWords().length).toBe(4);
            expect(supabaseMock.client.from).toHaveBeenCalledWith('word_lists');
            expect(supabaseMock.client.from).toHaveBeenCalledWith('list_words');
        });

        it('should restore progress if available', async () => {
            // Setup Mocks
            // 1. List Details
            dbMock.single.mockResolvedValueOnce({ data: { list_type: ListType.WORD_DEFINITION }, error: null });
            // 2. Words (handled by dbMock.then default)
            // 3. Progress
            dbMock.maybeSingle.mockResolvedValueOnce({
                data: { state: { answered_ids: ['1'], incorrect_ids: [] } },
                error: null
            });

            await service.startQuiz('list1', 'main');

            // 4 total, 1 answered -> 3 remaining
            expect(service.answeredCount).toBe(1);
            expect(service.getRemainingWords().length).toBe(3);
            expect(service.getRemainingWords()).not.toContain('apple'); // id: 1
        });

        it('should filter queue for review mode', async () => {
            // Setup Mocks
            // 1. List Details
            dbMock.single.mockResolvedValueOnce({ data: { list_type: ListType.WORD_DEFINITION }, error: null });
            // 2. Words (default)
            // 3. Progress for review
            dbMock.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
            // 4. Missed words fetch
            // We need to customize the chain for the missed words query
            // Query: .from('user_missed_words').select('word_id').eq(...)
            // The dbMock.then default returns mockWordList (objects). 
            // We want it to return [{word_id: '1'}, {word_id: '2'}]
            // This is tricky with a shared dbMock.
            // We can use `.mockImplementationOnce` on `supabaseMock.client.from` if we match the table name.

            // Let's refactor the from mock to return specific mocks for specific tables?
            // Or simpler: change dbMock.then implementation *before* the call?
            // But startQuiz does all calls in one go.

            // Better strategy:
            // mock implementation of `from` to return different builders based on table.

            const specificDbMock = { ...dbMock }; // clone basics
            // Custom response for user_missed_words
            specificDbMock.then = (resolve: any) => resolve({ data: [{ word_id: '2' }], error: null });

            supabaseMock.client.from.mockImplementation((table: string) => {
                if (table === 'user_missed_words') return specificDbMock;
                return dbMock;
            });

            await service.startQuiz('list1', 'review');

            // Should only contain word 2 (banana)
            expect(service.getRemainingWords().length).toBe(1);
            expect(service.getRemainingWords()[0]).toBe('banana');
            expect(service.currentMode).toBe('review');
        });
    });

    describe('getNextQuestion', () => {
        beforeEach(async () => {
            // Initialize quiz with data
            dbMock.single.mockResolvedValue({ data: { list_type: ListType.WORD_DEFINITION }, error: null });
            await service.startQuiz('list1', 'main');
        });

        it('should return a question with options', () => {
            const q = service.getNextQuestion();
            expect(q).toBeTruthy();
            expect(q?.options.length).toBeGreaterThan(0);
            expect(q?.options).toContain(q?.correctAnswer!);
        });
    });

    describe('submitAnswer', () => {
        beforeEach(async () => {
            dbMock.single.mockResolvedValue({ data: { list_type: ListType.WORD_DEFINITION }, error: null });
            await service.startQuiz('list1', 'main');
        });

        it('should remove word from queue and call RPC', async () => {
            const initialLen = service.getRemainingWords().length;
            const wordToAnswer = service.getRemainingWords()[0];
            const wordId = mockWordList.find(w => w.word === wordToAnswer)?.id || 'unknown';

            await service.submitAnswer(wordId, true);

            expect(service.getRemainingWords().length).toBe(initialLen - 1);
            expect(supabaseMock.client.rpc).toHaveBeenCalledWith('update_quiz_progress', expect.objectContaining({
                p_word_id: wordId,
                p_is_correct: true
            }));
        });
    });

    describe('finishPass', () => {
        beforeEach(async () => {
            dbMock.single.mockResolvedValue({ data: { list_type: ListType.WORD_DEFINITION }, error: null });
            await service.startQuiz('list1', 'main');
        });

        it('should call finish_quiz_pass RPC', async () => {
            await service.finishPass();
            expect(supabaseMock.client.rpc).toHaveBeenCalledWith('finish_quiz_pass', expect.objectContaining({
                p_list_id: 'list1',
                p_pass_type: 'main'
            }));
        });
    });
});
