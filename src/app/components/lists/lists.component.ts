import { Component, OnInit } from '@angular/core';
import { ListService, ListShare } from '../../services/list.service';
import { AuthService } from '../../services/auth.service';
import { Observable, of, forkJoin, timer } from 'rxjs';
import { catchError, filter, switchMap, map, startWith } from 'rxjs/operators';
import { Router, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ListTypeDialogComponent } from '../dialogs/list-type-dialog/list-type-dialog.component';
import { ListType } from '../../models/list-type.enum';
import { ClassroomService } from '../../services/classroom.service';
import { Quest } from '../../models/quest.interface';
import { ShareDialogComponent } from '../dialogs/share-dialog.component';
import { QrScannerDialogComponent } from '../dialogs/qr-scanner-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { SharedMaterialModule } from '../../shared-material.module';
import { RouterModule } from '@angular/router';
import { TopNavComponent } from '../top-nav/top-nav.component';

@Component({
    selector: 'app-lists',
    templateUrl: './lists.component.html',
    styleUrls: ['./lists.component.scss'],
    standalone: true,
    imports: [CommonModule, SharedMaterialModule, RouterModule, TopNavComponent]
})
export class ListsComponent implements OnInit {
    myLists$: Observable<ListShare[]>;


    // We no longer need to check for teacher view here, as this component is dedicated to lists/quests.
    // However, teachers can also have lists, so we display them for everyone.

    constructor(
        private listService: ListService,
        private classroomService: ClassroomService,
        private router: Router,
        private route: ActivatedRoute,
        public auth: AuthService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar
    ) {
        // Wait for auth to be ready before fetching lists
        this.myLists$ = this.auth.user$.pipe(
            filter(user => !!user),
            switchMap(user =>
                // Poll every 5 seconds for updates if we have pending items?
                // For now, just load once. We can add polling if "generating" is active later.
                // Or better: use a timer that refreshes stats.
                timer(0, 5000).pipe(
                    switchMap(() => this.listService.getMyLists(user!.id)),
                    switchMap(lists => {
                        // Get IDs of Sight Word or Sentences lists
                        const eligibleListIds = lists
                            .filter(l => l.word_lists?.list_type === ListType.SIGHT_WORDS || l.word_lists?.list_type === ListType.SENTENCES)
                            .map(l => l.word_list_id);

                        if (eligibleListIds.length === 0) return of(lists);

                        // Fetch audio stats
                        return this.listService.getListAudioStats(eligibleListIds).then(stats => {
                            const statsMap = new Map(stats.map(s => [s.list_id, s]));

                            return lists.map(list => {
                                const s = statsMap.get(list.word_list_id);
                                if (!s) return list;

                                // Parse stats
                                const total = s.total_words || 0;
                                const completed = s.completed_words || 0;
                                const failed = s.failed_words || 0;
                                const pending = s.pending_words || 0;
                                const queuePos = s.queue_position || 0;

                                let progress = 100;
                                if (total > 0) {
                                    progress = Math.floor(((completed + failed) / total) * 100);
                                }

                                // State: 'generating' if pending > 0
                                const isGenerating = pending > 0;

                                return {
                                    ...list,
                                    audioStats: {
                                        progress,
                                        isGenerating,
                                        queuePosition: queuePos,
                                        estimatedWaitSeconds: Math.ceil(queuePos * 8)
                                    }
                                };
                            });
                        });
                    })
                )
            ),
            catchError(err => {
                console.error('Error fetching lists:', err);
                return of([]);
            })
        );


    }

    ngOnInit(): void {
    }

    onCreateList() {
        const dialogRef = this.dialog.open(ListTypeDialogComponent, {
            width: '600px'
        });

        dialogRef.afterClosed().subscribe((result: ListType | undefined) => {
            if (result) {
                this.router.navigate(['/list/new'], { queryParams: { type: result } });
            }
        });
    }

    onStudy(listId: string) {
        this.router.navigate(['/quiz', listId, 'main']);
    }

    onEdit(listId: string) {
        this.router.navigate(['/list', listId, 'edit']);
    }

    onReview(listId: string) {
        this.router.navigate(['/quiz', listId, 'review']);
    }

    onAssign(listId: string) {
        import('../dialogs/assign-quest-dialog/assign-quest-dialog.component').then(({ AssignQuestDialogComponent }) => {
            this.dialog.open(AssignQuestDialogComponent, {
                width: '500px',
                data: { listId }
            });
        });
    }

    onMarketplace() {
        this.router.navigate(['/marketplace']);
    }

    onLogin() {
        this.router.navigate(['/login']);
    }

    onShare(listId: string, listName: string | undefined) {
        if (!listName) return;

        this.listService.generateShareCode(listId).subscribe({
            next: (code) => {
                this.dialog.open(ShareDialogComponent, {
                    width: '400px',
                    data: { listName, shareCode: code }
                });
            },
            error: (err) => console.error('Error generating share code:', err)
        });
    }

    onScanQr() {
        const dialogRef = this.dialog.open(QrScannerDialogComponent, {
            width: '100%',
            maxWidth: '500px',
            height: 'auto',
            panelClass: 'scanner-dialog'
        });

        dialogRef.afterClosed().subscribe((result: string | undefined) => {
            if (result) {
                // Check if it is a valid URL for this app
                if (result.includes('/share/')) {
                    const code = result.split('/share/')[1];
                    this.router.navigate(['/share', code]);
                } else {
                    alert('Invalid QR Code');
                }
            }
        });
    }


}
