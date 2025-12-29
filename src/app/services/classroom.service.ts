import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Quest } from '../models/quest.interface';
import { Classroom } from '../models/classroom.interface';

@Injectable({
    providedIn: 'root'
})
export class ClassroomService {

    constructor(private supabase: SupabaseService) { }

    /**
     * Fetches classrooms for a given teacher.
     */
    getClassrooms(teacherId: string): Observable<Classroom[]> {
        const query = this.supabase.client
            .from('classrooms')
            .select('*, classroom_students(count)') // Select count from joined table
            .eq('teacher_id', teacherId)
            .order('created_at', { ascending: false });

        return from(query).pipe(
            map(({ data, error }) => {
                if (error) throw error;
                // Map the result to include student_count flattened
                return (data as any[]).map(row => ({
                    ...row,
                    student_count: row.classroom_students?.[0]?.count || 0
                })) as Classroom[];
            })
        );
    }

    /**
     * Fetches a single classroom details (including student count).
     */
    getClassroomDetails(classId: string): Observable<Classroom> {
        const query = this.supabase.client
            .from('classrooms')
            .select('*, classroom_students(count)', { count: 'exact' })
            .eq('id', classId)
            .single();

        return from(query).pipe(
            map(({ data, error }) => {
                if (error) throw error;
                return {
                    ...data,
                    student_count: data.classroom_students?.[0]?.count || 0
                } as Classroom;
            })
        );
    }

    /**
     * Creates a new Quest (Assignment).
     */
    createQuest(quest: Quest): Observable<Quest> {
        const query = this.supabase.client
            .from('quests')
            .insert(quest)
            .select()
            .single();

        return from(query).pipe(
            map(({ data, error }) => {
                if (error) throw error;
                return data as Quest;
            })
        );
    }

    /**
     * Fetches quests assigned to the current student.
     * Joins with word_lists for metadata and quest_completions for status.
     * ONLY returns quests where the user is an active student in the class.
     */
    getStudentQuests(studentId: string): Observable<Quest[]> {
        // We need to ensure we only get quests where the user is a STUDENT.
        // Teachers have RLS access to quests they created, so a simple select returns them too.
        // We filter by joining classrooms -> classroom_students.

        const query = this.supabase.client
            .from('quests')
            .select(`
                *, 
                word_lists(name, description), 
                quest_completions(id, completed_at),
                classrooms!inner(
                    classroom_students!inner(student_id)
                )
            `)
            .eq('classrooms.classroom_students.student_id', studentId)
            .order('due_date', { ascending: true });

        return from(query).pipe(
            map(({ data, error }) => {
                if (error) throw error;
                // Process to add is_completed flag
                return (data as any[]).map(q => ({
                    ...q,
                    is_completed: q.quest_completions && q.quest_completions.length > 0,
                    completed_at: q.quest_completions?.[0]?.completed_at
                })) as Quest[];
            })
        );
    }

    /**
     * Marks a quest as complete for the current user.
     */
    completeQuest(questId: string, userId: string, score?: number): Observable<void> {
        const row = {
            quest_id: questId,
            user_id: userId,
            score: score
        };

        const query = this.supabase.client
            .from('quest_completions')
            .insert(row);

        return from(query).pipe(
            map(({ error }) => {
                // Ignore unique constraint error if already completed?
                // Or just let it throw.
                if (error && error.code !== '23505') throw error; // 23505 is unique violation
            })
        );
    }

    /**
     * Fetches all quests for a specific classroom (Teacher View).
     * Includes completion count.
     */
    getClassQuests(classId: string): Observable<Quest[]> {
        const query = this.supabase.client
            .from('quests')
            .select(`
                *,
                word_lists(name),
                quest_completions(count)
            `, { count: 'exact' })
            .eq('classroom_id', classId)
            .order('due_date', { ascending: true });

        return from(query).pipe(
            map(({ data, error }) => {
                if (error) throw error;
                return (data as any[]).map(q => ({
                    ...q,
                    list_name: q.word_lists?.name,
                    completion_count: q.quest_completions?.[0]?.count || 0
                })) as Quest[];
            })
        );
    }

    /**
     * Updates an existing quest (e.g. changing due date).
     */
    updateQuest(questId: string, updates: Partial<Quest>): Observable<void> {
        const query = this.supabase.client
            .from('quests')
            .update(updates)
            .eq('id', questId);

        return from(query).pipe(
            map(({ error }) => {
                if (error) throw error;
            })
        );
    }

    /**
     * Deletes a quest.
     */
    deleteQuest(questId: string): Observable<void> {
        const query = this.supabase.client
            .from('quests')
            .delete()
            .eq('id', questId);

        return from(query).pipe(
            map(({ error }) => {
                if (error) throw error;
            })
        );
    }
}
