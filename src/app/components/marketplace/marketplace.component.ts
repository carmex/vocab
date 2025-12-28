import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ListService, WordList } from '../../services/list.service';
import { PreviewDialogComponent } from '../dialogs/preview-dialog.component';
import { RouterModule } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TopNavComponent } from '../top-nav/top-nav.component';

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatDialogModule, RouterModule, MatTooltipModule, TopNavComponent],
  template: `
    <div class="marketplace-container">
      <app-top-nav backLink="/menu"></app-top-nav>
      <h1>Marketplace</h1>
      <p>Browse and subscribe to public word lists.</p>

      <div class="list-grid">
        <mat-card *ngFor="let list of publicLists" class="list-card" (click)="openPreview(list)">
          <mat-card-header>
            <mat-card-title>{{ list.name }}</mat-card-title>
            <mat-card-subtitle>{{ list.description }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <!-- Could show word count or creator here if we fetched it -->
          </mat-card-content>
        </mat-card>
      </div>

      <div class="load-more" *ngIf="hasMore">
        <button mat-stroked-button (click)="loadMore()" [disabled]="loading">
          {{ loading ? 'Loading...' : 'Load More' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .marketplace-container { 
      max-width: 600px; 
      margin: 0 auto; 
      padding: 10px; 
      text-align: center;
      position: relative;
      box-sizing: border-box;
    }
    .list-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); 
      gap: 20px; 
      margin-top: 20px; 
      text-align: left;
    }
    .list-card { cursor: pointer; transition: transform 0.2s; }
    .list-card:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
    .load-more { margin-top: 30px; text-align: center; }
  `]
})
export class MarketplaceComponent implements OnInit {
  publicLists: WordList[] = [];
  page = 0;
  pageSize = 10;
  total = 0;
  loading = false;

  constructor(
    private listService: ListService,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.loadLists();
  }

  loadLists() {
    this.loading = true;
    this.listService.getPublicLists(this.page, this.pageSize).subscribe({
      next: (res) => {
        this.publicLists = [...this.publicLists, ...res.data];
        this.total = res.count;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  loadMore() {
    this.page++;
    this.loadLists();
  }

  get hasMore(): boolean {
    return this.publicLists.length < this.total;
  }

  openPreview(list: WordList) {
    this.dialog.open(PreviewDialogComponent, {
      data: { listId: list.id, listName: list.name },
      width: '500px'
    });
  }
}
