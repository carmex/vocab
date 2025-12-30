import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Observable, from, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

export interface GradebookStudent {
    id: string;
    name: string;
    email: string;
}

export interface GradebookQuest {
    id: string;
    listName: string;
    dueDate: Date | null;
    classAverage: number | null;
    mostMissedWord: string | null;
}

export interface GradebookCell {
    score: number | null; // null = not started
    attemptCount: number;
    status: 'not_started' | 'struggling' | 'developing' | 'mastered';
}

export interface GradebookData {
    students: GradebookStudent[];
    quests: GradebookQuest[];
    cells: { [studentId: string]: { [questId: string]: GradebookCell } };
}

export interface StudentQuestDetail {
    studentName: string;
    questName: string;
    bestScore: number | null;
    attemptCount: number;
    totalTimeSeconds: number;
    missedWords: string[];
}

@Injectable({
    providedIn: 'root'
})
export class GradebookService {

    constructor(private supabase: SupabaseService) { }

    /**
     * Fetches the full gradebook matrix for a classroom.
     */
    getGradebookData(classId: string): Observable<GradebookData> {
        return forkJoin({
            students: this.getClassStudents(classId),
            quests: this.getClassQuestsWithAggregates(classId)
        }).pipe(
            switchMap(({ students, quests }) => {
                // Fetch all results for this class's quests
                const questIds = quests.map(q => q.id);
                return this.getResultsMatrix(questIds, students).pipe(
                    map(cells => ({ students, quests, cells }))
                );
            })
        );
    }

