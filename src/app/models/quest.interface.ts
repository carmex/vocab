export interface Quest {
    id?: string;
    classroom_id: string;
    list_id: string;
    due_date?: Date;
    instructions?: string;
    created_at?: Date;
    // Optional joined fields
    classroom_name?: string;
    list_name?: string;
    word_lists?: {
        name: string;
        description: string;
    };
    // Completion status
    is_completed?: boolean;
    completed_at?: Date;
    completion_count?: number;
}
