import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { SettingsService } from './services/settings.service';
import { AuthService } from './services/auth.service';
import { RoleSelectionModalComponent } from './components/role-selection-modal/role-selection-modal.component';
import { AlertDialogComponent } from './components/dialogs/alert-dialog/alert-dialog.component';
import { SupabaseService } from './services/supabase.service';
import { SpeechService } from './services/speech.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'vocab';

  constructor(
    private settingsService: SettingsService,
    private authService: AuthService,
    private dialog: MatDialog,
    private supabase: SupabaseService,
    private speechService: SpeechService
  ) { }

  ngOnInit() {
    this.settingsService.loadSettings();
    this.checkUserRole();
  }

  private checkUserRole() {
    // Watch for profile changes
    this.authService.profile$.subscribe(profile => {
      const user = this.authService.currentUser;

      // If we have a logged-in user (not anonymous) and a loaded profile but no role
      // Note: We deliberately check if profile is not null (loaded) so we don't prompt while loading
      // But if profile is null, it might mean it's not loaded yet or failed. 
      // AuthService sets profile to null initially.

      if (user && !user.is_anonymous && profile && !profile.role) {
        this.openRoleSelection();
      }

      if (user && !user.is_anonymous) {
        this.checkPendingInvites(user.email);
      }
    });
  }

  private async checkPendingInvites(email: string | undefined) {
    if (!email) return;

    const { data, error } = await this.supabase.client
      .from('classroom_students')
      .select('*, classrooms(name)')
      .eq('invited_email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (data) {
      // Found an invite
      // Show confirmation (Simple alert for MVP -> then update)
      // In real app, show nice modal.
      // For now:
      const classroomName = (data.classrooms as any)?.name || 'a class';

      const dialogRef = this.dialog.open(AlertDialogComponent, {
        data: {
          title: 'Class Invitation',
          message: `You have been invited to join ${classroomName}. Accept?`,
          showCancel: true,
          confirmText: 'Accept',
          cancelText: 'Decline'
        }
      });

      dialogRef.afterClosed().subscribe(async (accepted) => {
        if (accepted) {
          await this.supabase.client
            .from('classroom_students')
            .update({
              status: 'active',
              student_id: this.authService.currentUser!.id
            })
            .eq('id', data.id);
          // Refresh
          window.location.reload();
        }
      });
    }
  }

  private openRoleSelection() {
    // prevent multiple dialogs
    if (this.dialog.openDialogs.some(ref => ref.componentInstance instanceof RoleSelectionModalComponent)) {
      return;
    }

    this.dialog.open(RoleSelectionModalComponent, {
      disableClose: true, // Force selection
      width: '600px',
      maxWidth: '90vw'
    });
  }
}
