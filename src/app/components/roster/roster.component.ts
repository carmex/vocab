import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedMaterialModule } from '../../shared-material.module';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { ClassroomStudent } from '../../models/classroom.interface';
import { QRCodeComponent } from 'angularx-qrcode';
import { MatTabsModule } from '@angular/material/tabs';
import { MatListModule } from '@angular/material/list';
import { MatDialog } from '@angular/material/dialog';
import { AlertDialogComponent } from '../dialogs/alert-dialog/alert-dialog.component';

@Component({
    selector: 'app-roster',
    standalone: true,
    imports: [CommonModule, SharedMaterialModule, FormsModule, QRCodeComponent, MatTabsModule, MatListModule],
    templateUrl: './roster.component.html',
    styleUrls: ['./roster.component.scss']
})
export class RosterComponent implements OnInit {
    @Input() classId!: string;
    @Input() classCode!: string;
    @Input() className!: string;

    students: ClassroomStudent[] = [];
    loading = true;
    inviteText = '';
    isInviting = false;
    showQr = false;

    constructor(
        private supabase: SupabaseService,
        private dialog: MatDialog
    ) { }

    async removeStudent(student: ClassroomStudent) {
        const dialogRef = this.dialog.open(AlertDialogComponent, {
            data: {
                title: 'Remove Student',
                message: `Are you sure you want to remove ${student.invited_email}?`,
                showCancel: true,
                confirmText: 'Remove'
            }
        });

        dialogRef.afterClosed().subscribe(async (result) => {
            if (result) {
                const { error } = await this.supabase.client
                    .from('classroom_students')
                    .delete()
                    .eq('id', student.id);

                if (error) {
                    console.error('Error removing student:', error);
                } else {
                    this.fetchRoster();
                }
            }
        });
    }

    ngOnInit() {
        if (this.classId) {
            this.fetchRoster();
        }
    }

    async fetchRoster() {
        this.loading = true;
        const { data, error } = await this.supabase.client
            .from('classroom_students')
            .select('*') // We might join with profiles later: select('*, profiles(email, full_name)')
            .eq('classroom_id', this.classId);

        if (error) {
            console.error('Error fetching roster:', error);
        } else {
            this.students = data || [];
        }
        this.loading = false;
    }

    async sendInvites() {
        if (!this.inviteText.trim()) return;
        this.isInviting = true;

        // Split by comma or newline, trim, filter empty
        const emails = this.inviteText
            .split(/[\n,]+/)
            .map(e => e.trim())
            .filter(e => e.length > 0 && e.includes('@')); // basic validation

        if (emails.length === 0) {
            this.isInviting = false;
            return;
        }

        // Prepare inserts
        const inserts = emails.map(email => ({
            classroom_id: this.classId,
            invited_email: email,
            status: 'pending'
        }));

        // Perform insert (ignore duplicates based on constraint?)
        // Supabase insert has onConflict.
        const { error } = await this.supabase.client
            .from('classroom_students')
            .upsert(inserts, { onConflict: 'classroom_id, invited_email', ignoreDuplicates: true });

        if (error) {
            console.error('Error sending invites:', error);
            alert('Some invites could not be sent.');
        } else {
            this.inviteText = '';
            this.fetchRoster();
        }
        this.isInviting = false;
    }

    printQr() {
        // Attempt to find the canvas (qrcode component renders a canvas)
        const canvas = document.querySelector('qrcode canvas') as HTMLCanvasElement;
        if (!canvas) {
            alert('QR Code not ready. Please ensure it is visible.');
            return;
        }

        const imgUrl = canvas.toDataURL('image/png');

        const win = window.open('', '_blank', 'height=600,width=800');
        if (!win) return;

        win.document.write(`
      <html>
        <head>
          <title>Join ${this.className}</title>
          <style>
            body { 
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
                text-align: center; 
                padding: 40px; 
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                margin: 0;
            }
            h1 { font-size: 42px; margin: 0 0 30px 0; color: #000; }
            .qr-container { 
                border: 0; 
                display: inline-block; 
                padding: 0; 
                margin-bottom: 40px;
            }
            img { width: 400px; height: 400px; image-rendering: pixelated; }
            .steps { 
                font-size: 28px; 
                line-height: 1.6; 
                color: #333; 
                text-align: left;
                display: inline-block;
                background: #f5f5f5;
                padding: 20px 40px;
                border-radius: 16px;
            }
            .step { margin: 10px 0; font-weight: 500; }
            @page { size: auto; margin: 0mm; }
            @media print {
                body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <h1>${this.className}</h1>
          <div class="qr-container">
             <img src="${imgUrl}" />
          </div>
          <div class="steps">
             <div class="step">1. Open Camera</div>
             <div class="step">2. Scan Code</div>
             <div class="step">3. Sign in</div>
          </div>
          <script>
            setTimeout(() => {
                window.print();
                // window.close(); 
            }, 500);
          </script>
        </body>
      </html>
    `);
        win.document.close();
    }
}
