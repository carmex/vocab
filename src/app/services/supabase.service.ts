import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class SupabaseService {
    public client: SupabaseClient;

    constructor() {
        const { url, key } = environment.supabase;

        if (!url || !key || url === 'YOUR_SUPABASE_URL' || key === 'YOUR_SUPABASE_KEY') {
            const msg = 'Supabase configuration is missing. Please configure src/environments/environment.ts with your actual Supabase URL and Key.';
            console.error(msg);
            alert(msg);
            throw new Error(msg);
        }

        this.client = createClient(url, key, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
    }

    async uploadUserRecording(blob: Blob, path: string): Promise<{ data: any; error: any }> {
        return this.client.storage
            .from('user-recordings')
            .upload(path, blob, {
                contentType: 'audio/webm',
                upsert: true
            });
    }
}
