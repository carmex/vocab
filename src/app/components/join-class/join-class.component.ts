import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedMaterialModule } from '../../shared-material.module';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';
import { Classroom } from '../../models/classroom.interface';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-join-class',
  standalone: true,
  imports: [CommonModule, SharedMaterialModule, MatProgressSpinnerModule],
  template: `
    <div class="join-container">
      <div *ngIf="loading" class="loading">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Checking class code...</p>
      </div>

      <div *ngIf="!loading && classroom" class="confirm-card">
        <h2>Join Class?</h2>
        <div class="class-info">
          <mat-icon class="class-icon">school</mat-icon>
          <h3>{{ classroom.name }}</h3>
          <p>{{ classroom.grade_level }}</p>
        </div>
        
        <p class="teacher-info">Teacher: {{ teacherName || 'Unknown' }}</p>

        <div class="actions">
          <button mat-stroked-button (click)="cancel()">No, Cancel</button>
          <button mat-raised-button color="primary" (click)="confirmJoin()" [disabled]="joining">
            {{ joining ? 'Joining...' : 'Yes, Join Class' }}
          </button>
        </div>
      </div>

      <div *ngIf="!loading && !classroom && error" class="error-card">
        <mat-icon color="warn">error</mat-icon>
        <h3>Available Class Not Found</h3>
        <p>{{ error }}</p>
        <button mat-raised-button color="primary" (click)="cancel()">Go Home</button>
      </div>
    </div>
  `,
  styles: [`
    .join-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 80vh;
      padding: 16px;
    }
    .confirm-card, .error-card {
      background: white;
      padding: 32px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    .class-info {
      margin: 24px 0;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
    }
    .class-icon { font-size: 48px; height: 48px; width: 48px; margin-bottom: 8px; color: #3f51b5; }
    .actions { display: flex; justify-content: space-between; gap: 16px; margin-top: 24px; }

    /* Dark Mode */
    :host-context(body.dark-mode) .confirm-card,
    :host-context(body.dark-mode) .error-card {
        background: #2a2a2a;
        color: #e0e0e0;
    }
    :host-context(body.dark-mode) .class-info {
        background: #333;
    }
    :host-context(body.dark-mode) .class-info h3 { color: #fff; }
    :host-context(body.dark-mode) .class-info p { color: #ccc; }
    :host-context(body.dark-mode) .teacher-info { color: #aaa; }
    :host-context(body.dark-mode) .class-icon { color: #7986cb; }
  `]
})
export class JoinClassComponent implements OnInit {
  code: string | null = null;
  classroom: Classroom | null = null;
  teacherName: string | null = null;
  loading = true;
  joining = false;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabase: SupabaseService,
    public auth: AuthService
  ) { }

  ngOnInit() {
    this.code = this.route.snapshot.paramMap.get('code');
    if (this.code) {
      this.checkCode();
    } else {
      this.error = "No code provided";
      this.loading = false;
    }
  }

  async checkCode() {
    this.loading = true;
    // We fetch current user. If not logged in, we might need to prompt login.
    // Ideally user is already logged in or we redirect to login with return URL.
    // AuthGuard on this route? Or handle it here.

    // Check if class exists
    const limits = await this.supabase.client
      .from('classrooms')
      .select('*, profiles:teacher_id(email)') // simplified: relying on RLS? 
      // If RLS prevents reading classrooms I am not in, this will fail for new students.
      // We need a function `get_class_by_code` or public RLS for classrooms (read-only for code lookup?)
      // Migration added "Students can view classes they belong to" but not generic lookup.
      // We probably need a secure function to lookup minimal class info by code.
      // Or assume we use `generate_share_code` logic logic? 
      // Let's rely on an RPC or relaxing RLS for "code lookup". 
      // Actually, my migration Step 34 didn't add a specific policy for "anyone with code can view".
      // I need to fix that or use a function.
      // I'll assume I need to fix RLS or use a function. 
      // For now, let's try to query. If empty, it's RLS blocking.
      .eq('code', this.code)
      .single();

    // Actually, I should create an RPC `get_classroom_by_code` to be safe and bypass RLS for this specific purpose.
    // I'll create a SQL migration for this function right after this.
    // For now, I'll write the frontend assuming the function exists: `get_classroom_by_code(code)`.

    const { data, error } = await this.supabase.client.rpc('get_classroom_by_code', { p_code: this.code });

    if (error || !data || data.length === 0) {
      this.error = "Class not found or invalid code.";
      this.classroom = null;
    } else {
      // RPC returns array usually
      this.classroom = data[0] || data;
      this.teacherName = (this.classroom as any).teacher_email || 'Teacher'; // simplified
    }
    this.loading = false;
  }

  cancel() {
    this.router.navigate(['/dashboard']);
  }

  async confirmJoin() {
    if (!this.classroom || !this.auth.currentUser) {
      if (!this.auth.currentUser) {
        // Redirect to login
        this.router.navigate(['/login'], { queryParams: { returnUrl: '/join/' + this.code } });
        return;
      }
      return;
    }

    this.joining = true;

    // Join logic: Insert into classroom_students
    const { error } = await this.supabase.client
      .from('classroom_students')
      .insert({
        classroom_id: this.classroom.id,
        student_id: this.auth.currentUser.id,
        status: 'active'
      });

    // Handle duplicate (already joined) gracefully
    if (error) {
      if (error.code === '23505') { // Unique violation
        const { error: updateError } = await this.supabase.client
          .from('classroom_students')
          .update({ status: 'active' }) // Ensure active if pending
          .eq('classroom_id', this.classroom.id)
          .eq('student_id', this.auth.currentUser.id);

        if (!updateError) {
          this.router.navigate(['/dashboard']);
          return;
        }
      }
      console.error('Join error:', error);
      this.error = "Could not join class. " + error.message;
      this.joining = false;
    } else {
      // Success
      this.router.navigate(['/dashboard']);
    }
  }
}
