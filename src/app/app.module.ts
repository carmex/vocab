import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SharedMaterialModule } from './shared-material.module';
import { MainMenuComponent } from './components/main-menu.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { TopNavComponent } from './components/top-nav/top-nav.component';

@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    MainMenuComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    SharedMaterialModule,
    HttpClientModule,
    FormsModule,
    TopNavComponent
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
