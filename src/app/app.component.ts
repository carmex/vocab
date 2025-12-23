import { Component, OnInit } from '@angular/core';
import { SettingsService } from './services/settings.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'vocab';

  constructor(private settingsService: SettingsService) { }

  ngOnInit() {
    this.settingsService.loadSettings();
  }
}
