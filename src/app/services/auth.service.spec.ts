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
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    update: jest.fn().mockReturnThis()
};

const mockSupabaseService = {
    client: mockSupabaseClient
};

describe('AuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sessionStorage.clear();
        mockSupabaseClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
        mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback) => {
            return { data: { subscription: { unsubscribe: jest.fn() } } };
        });
        mockSupabaseClient.auth.signInAnonymously.mockResolvedValue({
            data: { session: { user: { id: 'anon', is_anonymous: true } } },
            error: null
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
        sessionStorage.clear();
    });

    function createService(): AuthService {
        return new AuthService(mockSupabaseService as any);
    }

    it('should be created', () => {
        const service = createService();
        expect(service).toBeTruthy();
    });

    it('should sign in anonymously on init if no session exists and not OAuth callback', async () => {
        createService();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSupabaseClient.auth.getSession).toHaveBeenCalled();
        expect(mockSupabaseClient.auth.signInAnonymously).toHaveBeenCalled();
    });

    it('should register onAuthStateChange listener even when handling implicit OAuth callback', async () => {
        sessionStorage.setItem('supabase_oauth_hash', '#access_token=test-access-token&refresh_token=test-refresh-token');
        mockSupabaseClient.auth.setSession.mockResolvedValueOnce({
            data: { session: { user: { id: 'oauth-user', email: 'oauth@test.com' } } },
            error: null
        });

        const oauthService = createService();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalled();
        expect(mockSupabaseClient.auth.setSession).toHaveBeenCalledWith({
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token'
        });
        expect(mockSupabaseClient.auth.signInAnonymously).not.toHaveBeenCalled();
        expect(oauthService.currentUser?.email).toBe('oauth@test.com');
    });

    it('should register onAuthStateChange listener and handle PKCE OAuth callback', async () => {
        sessionStorage.setItem('supabase_oauth_search', '?code=auth-code-123');
        mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValueOnce({
            data: { session: { user: { id: 'pkce-user', email: 'pkce@test.com' } } },
            error: null
        });

        const oauthService = createService();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalled();
        expect(mockSupabaseClient.auth.exchangeCodeForSession).toHaveBeenCalledWith('auth-code-123');
        expect(mockSupabaseClient.auth.signInAnonymously).not.toHaveBeenCalled();
        expect(oauthService.currentUser?.email).toBe('pkce@test.com');
    });

    it('should retry setSession on lock timeout and not call signInAnonymously when OAuth is present', async () => {
        sessionStorage.setItem('supabase_oauth_hash', '#access_token=token-lock&refresh_token=refresh-lock');
        mockSupabaseClient.auth.setSession
            .mockRejectedValueOnce(new Error('Acquiring an exclusive Navigator LockManager lock immediately failed'))
            .mockResolvedValueOnce({
                data: { session: { user: { id: 'recovered-user', email: 'recovered@test.com' } } },
                error: null
            });

        const oauthService = createService();
        // Wait enough for the retry timeout
        await new Promise(resolve => setTimeout(resolve, 600));

        expect(mockSupabaseClient.auth.signInAnonymously).not.toHaveBeenCalled();
        expect(mockSupabaseClient.auth.setSession).toHaveBeenCalledTimes(2);
        expect(oauthService.currentUser?.email).toBe('recovered@test.com');
    });

    it('should not call signInAnonymously if OAuth callback fails permanently', async () => {
        sessionStorage.setItem('supabase_oauth_hash', '#access_token=bad-token&refresh_token=bad-refresh');
        mockSupabaseClient.auth.setSession.mockResolvedValue({
            data: { session: null },
            error: { message: 'Invalid token' }
        });

        createService();
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(mockSupabaseClient.auth.signInAnonymously).not.toHaveBeenCalled();
    });

    it('should not query profiles table when user is anonymous', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: 'anon-123', is_anonymous: true } } },
            error: null
        });

        const service = createService();
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(service.currentUser?.id).toBe('anon-123');
        expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('profiles');
        expect(service.currentProfile).toBeNull();
    });

    it('should query profiles table with maybeSingle when user is authenticated', async () => {
        mockSupabaseClient.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: 'auth-user', is_anonymous: false } } },
            error: null
        });
        mockSupabaseClient.maybeSingle.mockResolvedValue({
            data: { id: 'auth-user', role: 'teacher' },
            error: null
        });

        const service = createService();
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(service.currentUser?.id).toBe('auth-user');
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
        expect(mockSupabaseClient.maybeSingle).toHaveBeenCalled();
        expect(service.currentProfile?.role).toBe('teacher');
    });
});
