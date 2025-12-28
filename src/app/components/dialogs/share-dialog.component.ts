import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { QRCodeComponent } from 'angularx-qrcode';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
    selector: 'app-share-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        QRCodeComponent,
        MatSnackBarModule
    ],
    template: `
    <h2 mat-dialog-title>Share List</h2>
    <mat-dialog-content class="share-content">
      <p>Scan this QR code or copy the link to share <strong>{{ data.listName }}</strong>.</p>
      
      <div class="qr-container">
        <qrcode 
          [qrdata]="shareUrl" 
          [width]="200" 
          [errorCorrectionLevel]="'M'">
        </qrcode>
      </div>

      <div class="link-container">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Share Link</mat-label>
          <input matInput [value]="shareUrl" readonly>
          <button mat-icon-button matSuffix (click)="copyLink()" matTooltip="Copy Link">
            <mat-icon>content_copy</mat-icon>
          </button>
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
    styles: [`
    .share-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .qr-container {
      margin: 20px 0;
      padding: 10px;
      background: white;
      border-radius: 8px;
    }
    .link-container {
      width: 100%;
      margin-top: 10px;
    }
    .full-width {
      width: 100%;
    }
  `]
})
export class ShareDialogComponent implements OnInit {
    shareUrl: string = '';

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: { listName: string, shareCode: string },
        private dialogRef: MatDialogRef<ShareDialogComponent>,
        private clipboard: Clipboard,
        private snackBar: MatSnackBar
    ) { }

    ngOnInit(): void {
        // Construct the full URL
        // In production, use environment.baseUrl or window.location.origin
        const origin = window.location.origin;
        this.shareUrl = `${origin}/share/${this.data.shareCode}`;
    }

    copyLink() {
        this.clipboard.copy(this.shareUrl);
        this.snackBar.open('Link copied to clipboard!', 'Close', { duration: 2000 });
    }
}
