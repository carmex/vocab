import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedMaterialModule } from '../../shared-material.module';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatListModule } from '@angular/material/list';
import {
    GradebookService,
    GradebookData,
    GradebookStudent,
    GradebookQuest,
    GradebookCell
} from '../../services/gradebook.service';
import { StudentDetailDialogComponent } from '../dialogs/student-detail-dialog/student-detail-dialog.component';

@Component({
    selector: 'app-gradebook',
    standalone: true,
    imports: [CommonModule, SharedMaterialModule, FormsModule, MatListModule],
    templateUrl: './gradebook.component.html',
    styleUrls: ['./gradebook.component.scss']
})
export class GradebookComponent implements OnInit {
    @Input() classId!: string;

    loading = true;
    data: GradebookData | null = null;

    // Mobile view
    isMobile = false;
    selectedQuestId: string | null = null;

    constructor(
        private gradebookService: GradebookService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar
    ) { }

    ngOnInit(): void {
        this.checkMobile();
        window.addEventListener('resize', () => this.checkMobile());
        this.loadGradebook();
    }

    ngOnDestroy(): void {
        window.removeEventListener('resize', () => this.checkMobile());
    }

    checkMobile(): void {
        this.isMobile = window.innerWidth < 768;
        // Auto-select first quest on mobile
        if (this.isMobile && !this.selectedQuestId && this.data?.quests.length) {
            this.selectedQuestId = this.data.quests[0].id;
        }
    }

    loadGradebook(): void {
        if (!this.classId) return;
        this.loading = true;

        this.gradebookService.getGradebookData(this.classId).subscribe({
            next: (data) => {
                this.data = data;
                this.loading = false;
                // Auto-select first quest on mobile
                if (this.isMobile && data.quests.length > 0) {
                    this.selectedQuestId = data.quests[0].id;
                }
            },
            error: (err) => {
                console.error('Error loading gradebook:', err);
                this.loading = false;
            }
        });
    }

    getCell(studentId: string, questId: string): GradebookCell {
        return this.data?.cells[studentId]?.[questId] || {
            score: null,
            attemptCount: 0,
            status: 'not_started'
        };
    }

    getCellClass(status: string): string {
        switch (status) {
            case 'mastered': return 'cell-mastered';
            case 'developing': return 'cell-developing';
            case 'struggling': return 'cell-struggling';
            default: return 'cell-not-started';
        }
    }

    getScoreDisplay(cell: GradebookCell): string {
        if (cell.score === null) return '—';
        return `${cell.score}%`;
    }

    formatDuration(seconds: number): string {
        if (!seconds) return '—';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0) {
            return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
        }
        return `${secs}s`;
    }

    onCellClick(student: GradebookStudent, quest: GradebookQuest): void {
        const cell = this.getCell(student.id, quest.id);
        if (cell.status === 'not_started') return; // Nothing to show

        const dialogRef = this.dialog.open(StudentDetailDialogComponent, {
            width: '400px',
            data: {
                questId: quest.id,
                userId: student.id,
                studentName: student.name,
                questName: quest.listName
            }
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result === 'reset') {
                this.loadGradebook(); // Refresh after reset
            }
        });
    }

    // Mobile: Get students with their scores for the selected quest
    getMobileListData(): { student: GradebookStudent; cell: GradebookCell }[] {
        if (!this.data || !this.selectedQuestId) return [];

        return this.data.students.map(student => ({
            student,
            cell: this.getCell(student.id, this.selectedQuestId!)
        }));
    }

    getSelectedQuest(): GradebookQuest | null {
        if (!this.data || !this.selectedQuestId) return null;
        return this.data.quests.find(q => q.id === this.selectedQuestId) || null;
    }
}
