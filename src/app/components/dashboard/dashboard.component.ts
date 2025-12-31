import { Component, OnInit } from '@angular/core';
import { ListService, ListShare } from '../../services/list.service';
import { AuthService } from '../../services/auth.service';
import { Observable, of, combineLatest } from 'rxjs';
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

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
    standalone: false
})
export class DashboardComponent implements OnInit {
    myLists$: Observable<ListShare[]>;
    myQuests$: Observable<Quest[]>;

    showTeacherView$: Observable<boolean>;

    constructor(
        private listService: ListService,
        private classroomService: ClassroomService,
        private router: Router,
        private route: ActivatedRoute,
        public auth: AuthService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar
    ) {
        this.showTeacherView$ = combineLatest([
            this.auth.profile$,
            this.route.queryParams
        ]).pipe(
            map(([profile, params]) => {
                const isTeacher = profile?.role === 'teacher';
                const forcedStudentView = params['view'] === 'lists';
                return isTeacher && !forcedStudentView;
            })
        );

        // Wait for auth to be ready before fetching lists
        this.myLists$ = this.auth.user$.pipe(
            filter(user => !!user),
            switchMap(user => this.listService.getMyLists(user!.id)),
            catchError(err => {
                console.error('Error fetching lists:', err);
                return of([]);
            })
        );

        // Fetch Quests for student view
        // Fetch Quests for student view
        // Use behavior subject or combineLatest with a refresh trigger to reaload when navigating back?
        // Actually, route navigation re-triggers if the component re-inits.
        // If the component is reused, we need to listen to ActivatedRoute params or events.
        // Or simply use `ionViewWillEnter` equivalent if this was ionic.. but it's regular Angular.
        // `myQuests$` is a cold observable? No, it pipes from `auth.user$`. 
        // If `auth.user$` emits, it runs. It emits on load.
        // We can merge a "refreshSubject" to force reload.

        const refreshTrigger = this.route.params; // Re-trigger on route params change (which happens on navigation)

        this.myQuests$ = combineLatest([
            this.auth.user$.pipe(filter(u => !!u)),
            refreshTrigger.pipe(startWith({}))
        ]).pipe(
            switchMap(([user, _]) => this.classroomService.getStudentQuests(user!.id)),
            map(quests => {
                // Front-end sort: Incomplete first, then by due date
                return quests.sort((a, b) => {
                    if (a.is_completed === b.is_completed) {
                        return (new Date(a.due_date || 0).getTime()) - (new Date(b.due_date || 0).getTime());
                    }
                    return a.is_completed ? 1 : -1;
                });
            }),
            catchError(err => {
                console.error('Error fetching quests:', err);
                return of([]);
            })
        );
    }

    ngOnInit(): void {
    }

    onCreateList() {
        const dialogRef = this.dialog.open(ListTypeDialogComponent, {
            width: '400px'
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

    onPlayQuest(quest: Quest) {
        if (quest.is_completed) {
            // Replay? Just go to main.
            this.router.navigate(['/quiz', quest.list_id, 'main']);
        } else {
            // Go to main, but maybe pass quest ID?
            // For now, MVP: Just play. We'll handle completion in the quiz.
            // Wait, we need to complete the quest.
            // I should pass 'questId' as query param.
            this.router.navigate(['/quiz', quest.list_id, 'main'], { queryParams: { questId: quest.id } });
        }
    }
}
