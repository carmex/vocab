import { Component, OnInit } from '@angular/core';
import { ListService, ListShare } from '../../services/list.service';
import { AuthService } from '../../services/auth.service';
import { Observable, of, combineLatest } from 'rxjs';
import { catchError, filter, switchMap, map } from 'rxjs/operators';
import { Router, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ListTypeDialogComponent } from '../dialogs/list-type-dialog/list-type-dialog.component';
import { ListType } from '../../models/list-type.enum';
import { ShareDialogComponent } from '../dialogs/share-dialog.component';
import { QrScannerDialogComponent } from '../dialogs/qr-scanner-dialog.component';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
    standalone: false
})
export class DashboardComponent implements OnInit {
    myLists$: Observable<ListShare[]>;

    showTeacherView$: Observable<boolean>;

    constructor(
        private listService: ListService,
        private router: Router,
        private route: ActivatedRoute,
        public auth: AuthService,
        private dialog: MatDialog
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
}
