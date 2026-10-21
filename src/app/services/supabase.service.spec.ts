import { SupabaseService } from './supabase.service';
import * as supabaseJs from '@supabase/supabase-js';

jest.mock('../../environments/environment', () => ({
    environment: {
        supabase: {
            url: 'https://test.supabase.co',
            key: 'test-anon-key'
        }
    }
}));

describe('SupabaseService', () => {
    let createClientSpy: jest.SpyInstance;

    beforeEach(() => {
        createClientSpy = jest.spyOn(supabaseJs, 'createClient').mockReturnValue({} as any);
    });

    afterEach(() => {
        createClientSpy.mockRestore();
    });

    it('should initialize SupabaseClient with detectSessionInUrl false and custom no-op lock function', async () => {
        const service = new SupabaseService();
        expect(service).toBeTruthy();

        expect(createClientSpy).toHaveBeenCalledWith(
            'https://test.supabase.co',
            'test-anon-key',
            expect.objectContaining({
                auth: expect.objectContaining({
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: false,
                    lock: expect.any(Function)
                })
            })
        );

        // Verify the lock implementation executes the callback directly without failing
        const callArgs = createClientSpy.mock.calls[0];
        const authConfig = callArgs[2].auth;
        const testFn = jest.fn().mockResolvedValue('lock-result');
        const lockResult = await authConfig.lock('test-lock', 0, testFn);

        expect(lockResult).toBe('lock-result');
        expect(testFn).toHaveBeenCalled();
    });
});
