import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MainMenuComponent } from './components/main-menu.component';
import { TeacherDashboardComponent } from './components/teacher-dashboard/teacher-dashboard.component';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: '/menu', pathMatch: 'full' },
  { path: 'quests', loadComponent: () => import('./components/quests/quests.component').then(m => m.QuestsComponent), canActivate: [AuthGuard] },
  { path: 'lists', loadComponent: () => import('./components/lists/lists.component').then(m => m.ListsComponent), canActivate: [AuthGuard] },
  { path: 'classes', component: TeacherDashboardComponent, canActivate: [AuthGuard] },
  // Keeping dashboard redirect for backward compatibility
  { path: 'dashboard', redirectTo: '/lists' },
  { path: 'menu', component: MainMenuComponent },
  { path: 'marketplace', loadComponent: () => import('./components/marketplace/marketplace.component').then(m => m.MarketplaceComponent) },
  { path: 'list/new', loadComponent: () => import('./components/list-editor/list-editor.component').then(m => m.ListEditorComponent), canActivate: [AuthGuard] },
  { path: 'list/:id/edit', loadComponent: () => import('./components/list-editor/list-editor.component').then(m => m.ListEditorComponent), canActivate: [AuthGuard] },
  { path: 'quiz/:listId/:mode', loadComponent: () => import('./components/quiz.component').then(m => m.QuizComponent) },

  { path: 'settings', loadComponent: () => import('./components/settings.component').then(m => m.SettingsComponent) },
  { path: 'login', loadComponent: () => import('./components/auth/login.component').then(m => m.LoginComponent) },
  { path: 'signup', loadComponent: () => import('./components/auth/signup.component').then(m => m.SignupComponent) },
  { path: 'share/:code', loadComponent: () => import('./components/share-receiver/share-receiver.component').then(m => m.ShareReceiverComponent) },
  { path: 'summary', loadComponent: () => import('./components/summary.component').then(m => m.SummaryComponent) },
  { path: 'class/:id', loadComponent: () => import('./components/class-detail/class-detail.component').then(m => m.ClassDetailComponent) },
  { path: 'join/:code', loadComponent: () => import('./components/join-class/join-class.component').then(m => m.JoinClassComponent) },
  { path: '**', redirectTo: '/menu' } // Changed fallback to menu, feels arguably safer than lists? or keep lists? Let's go with menu.
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
