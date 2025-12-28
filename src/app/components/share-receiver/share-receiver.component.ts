import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ListService } from '../../services/list.service';
import { MatDialog } from '@angular/material/dialog';
import { PreviewDialogComponent } from '../dialogs/preview-dialog.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
    selector: 'app-share-receiver',
    standalone: true,
    imports: [CommonModule, MatProgressSpinnerModule],
    template: `
    <div class="loading-container">
      <mat-spinner diameter="50"></mat-spinner>
      <p>Finding list...</p>
    </div>
  `,
    styles: [`
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      width: 100%;
    }
    p { margin-top: 20px; color: #666; }
  `]
})
export class ShareReceiverComponent implements OnInit {

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private listService: ListService,
        private dialog: MatDialog
    ) { }

    ngOnInit(): void {
        const code = this.route.snapshot.paramMap.get('code');
        if (!code) {
            this.router.navigate(['/dashboard']);
            return;
        }

        this.listService.getListByShareCode(code).subscribe({
            next: (list) => {
                if (list) {
                    // Open Preview Dialog
                    const dialogRef = this.dialog.open(PreviewDialogComponent, {
                        width: '500px',
                        data: { listId: list.id, listName: list.name }
                    });

                    dialogRef.afterClosed().subscribe(() => {
                        // Whether they added it or cancelled, go to dashboard
                        this.router.navigate(['/dashboard']);
                    });
                } else {
                    alert('List not found or invalid code.');
                    this.router.navigate(['/dashboard']);
                }
            },
            error: (err) => {
                console.error(err);
                alert('Error loading list.');
                this.router.navigate(['/dashboard']);
            }
        });
    }
}
