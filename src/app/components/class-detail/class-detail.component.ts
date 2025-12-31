import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { SharedMaterialModule } from '../../shared-material.module';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { ClassroomService } from '../../services/classroom.service';
import { Classroom } from '../../models/classroom.interface';
import { Quest } from '../../models/quest.interface';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RosterComponent } from '../roster/roster.component';
import { TopNavComponent } from '../top-nav/top-nav.component';
import { EditQuestDialogComponent } from '../dialogs/edit-quest-dialog/edit-quest-dialog.component';
import { AlertDialogComponent } from '../dialogs/alert-dialog/alert-dialog.component';
import { AssignQuestDialogComponent } from '../dialogs/assign-quest-dialog/assign-quest-dialog.component';
import { GradebookComponent } from '../gradebook/gradebook.component';

@Component({
    selector: 'app-class-detail',
    standalone: true,
    imports: [
        CommonModule,
        SharedMaterialModule,
        MatTabsModule,
        MatTableModule,
        MatMenuModule,
        RosterComponent,
        TopNavComponent,
        GradebookComponent
    ],
    providers: [DatePipe],
    templateUrl: './class-detail.component.html',
    styleUrls: ['./class-detail.component.scss']
})
export class ClassDetailComponent implements OnInit {
    classId: string | null = null;
    classroom: Classroom | null = null;
    loading = true;

    // Assignments Tab
    quests: Quest[] = [];
    displayedColumns: string[] = ['name', 'dueDate', 'completed', 'actions'];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private supabase: SupabaseService,
        private classroomService: ClassroomService,
        private dialog: MatDialog,
        private snakeBar: MatSnackBar
    ) { }

    goBack() {
        this.router.navigate(['/dashboard']);
    }

    ngOnInit() {
        this.classId = this.route.snapshot.paramMap.get('id');
        if (this.classId) {
            this.fetchClassroom();
            this.fetchQuests();
        }
    }

    fetchClassroom() {
        if (!this.classId) return;
        this.loading = true;
        this.classroomService.getClassroomDetails(this.classId).subscribe({
            next: (data) => {
                this.classroom = data;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error fetching classroom:', err);
                this.loading = false;
            }
        });
    }

    fetchQuests() {
        if (!this.classId) return;
        this.classroomService.getClassQuests(this.classId).subscribe({
            next: (data) => {
                this.quests = data;
            },
            error: (err) => console.error('Error fetching quests:', err)
        });
    }

    onEditQuest(quest: Quest) {
        const dialogRef = this.dialog.open(EditQuestDialogComponent, {
            width: '400px',
            data: { quest }
        });

        dialogRef.afterClosed().subscribe(newDate => {
            if (newDate) {
                this.classroomService.updateQuest(quest.id!, { due_date: newDate }).subscribe({
                    next: () => {
                        this.snakeBar.open('Assignment updated', 'Close', { duration: 3000 });
                        this.fetchQuests();
                    },
                    error: (err) => {
                        console.error('Error updating quest:', err);
                        this.snakeBar.open('Error updating assignment', 'Close', { duration: 3000 });
                    }
                });
            }
        });
    }

    onDeleteQuest(quest: Quest) {
        const dialogRef = this.dialog.open(AlertDialogComponent, {
            data: {
                title: 'Delete Assignment?',
                message: `Are you sure you want to delete "${quest.list_name}"? This will remove it from all students' dashboards. Validated completions will be preserved in analytics (but unlinked).`,
                confirmText: 'Delete',
                cancelText: 'Cancel'
            }
        });

        dialogRef.afterClosed().subscribe(confirmed => {
            if (confirmed) {
                this.classroomService.deleteQuest(quest.id!).subscribe({
                    next: () => {
                        this.snakeBar.open('Assignment deleted', 'Close', { duration: 3000 });
                        this.fetchQuests();
                    },
                    error: (err) => {
                        console.error('Error deleting quest:', err);
                        this.snakeBar.open('Error deleting assignment', 'Close', { duration: 3000 });
                    }
                });
            }
        });
    }

    onCreateQuest() {
        if (!this.classroom) return;

        const dialogRef = this.dialog.open(AssignQuestDialogComponent, {
            width: '500px',
            data: { classId: this.classroom.id, className: this.classroom.name }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && result.count > 0) {
                const count = result.studentCount;
                const msg = count === 1 ? 'Quest created for 1 student!' : `Quest created for ${count} students!`;
                this.snakeBar.open(msg, 'Close', { duration: 3000 });
                this.fetchQuests();
            }
        });
    }
}
