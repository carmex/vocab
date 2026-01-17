import { Component, OnInit } from '@angular/core';
import { ClassroomService } from '../../services/classroom.service';
import { AuthService } from '../../services/auth.service';
import { Observable, of, combineLatest } from 'rxjs';
import { catchError, filter, switchMap, map, startWith } from 'rxjs/operators';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { Quest } from '../../models/quest.interface';
import { CommonModule } from '@angular/common';
import { SharedMaterialModule } from '../../shared-material.module';
import { TopNavComponent } from '../top-nav/top-nav.component';

@Component({
    selector: 'app-quests',
    templateUrl: './quests.component.html',
    styleUrls: ['./quests.component.scss'],
    standalone: true,
    imports: [CommonModule, SharedMaterialModule, RouterModule, TopNavComponent]
})
export class QuestsComponent {
    myQuests$: Observable<Quest[]>;

    constructor(
        private classroomService: ClassroomService,
        private router: Router,
        private route: ActivatedRoute,
        public auth: AuthService
    ) {
        const refreshTrigger = this.route.params;

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

    onPlayQuest(quest: Quest) {
        if (quest.is_completed) {
            this.router.navigate(['/quiz', quest.list_id, 'main'], { queryParams: { from: 'quests' } });
        } else {
            this.router.navigate(['/quiz', quest.list_id, 'main'], { queryParams: { questId: quest.id, from: 'quests' } });
        }
    }
}
