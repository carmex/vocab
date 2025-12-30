import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { of } from 'rxjs';

// Mock Supabase Client
const mockSupabaseClient = {
    auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: jest.fn().mockImplementation((callback) => {
            // Return subscription
            return { data: { subscription: { unsubscribe: jest.fn() } } };
        }),
        signInAnonymously: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'anon', is_anonymous: true } } }, error: null }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
        updateUser: jest.fn().mockResolvedValue({ data: {}, error: null }),
        signInWithPassword: jest.fn(),
        signUp: jest.fn(),
        exchangeCodeForSession: jest.fn(),
        setSession: jest.fn()
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    update: jest.fn().mockReturnThis()
};

const mockSupabaseService = {
    client: mockSupabaseClient
};

describe('AuthService', () => {
    let service: AuthService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                AuthService,
                { provide: SupabaseService, useValue: mockSupabaseService }
            ]
        });
        service = TestBed.inject(AuthService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should sign in anonymously on init if no session exists', async () => {
        // Re-trigger init by calling private method or just waiting (since it's in constructor)
        // Actually, constructor runs init(). We can verify mock calls.
        // wait for async init to potentialy finish? It's not awaited in constructor.

        // We can spy on signInAnonymously before providing? No, provider is already set.
        // Let's just check if it was called.
        // Ideally we would extract init logic or make it public for testing, but constructor calls it.

        // Since init is async and not awaited in constructor, we might need a small delay or use fakeAsync (if feasible with jest-preset-angular)
        // For now, let's just await a tick.
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSupabaseClient.auth.getSession).toHaveBeenCalled();
        // Expect signInAnonymously to be called because we mocked getSession returning null
        expect(mockSupabaseClient.auth.signInAnonymously).toHaveBeenCalled();
    });
});
