import { Injectable } from '@angular/core';

export interface AppSettings {
  autoAdvance: boolean;
  correctAnswerTimer: number;
  incorrectAnswerTimer: number;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly SETTINGS_KEY = 'vocab_app_settings';
  private readonly DEFAULT_SETTINGS: AppSettings = {
    autoAdvance: true,
    correctAnswerTimer: 1,
    incorrectAnswerTimer: 5
  };

  constructor() { }

  // Get settings from localStorage or return defaults
  getSettings(): AppSettings {
    try {
      const storedSettings = localStorage.getItem(this.SETTINGS_KEY);
      if (storedSettings) {
        return { ...this.DEFAULT_SETTINGS, ...JSON.parse(storedSettings) };
      }
    } catch (error) {
      console.error('Error loading settings from localStorage:', error);
    }
    return { ...this.DEFAULT_SETTINGS };
  }

  // Save settings to localStorage
  saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
      console.log('Settings saved to localStorage:', settings);
    } catch (error) {
      console.error('Error saving settings to localStorage:', error);
    }
  }

  // Reset to default settings
  getDefaultSettings(): AppSettings {
    return { ...this.DEFAULT_SETTINGS };
  }

  // Check if settings exist in localStorage
  hasStoredSettings(): boolean {
    return localStorage.getItem(this.SETTINGS_KEY) !== null;
  }

  // Clear stored settings (for reset functionality)
  clearStoredSettings(): void {
    try {
      localStorage.removeItem(this.SETTINGS_KEY);
    } catch (error) {
      console.error('Error clearing settings from localStorage:', error);
    }
  }
}