import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { SharedMaterialModule } from '../../shared-material.module';
import { AuthService } from '../../services/auth.service';
import { UserRole } from '../../models/classroom.interface';

@Component({
    selector: 'app-role-selection-modal',
    standalone: true,
    imports: [CommonModule, SharedMaterialModule],
    templateUrl: './role-selection-modal.component.html',
    styleUrls: ['./role-selection-modal.component.scss']
})
export class RoleSelectionModalComponent {
    isUpdating = false;

    constructor(
        private dialogRef: MatDialogRef<RoleSelectionModalComponent>,
        private authService: AuthService
    ) { }

    async selectRole(role: UserRole) {
        this.isUpdating = true;
        try {
            await this.authService.updateRole(role);
            this.dialogRef.close(role);
        } catch (error) {
            console.error('Failed to update role:', error);
            // Could show snackbar here
            this.isUpdating = false;
        }
    }
}
