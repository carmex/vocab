import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedMaterialModule } from '../../../shared-material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GradebookService, StudentQuestDetail } from '../../../services/gradebook.service';
import { MatDialog } from '@angular/material/dialog';
import { AlertDialogComponent } from '../alert-dialog/alert-dialog.component';

export interface StudentDetailDialogData {
    questId: string;
    userId: string;
    studentName: string;
    questName: string;
}

@Component({
    selector: 'app-student-detail-dialog',
    standalone: true,
    imports: [CommonModule, SharedMaterialModule],
    templateUrl: './student-detail-dialog.component.html',
    styleUrls: ['./student-detail-dialog.component.scss']
})
export class StudentDetailDialogComponent {
    loading = true;
    detail: StudentQuestDetail | null = null;
    resetting = false;

    constructor(
        public dialogRef: MatDialogRef<StudentDetailDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: StudentDetailDialogData,
        private gradebookService: GradebookService,
        private snackBar: MatSnackBar,
        private dialog: MatDialog
    ) {
        this.loadDetail();
    }

    loadDetail(): void {
        this.loading = true;
        this.gradebookService.getStudentQuestDetail(
            this.data.questId,
            this.data.userId,
            this.data.studentName,
            this.data.questName
        ).subscribe({
            next: (detail) => {
                this.detail = detail;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading student detail:', err);
                this.loading = false;
            }
        });
    }

    formatDuration(seconds: number): string {
        if (!seconds) return '—';
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        if (mins > 0) {
            return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
        }
        return `${secs}s`;
    }

    getScoreClass(): string {
        if (!this.detail || this.detail.bestScore === null) return '';
        if (this.detail.bestScore >= 90) return 'score-mastered';
        if (this.detail.bestScore >= 60) return 'score-developing';
        return 'score-struggling';
    }

    copyMissedWords(): void {
        if (!this.detail?.missedWords.length) return;

        const text = this.detail.missedWords.join(', ');
        navigator.clipboard.writeText(text).then(() => {
            this.snackBar.open('Copied to clipboard!', 'Close', { duration: 2000 });
        }).catch((err) => {
            console.error('Failed to copy:', err);
            this.snackBar.open('Failed to copy', 'Close', { duration: 2000 });
        });
    }

    onReset(): void {
        const confirmDialog = this.dialog.open(AlertDialogComponent, {
            data: {
                title: 'Reset Progress?',
                message: `This will delete all quiz attempts for ${this.data.studentName} on "${this.data.questName}". They will be able to retake the quiz from scratch.`,
                confirmText: 'Reset',
                cancelText: 'Cancel'
            }
        });

        confirmDialog.afterClosed().subscribe((confirmed) => {
            if (confirmed) {
                this.performReset();
            }
        });
    }

    private performReset(): void {
        this.resetting = true;
        this.gradebookService.resetStudentProgress(this.data.questId, this.data.userId).subscribe({
            next: () => {
                this.snackBar.open('Progress reset successfully', 'Close', { duration: 3000 });
                this.dialogRef.close('reset');
            },
            error: (err) => {
                console.error('Error resetting progress:', err);
                this.snackBar.open('Failed to reset progress', 'Close', { duration: 3000 });
                this.resetting = false;
            }
        });
    }

    close(): void {
        this.dialogRef.close();
    }
}
