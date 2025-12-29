export type UserRole = 'teacher' | 'student';

export interface Classroom {
    id: string;
    teacher_id: string;
    name: string;
    grade_level?: string;
    code: string;
    created_at: string;
}

export interface ClassroomStudent {
    id: string;
    classroom_id: string;
    student_id: string | null;
    invited_email: string | null;
    status: 'active' | 'pending';
    created_at: string;
    // Optional joined fields (if we join with profiles)
    student_name?: string;
    student_email?: string;
}

export interface Profile {
    id: string;
    email?: string;
    role?: UserRole;
    // other fields as needed
}
