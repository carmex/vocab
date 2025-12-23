import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { ListService } from '../../services/list.service';
import { Router } from '@angular/router';
import { TwemojiPipe } from '../../pipes/twemoji.pipe';

@Component({
  selector: 'app-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatListModule, TwemojiPipe],
  template: `
    <h2 mat-dialog-title>Preview: {{ data.listName }}</h2>
    <mat-dialog-content>
      <p>Sample words from this list:</p>
      <mat-list>
        <mat-list-item *ngFor="let word of sampleWords">
          <span matListItemTitle [innerHTML]="word.word | twemoji"></span>
          <span matListItemLine [innerHTML]="word.definition | twemoji"></span>
        </mat-list-item>
      </mat-list>
      <p *ngIf="loading">Loading words...</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" (click)="onSubscribe()" [disabled]="subscribing">
        {{ subscribing ? 'Adding...' : 'Add to My Lists' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-list-item { margin-bottom: 10px; }
  `]
})
export class PreviewDialogComponent implements OnInit {
  sampleWords: any[] = [];
  loading = true;
  subscribing = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { listId: string, listName: string },
    private dialogRef: MatDialogRef<PreviewDialogComponent>,
    private listService: ListService,
    private router: Router
  ) { }

  ngOnInit(): void {
    // We can reuse getListDetails or just fetch words directly. 
    // Since getListDetails fetches metadata (which we have) and counts, 
    // let's just fetch a few words for preview.
    // Ideally ListService should have a 'getWords(listId, limit)' method.
    // For now, I'll assume we can use getListDetails and maybe it's overkill but works,
    // OR I can add a small helper in ListService.
    // Let's just use getListDetails for now, but wait, getListDetails DOES NOT return words list, just counts.
    // I need to fetch words!
    // I will use a direct query here or add a method. 
    // Let's add a quick method to ListService or just query here if I could inject SupabaseService?
    // Better to keep logic in Service. I'll add `getPreviewWords` to ListService in a separate step or just use what I have.
    // Actually, I missed `getPreviewWords` in the plan. I'll add it to ListService now.

    // TEMPORARY: I will use ListService.getListDetails just to verify it exists, 
    // but I really want to show words.
    // I'll add `getSampleWords` to ListService.
    this.listService.getSampleWords(this.data.listId).subscribe(words => {
      this.sampleWords = words;
      this.loading = false;
    });
  }

  onSubscribe() {
    this.subscribing = true;
    this.listService.subscribeToList(this.data.listId).subscribe({
      next: () => {
        this.dialogRef.close();
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        console.error(err);
        alert('Failed to subscribe');
        this.subscribing = false;
      }
    });
  }
}
