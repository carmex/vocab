import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Observable, from, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ListType } from '../models/list-type.enum';

export interface WordList {
    id: string;
    name: string;
    description: string;
    creator_id: string;
    is_public: boolean;
    list_type: string;
    created_at: string;
}

export interface ListShare {
    id: string;
    word_list_id: string;
    user_id: string;
    last_accessed: string;
    word_lists?: WordList & { list_words: { count: number }[] }; // Joined data with count
    quiz_progress?: { state: any }; // Merged progress
    missed_word_count?: number; // Total missed words
}

export interface ListDetails {
    metadata: WordList;
    wordCount: number;
    missedCount: number;
    hasQuizProgress: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class ListService {

    constructor(
        private supabase: SupabaseService,
        private auth: AuthService
    ) { }

    /**
     * Fetches "My Lists" by querying list_shares joined with word_lists.
     * Ordered by last_accessed descending.
     */
    getMyLists(userId?: string): Observable<ListShare[]> {
        userId = userId || this.auth.currentUser?.id;

        // 1. Fetch List Shares with Word Counts
        const sharesQuery = this.supabase.client
            .from('list_shares')
            .select('*, word_lists(*, list_words(count))')
            .order('last_accessed', { ascending: false });

        // 2. Fetch Quiz Progress for this user (Main pass only for progress bar)
        const progressQuery = userId
            ? this.supabase.client.from('quiz_progress').select('list_id, state').eq('user_id', userId).eq('pass_type', 'main')
            : Promise.resolve({ data: [], error: null });

        // 3. Fetch Total Missed Words Count for this user
        const missedQuery = userId
            ? this.supabase.client.from('user_missed_words').select('list_id').eq('user_id', userId)
            : Promise.resolve({ data: [], error: null });

        return forkJoin({
            shares: from(sharesQuery),
            progress: from(progressQuery),
            missed: from(missedQuery)
        }).pipe(
            map(({ shares, progress, missed }) => {
                if (shares.error) throw shares.error;
                if (progress.error) throw progress.error;
                if (missed.error) throw missed.error;

                const progressMap = new Map(progress.data?.map((p: any) => [p.list_id, p]) || []);

                // Count missed words per list
                const missedCounts = new Map<string, number>();
                missed.data?.forEach((m: any) => {
                    missedCounts.set(m.list_id, (missedCounts.get(m.list_id) || 0) + 1);
                });

                return (shares.data as any[]).map(share => ({
                    ...share,
                    quiz_progress: progressMap.get(share.word_list_id),
                    missed_word_count: missedCounts.get(share.word_list_id) || 0
                })) as ListShare[];
            })
        );
    }

    /**
     * Fetches details for a specific list using Promise.all (forkJoin in RxJS)
     * to fetch metadata, counts, and progress in parallel.
     */
    getListDetails(listId: string): Observable<ListDetails> {
        const userId = this.auth.currentUser?.id;
        if (!userId) throw new Error('User not logged in');

        // 1. Fetch List Metadata
        const metadataPromise = this.supabase.client
            .from('word_lists')
            .select('*')
            .eq('id', listId)
            .single();

        // 2. Fetch Word Count
        const wordCountPromise = this.supabase.client
            .from('list_words')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', listId);

        // 3. Fetch Missed Count for this user/list
        const missedCountPromise = this.supabase.client
            .from('user_missed_words')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('list_id', listId);

        // 4. Check Quiz Progress existence
        const progressPromise = this.supabase.client
            .from('quiz_progress')
            .select('id')
            .eq('user_id', userId)
            .eq('list_id', listId)
            .maybeSingle();

        return forkJoin({
            metadata: from(metadataPromise),
            wordCount: from(wordCountPromise),
            missedCount: from(missedCountPromise),
            progress: from(progressPromise)
        }).pipe(
            map(({ metadata, wordCount, missedCount, progress }) => {
                if (metadata.error) throw metadata.error;

                return {
                    metadata: metadata.data as WordList,
                    wordCount: wordCount.count || 0,
                    missedCount: missedCount.count || 0,
                    hasQuizProgress: !!progress.data
                };
            })
        );
    }

    /**
     * Creates a new list using the RPC `create_new_list`.
     */
    createList(name: string, description: string, isPublic: boolean, listType: ListType = ListType.WORD_DEFINITION): Observable<string> {
        console.log('ListService.createList called with:', { name, description, isPublic, listType });
        const rpc = this.supabase.client
            .rpc('create_new_list', {
                p_name: name,
                p_description: description,
                p_is_public: isPublic,
                p_list_type: listType
            });

        return from(rpc).pipe(
            map(({ data, error }) => {
                console.log('create_new_list RPC response:', { data, error });
                if (error) {
                    console.error('create_new_list RPC error:', error);
                    throw error;
                }
                return data as string;
            })
        );
    }

    /**
     * Updates an existing list's metadata.
     */
    updateList(listId: string, name: string, description: string, isPublic: boolean): Observable<void> {
        const query = this.supabase.client
            .from('word_lists')
            .update({ name, description, is_public: isPublic })
            .eq('id', listId);

        return from(query).pipe(
            map(({ error }) => {
                if (error) throw error;
            })
        );
    }

    /**
     * Syncs words for a list: inserts new, updates existing, deletes removed.
     */
    syncWords(listId: string, words: { id?: string, word: string, definition: string, imageUrl?: string }[], deletedWordIds: string[]): Observable<void> {
        // 1. Delete removed words
        const deletePromise = deletedWordIds.length > 0
            ? this.supabase.client.from('list_words').delete().in('id', deletedWordIds)
            : Promise.resolve({ error: null });

        // 2. Upsert words (Supabase upsert works if ID is present)
        // Strategy: Split into inserts and updates.
        const toInsert = words.filter(w => !w.id).map(w => ({
            list_id: listId,
            word: w.word,
            definition: w.definition || null,
            image_url: w.imageUrl || null
        }));
        const toUpdate = words.filter(w => w.id);

        const insertPromise = toInsert.length > 0
            ? this.supabase.client.from('list_words').insert(toInsert)
            : Promise.resolve({ error: null });

        // For updates, use upsert with the ID.
        const upsertRows = toUpdate.map(w => ({
            id: w.id,
            list_id: listId,
            word: w.word,
            definition: w.definition || null,
            image_url: w.imageUrl || null
        }));
        const updatePromise = upsertRows.length > 0
            ? this.supabase.client.from('list_words').upsert(upsertRows)
            : Promise.resolve({ error: null });

        return forkJoin([
            from(deletePromise),
            from(insertPromise),
            from(updatePromise)
        ]).pipe(
            map(([del, ins, upd]) => {
                if (del.error) throw del.error;
                if (ins.error) throw ins.error;
                if (upd.error) throw upd.error;
            })
        );
    }

    /**
     * Fetches public lists with pagination.
     */
    getPublicLists(page: number, pageSize: number): Observable<{ data: WordList[], count: number }> {
        const start = page * pageSize;
        const end = start + pageSize - 1;

        const query = this.supabase.client
            .from('word_lists')
            .select('*', { count: 'exact' })
            .eq('is_public', true)
            .range(start, end)
            .order('created_at', { ascending: false });

        return from(query).pipe(
            map(({ data, count, error }) => {
                if (error) throw error;
                return { data: data as WordList[], count: count || 0 };
            })
        );
    }

    /**
     * Subscribes to a public list using the RPC `subscribe_to_list`.
     */
    subscribeToList(listId: string): Observable<void> {
        const rpc = this.supabase.client
            .rpc('subscribe_to_list', { p_list_id: listId });

        return from(rpc).pipe(
            map(({ error }) => {
                if (error) throw error;
            })
        );
    }

    getSampleWords(listId: string): Observable<any[]> {
        const query = this.supabase.client
            .from('list_words')
            .select('word, definition')
            .eq('list_id', listId)
            .limit(5);

        return from(query).pipe(
            map(({ data, error }) => {
                if (error) throw error;
                return data || [];
            })
        );
    }

    /**
     * Adds multiple words to a list.
     */
    addWords(listId: string, words: { word: string, definition: string, imageUrl?: string }[]): Observable<void> {
        const rows = words.map(w => ({
            list_id: listId,
            word: w.word,
            definition: w.definition || null,
            image_url: w.imageUrl || null
        }));

        const query = this.supabase.client
            .from('list_words')
            .insert(rows);

        return from(query).pipe(
            map(({ error }) => {
                if (error) throw error;
            })
        );
    }

    getWords(listId: string): Observable<any[]> {
        const query = this.supabase.client
            .from('list_words')
            .select('*')
            .eq('list_id', listId);

        return from(query).pipe(
            map(({ data, error }) => {
                if (error) throw error;
                return data || [];
            })
        );
    }
}
