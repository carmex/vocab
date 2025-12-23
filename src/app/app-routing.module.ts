import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MainMenuComponent } from './components/main-menu.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: '/menu', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'menu', component: MainMenuComponent },
  { path: 'marketplace', loadComponent: () => import('./components/marketplace/marketplace.component').then(m => m.MarketplaceComponent) },
  { path: 'list/new', loadComponent: () => import('./components/list-editor/list-editor.component').then(m => m.ListEditorComponent), canActivate: [AuthGuard] },
  { path: 'list/:id/edit', loadComponent: () => import('./components/list-editor/list-editor.component').then(m => m.ListEditorComponent), canActivate: [AuthGuard] },
  { path: 'quiz/:listId/:mode', loadComponent: () => import('./components/quiz.component').then(m => m.QuizComponent) },
  { path: 'settings', loadComponent: () => import('./components/settings.component').then(m => m.SettingsComponent) },
  { path: 'login', loadComponent: () => import('./components/auth/login.component').then(m => m.LoginComponent) },
  { path: 'signup', loadComponent: () => import('./components/auth/signup.component').then(m => m.SignupComponent) },
  { path: 'summary', loadComponent: () => import('./components/summary.component').then(m => m.SummaryComponent) },
  { path: '**', redirectTo: '/dashboard' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
