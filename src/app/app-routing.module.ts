import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MainMenuComponent } from './components/main-menu.component';
import { QuizComponent } from './components/quiz.component';
import { SummaryComponent } from './components/summary.component';
import { SettingsComponent } from './components/settings.component';

const routes: Routes = [
  { path: 'menu', component: MainMenuComponent },
  { path: 'quiz/:mode', component: QuizComponent }, // :mode will be 'main' or 'review'
  { path: 'summary', component: SummaryComponent },
  { path: 'settings', component: SettingsComponent },
  { path: '', redirectTo: '/menu', pathMatch: 'full' },
  { path: '**', redirectTo: '/menu' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
