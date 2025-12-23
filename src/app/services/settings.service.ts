import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface AppSettings {
  autoAdvance: boolean;
  correctAnswerTimer: number;
  incorrectAnswerTimer: number;
  darkMode: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly SETTINGS_KEY = 'vocab_app_settings';
  private readonly DEFAULT_SETTINGS: AppSettings = {
    autoAdvance: true,
    correctAnswerTimer: 1,
    incorrectAnswerTimer: 5,
    darkMode: false
  };

  constructor(private supabase: SupabaseService) { }

  async loadSettings(): Promise<AppSettings> {
    let settings: AppSettings = { ...this.DEFAULT_SETTINGS };

    try {
      const { data, error } = await this.supabase.client.rpc('get_user_settings', {});
      if (!error && data) {
        this.saveToLocal(data);
        settings = { ...this.DEFAULT_SETTINGS, ...data };
      } else {
        const localSettings = this.getFromLocal();
        if (localSettings) {
          settings = localSettings;
        }
      }
    } catch (err) {
      console.warn('Error fetching settings from cloud, falling back to local', err);
      const localSettings = this.getFromLocal();
      if (localSettings) {
        settings = localSettings;
      }
    }

    this.applyTheme(settings.darkMode);
    return settings;
  }

  getSettings(): AppSettings {
    return this.getFromLocal() || { ...this.DEFAULT_SETTINGS };
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    this.saveToLocal(settings);
    this.applyTheme(settings.darkMode);
    try {
      await this.supabase.client.rpc('upsert_settings', { p_settings: settings });
    } catch (err) {
      console.error('Error saving settings to cloud', err);
    }
  }

  getDefaultSettings(): AppSettings {
    return { ...this.DEFAULT_SETTINGS };
  }

  private getFromLocal(): AppSettings | null {
    try {
      const stored = localStorage.getItem(this.SETTINGS_KEY);
      if (stored) {
        return { ...this.DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Error reading local settings', e);
    }
    return null;
  }

  private saveToLocal(settings: AppSettings): void {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving local settings', e);
    }
  }

  private applyTheme(isDark: boolean): void {
    if (isDark) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }
}