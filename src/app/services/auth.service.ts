import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { User, AuthSession } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private _user = new BehaviorSubject<User | null>(null);
    public user$ = this._user.asObservable();
    private _profile = new BehaviorSubject<import('../models/classroom.interface').Profile | null>(null);
    public profile$ = this._profile.asObservable();

    constructor(private supabase: SupabaseService) {
        this.init();
    }

    private async init() {
        // Check if we're in the middle of an OAuth callback
        // First try URL params directly, then fall back to sessionStorage (preserved in main.ts before router stripped them)
        let urlHash = window.location.hash;
        let urlSearch = window.location.search;

        // Check sessionStorage for preserved OAuth params (set in main.ts before Angular router kicks in)
        const preservedHash = sessionStorage.getItem('supabase_oauth_hash');
        const preservedSearch = sessionStorage.getItem('supabase_oauth_search');

        if (preservedHash || preservedSearch) {
            urlHash = preservedHash || urlHash;
            urlSearch = preservedSearch || urlSearch;
            // Clear the preserved params immediately
            sessionStorage.removeItem('supabase_oauth_hash');
            sessionStorage.removeItem('supabase_oauth_search');
        }

        // Hash params (implicit flow) - tokens in URL hash
        const hashParams = new URLSearchParams(urlHash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const errorDescription = hashParams.get('error_description');

        // Query params (PKCE flow) - code in URL query string
        const queryParams = new URLSearchParams(urlSearch);
        const authCode = queryParams.get('code');

        // Log OAuth errors (keep this for production debugging)
        if (errorDescription) {
            console.error('OAuth error:', errorDescription);
        }

        // Handle PKCE flow (auth code exchange)
        if (authCode) {
            const { data, error } = await this.supabase.client.auth.exchangeCodeForSession(authCode);

            if (error) {
                console.error('OAuth code exchange error:', error.message);
            }

            if (data.session) {
                this.setUser(data.session);
                window.history.replaceState(null, '', window.location.pathname);
                return; // Exit early, we're done
            }
        }

        // Handle implicit flow (tokens directly in hash)
        if (accessToken && refreshToken) {
            const { data, error } = await this.supabase.client.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
            });

            if (error) {
                console.error('OAuth session error:', error.message);
            }

            if (data.session) {
                this.setUser(data.session);
                window.history.replaceState(null, '', window.location.pathname);
                return; // Exit early, we're done
            }
        }

        // No OAuth callback - check for existing session
        const { data: { session } } = await this.supabase.client.auth.getSession();

        if (session) {
            this.setUser(session);
        } else {
            // No session and not an OAuth callback, sign in anonymously
            await this.signInAnonymously();
        }

        this.supabase.client.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
                // If signed out, immediately sign back in anonymously
                await this.signInAnonymously();
            } else {
                this.setUser(session);
            }
        });
    }

    private setUser(session: AuthSession | null) {
        const user = session?.user ?? null;
        this._user.next(user);

        if (user) {
            this.fetchProfile(user.id);
        } else {
            this._profile.next(null);
        }
    }

    async signInAnonymously() {
        return this.supabase.client.auth.signInAnonymously();
    }

    async upgradeUser(email: string, password: string) {
        // Upgrades the current anonymous user to a permanent one
        let result = await this.supabase.client.auth.updateUser({
            email,
            password
        });

        if (result.error && result.error.message && result.error.message.includes('Lock')) {
            // Retry once after a delay
            await new Promise(resolve => setTimeout(resolve, 500));
            result = await this.supabase.client.auth.updateUser({
                email,
                password
            });
        }

        return result;
    }

    async signInWithGoogle() {
        return this.supabase.client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
    }

    async signUp(email: string, password: string) {
        // Legacy signUp (creates new user), might not be needed if we always upgrade
        // But keeping it for completeness or if upgrade fails
        return this.supabase.client.auth.signUp({
            email,
            password
        });
    }

    async signIn(email: string, password: string) {
        return this.supabase.client.auth.signInWithPassword({
            email,
            password
        });
    }

    async signOut() {
        return this.supabase.client.auth.signOut();
    }

    async updateRole(role: import('../models/classroom.interface').UserRole) {
        const user = this._user.value;
        if (!user) throw new Error('No user logged in to update role');

        const { error } = await this.supabase.client
            .from('profiles')
            .update({ role })
            .eq('id', user.id);

        if (error) throw error;

        // Update local state
        const currentProfile = this._profile.value;
        if (currentProfile) {
            this._profile.next({ ...currentProfile, role });
        } else {
            // Should verify this case, but likely we just fetch again
            this.fetchProfile(user.id);
        }
    }

    private async fetchProfile(userId: string) {
        const { data, error } = await this.supabase.client
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error fetching profile:', error);
            // If profile doesn't exist, we might need to create it, or handle it. 
            // For now, assume trigger handles creation or it exists.
            this._profile.next(null);
        } else {
            this._profile.next(data as import('../models/classroom.interface').Profile);
        }
    }

    get currentUser() {
        return this._user.value;
    }

    get currentProfile() {
        return this._profile.value;
    }

    get isAnonymous() {
        return this._user.value?.is_anonymous ?? false;
    }
}
