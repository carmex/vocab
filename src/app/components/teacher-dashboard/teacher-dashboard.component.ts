import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedMaterialModule } from '../../shared-material.module';
import { MatDialog } from '@angular/material/dialog';
import { CreateClassModalComponent } from '../create-class-modal/create-class-modal.component';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { Classroom } from '../../models/classroom.interface';
import { Router } from '@angular/router';

@Component({
    selector: 'app-teacher-dashboard',
    standalone: true,
    imports: [CommonModule, SharedMaterialModule],
    templateUrl: './teacher-dashboard.component.html',
    styleUrls: ['./teacher-dashboard.component.scss']
})
export class TeacherDashboardComponent implements OnInit {
    classrooms: Classroom[] = [];
    loading = true;

    constructor(
        private dialog: MatDialog,
        private auth: AuthService,
        private supabase: SupabaseService,
        private router: Router
    ) { }

    ngOnInit() {
        this.fetchClassrooms();
    }

    async fetchClassrooms() {
        this.loading = true;
        const { data, error } = await this.supabase.client
            .from('classrooms')
            .select('*')
            .eq('teacher_id', this.auth.currentUser!.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching classrooms:', error);
        } else {
            this.classrooms = data || [];
        }
        this.loading = false;
    }

    createClass() {
        const dialogRef = this.dialog.open(CreateClassModalComponent, {
            width: '500px'
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.fetchClassrooms(); // Refresh list
            }
        });
    }

    openClass(id: string) {
        this.router.navigate(['/class', id]);
    }
}
