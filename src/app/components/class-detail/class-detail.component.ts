import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedMaterialModule } from '../../shared-material.module';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { Classroom } from '../../models/classroom.interface';
import { MatTabsModule } from '@angular/material/tabs';
import { RosterComponent } from '../roster/roster.component';
import { TopNavComponent } from '../top-nav/top-nav.component';

@Component({
    selector: 'app-class-detail',
    standalone: true,
    imports: [CommonModule, SharedMaterialModule, MatTabsModule, RosterComponent, TopNavComponent],
    templateUrl: './class-detail.component.html',
    styleUrls: ['./class-detail.component.scss']
})
export class ClassDetailComponent implements OnInit {
    classId: string | null = null;
    classroom: Classroom | null = null;
    loading = true;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private supabase: SupabaseService
    ) { }

    goBack() {
        this.router.navigate(['/dashboard']);
    }

    ngOnInit() {
        this.classId = this.route.snapshot.paramMap.get('id');
        if (this.classId) {
            this.fetchClassroom();
        }
    }

    async fetchClassroom() {
        this.loading = true;
        const { data, error } = await this.supabase.client
            .from('classrooms')
            .select('*')
            .eq('id', this.classId)
            .single();

        if (error) {
            console.error('Error fetching classroom:', error);
            // Handle error, maybe redirect
        } else {
            this.classroom = data;
        }
        this.loading = false;
    }
}
