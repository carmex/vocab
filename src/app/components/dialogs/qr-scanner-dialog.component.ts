import { Component, ElementRef, ViewChild, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import jsQR from 'jsqr';

@Component({
  selector: 'app-qr-scanner-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Scan QR Code</h2>
    <mat-dialog-content class="scanner-content">
      <div class="video-container">
        <video #video [hidden]="!hasCamera" playsinline></video>
        <canvas #canvas hidden></canvas>
        <div class="overlay" *ngIf="hasCamera">
           <div class="scan-area"></div>
        </div>
        <div class="error-message" *ngIf="!hasCamera && permissionDenied">
          <mat-icon color="warn">videocam_off</mat-icon>
          <p>Camera access denied or not available.</p>
        </div>
        <div class="loading" *ngIf="loading">
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            <p>Starting camera...</p>
        </div>
      </div>
      <p class="hint">Point your camera at a FlashQuest QR code.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .scanner-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0;
      overflow: hidden;
    }
    .video-container {
      position: relative;
      width: 100%;
      max-width: 400px;
      height: 300px;
      background: #000;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 40px solid rgba(0,0,0,0.5);
      box-sizing: border-box;
    }
    .scan-area {
      width: 200px;
      height: 200px;
      border: 2px solid #fff;
      border-radius: 12px;
      box-shadow: 0 0 0 1000px rgba(0,0,0,0.3); 
    }
    .hint {
      margin-top: 15px;
      color: #666;
      font-size: 14px;
    }
    .error-message {
        color: white;
        text-align: center;
    }
    .loading {
        position: absolute;
        width: 80%;
        text-align: center;
        color: white;
    }
  `]
})
export class QrScannerDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('video') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasElement!: ElementRef<HTMLCanvasElement>;

  hasCamera = false;
  permissionDenied = false;
  loading = true;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;

  constructor(private dialogRef: MatDialogRef<QrScannerDialogComponent>) { }

  ngAfterViewInit() {
    this.startCamera();
  }

  ngOnDestroy() {
    this.stopCamera();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      const video = this.videoElement.nativeElement;
      video.srcObject = this.stream;
      video.setAttribute('playsinline', 'true');

      await video.play();
      this.hasCamera = true;
      this.loading = false;
      this.scanFrame();
    } catch (err) {
      console.error('Camera error:', err);
      this.permissionDenied = true;
      this.loading = false;
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  scanFrame() {
    if (!this.videoElement || !this.canvasElement) return;

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const context = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code) {
        // Found a QR code!
        console.log('Found QR code:', code.data);
        this.dialogRef.close(code.data);
        return; // Stop scanning
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this.scanFrame());
  }
}