    /**
     * Get students in a classroom (sorted by name).
     */
    private getClassStudents(classId: string): Observable<GradebookStudent[]> {
        const query = this.supabase.client
            .from('classroom_students')
            .select(`
                student_id,
                profiles!inner(id, full_name, username)
            `)
            .eq('classroom_id', classId)
            .eq('status', 'active')
            .not('student_id', 'is', null);

        return from(query).pipe(
            map(({ data, error }) => {
                if (error) throw error;
                return (data as any[] || [])
                    .map(row => ({
                        id: row.profiles.id,
                        name: row.profiles.full_name || row.profiles.username || 'Unknown',
                        email: '' // Email not stored in profiles table
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name));
            })
        );
    }

    /**
     * Get quests for a classroom with class average and most missed word.
     */
    private getClassQuestsWithAggregates(classId: string): Observable<GradebookQuest[]> {
        const query = this.supabase.client
            .from('quests')
            .select(`
                id,
                due_date,
                word_lists(name)
            `)
            .eq('classroom_id', classId)
            .order('due_date', { ascending: true });

        return from(query).pipe(
            switchMap(({ data, error }) => {
                if (error) throw error;
                const quests = data as any[] || [];

                // For each quest, get aggregates
                const aggregatePromises = quests.map(async (quest) => {
                    const [avgResult, missedResult] = await Promise.all([
                        this.getQuestClassAverage(quest.id),
                        this.getQuestMostMissedWord(quest.id)
                    ]);

                    return {
                        id: quest.id,
                        listName: quest.word_lists?.name || 'Unknown Quest',
                        dueDate: quest.due_date ? new Date(quest.due_date) : null,
                        classAverage: avgResult,
                        mostMissedWord: missedResult
                    };
                });

                return from(Promise.all(aggregatePromises));
            })
        );
    }

    /**
     * Get class average for a quest.
     */
    private async getQuestClassAverage(questId: string): Promise<number | null> {
        // Get best score per student, then average
        const { data, error } = await this.supabase.client
            .from('quiz_results')
            .select('user_id, score')
            .eq('quest_id', questId);

        if (error || !data || data.length === 0) return null;

        // Group by user and get best score per user
        const bestScores: { [userId: string]: number } = {};
        data.forEach((row: any) => {
            if (!bestScores[row.user_id] || row.score > bestScores[row.user_id]) {
                bestScores[row.user_id] = row.score;
            }
        });

        const scores = Object.values(bestScores);
        if (scores.length === 0) return null;

        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return Math.round(avg);
    }

    /**
     * Get most missed word for a quest.
     */
    private async getQuestMostMissedWord(questId: string): Promise<string | null> {
        const { data, error } = await this.supabase.client
            .rpc('get_quest_most_missed_word', { p_quest_id: questId });

        if (error || !data || data.length === 0) return null;
        return data[0]?.word_text || null;
    }

    /**
     * Build the results matrix: student -> quest -> cell data
     */
    private getResultsMatrix(
        questIds: string[],
        students: GradebookStudent[]
    ): Observable<{ [studentId: string]: { [questId: string]: GradebookCell } }> {
        if (questIds.length === 0 || students.length === 0) {
            return from(Promise.resolve({}));
        }

        const studentIds = students.map(s => s.id);

        const query = this.supabase.client
            .from('quiz_results')
            .select('quest_id, user_id, score')
            .in('quest_id', questIds)
            .in('user_id', studentIds);

        return from(query).pipe(
            map(({ data, error }) => {
                if (error) throw error;

                const results = data as any[] || [];
                const matrix: { [studentId: string]: { [questId: string]: GradebookCell } } = {};

                // Initialize empty cells
                studentIds.forEach(sid => {
                    matrix[sid] = {};
                    questIds.forEach(qid => {
                        matrix[sid][qid] = {
                            score: null,
                            attemptCount: 0,
                            status: 'not_started'
                        };
                    });
                });

                // Fill in results
                results.forEach((row: any) => {
                    const cell = matrix[row.user_id]?.[row.quest_id];
                    if (cell) {
                        cell.attemptCount++;
                        if (cell.score === null || row.score > cell.score) {
                            cell.score = row.score;
                        }
                    }
                });

                // Calculate status based on best score
                studentIds.forEach(sid => {
                    questIds.forEach(qid => {
                        const cell = matrix[sid][qid];
                        if (cell.score !== null) {
                            if (cell.score >= 90) {
                                cell.status = 'mastered';
                            } else if (cell.score >= 60) {
                                cell.status = 'developing';
                            } else {
                                cell.status = 'struggling';
                            }
                        }
                    });
                });

                return matrix;
            })
        );
    }

    /**
     * Get detailed student quest data for the popover.
     */
    getStudentQuestDetail(
        questId: string,
        userId: string,
        studentName: string,
        questName: string
    ): Observable<StudentQuestDetail> {
        return from(
            this.supabase.client.rpc('get_student_quest_stats', {
                p_quest_id: questId,
                p_user_id: userId
            })
        ).pipe(
            switchMap(({ data, error }) => {
                if (error) throw error;

                const stats = data?.[0] || {
                    best_score: null,
                    attempt_count: 0,
                    total_time_seconds: 0,
                    last_attempt_id: null
                };

                // Get missed words from the last attempt
                if (stats.last_attempt_id) {
                    return from(
                        this.supabase.client
                            .from('quiz_result_missed')
                            .select('word_text')
                            .eq('result_id', stats.last_attempt_id)
                    ).pipe(
                        map(({ data: missedData }) => ({
                            studentName,
                            questName,
                            bestScore: stats.best_score,
                            attemptCount: Number(stats.attempt_count),
                            totalTimeSeconds: Number(stats.total_time_seconds),
                            missedWords: (missedData || []).map((m: any) => m.word_text)
                        }))
                    );
                }

                return from(Promise.resolve({
                    studentName,
                    questName,
                    bestScore: stats.best_score,
                    attemptCount: Number(stats.attempt_count),
                    totalTimeSeconds: Number(stats.total_time_seconds),
                    missedWords: []
                }));
            })
        );
    }

    /**
     * Reset a student's progress for a quest.
     */
    resetStudentProgress(questId: string, userId: string): Observable<void> {
        return from(
            this.supabase.client.rpc('reset_student_quest_progress', {
                p_quest_id: questId,
                p_user_id: userId
            })
        ).pipe(
            map(({ error }) => {
                if (error) throw error;
            })
        );
    }
}
