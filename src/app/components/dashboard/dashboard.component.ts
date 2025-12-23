import { Component, OnInit } from '@angular/core';
import { ListService, ListShare } from '../../services/list.service';
import { AuthService } from '../../services/auth.service';
import { Observable, of } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
    standalone: false
})
export class DashboardComponent implements OnInit {
    myLists$: Observable<ListShare[]>;

    constructor(
        private listService: ListService,
        private router: Router,
        public auth: AuthService
    ) {
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
        this.router.navigate(['/list/new']);
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
}
