import { TestBed } from '@angular/core/testing';
import { SettingsService, AppSettings } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SettingsService);
    
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return default settings', () => {
    const settings = service.getSettings();
    expect(settings).toEqual({
      autoAdvance: true,
      correctAnswerTimer: 1,
      incorrectAnswerTimer: 5
    });
  });

  it('should save and retrieve settings from localStorage', () => {
    const customSettings: AppSettings = {
      autoAdvance: false,
      correctAnswerTimer: 2,
      incorrectAnswerTimer: 10
    };

    service.saveSettings(customSettings);
    const retrievedSettings = service.getSettings();

    expect(retrievedSettings).toEqual(customSettings);
  });

  it('should merge new settings with existing ones', () => {
    const existingSettings: AppSettings = {
      autoAdvance: true,
      correctAnswerTimer: 1,
      incorrectAnswerTimer: 5
    };

    service.saveSettings(existingSettings);

    const partialUpdate: AppSettings = { 
      autoAdvance: false,
      correctAnswerTimer: 1,
      incorrectAnswerTimer: 5
    };
    
    service.saveSettings(partialUpdate);

    const finalSettings = service.getSettings();
    expect(finalSettings.autoAdvance).toBe(false);
    expect(finalSettings.correctAnswerTimer).toBe(1);
    expect(finalSettings.incorrectAnswerTimer).toBe(5);
  });

  it('should get default settings', () => {
    const defaults = service.getDefaultSettings();
    expect(defaults).toEqual({
      autoAdvance: true,
      correctAnswerTimer: 1,
      incorrectAnswerTimer: 5
    });
  });

  it('should check if settings exist in localStorage', () => {
    expect(service.hasStoredSettings()).toBe(false);
    
    service.saveSettings({
      autoAdvance: false,
      correctAnswerTimer: 2,
      incorrectAnswerTimer: 10
    });
    
    expect(service.hasStoredSettings()).toBe(true);
  });

  it('should clear stored settings', () => {
    service.saveSettings({
      autoAdvance: false,
      correctAnswerTimer: 2,
      incorrectAnswerTimer: 10
    });
    
    expect(service.hasStoredSettings()).toBe(true);
    
    service.clearStoredSettings();
    expect(service.hasStoredSettings()).toBe(false);
    
    // Should revert to defaults after clearing
    const settings = service.getSettings();
    expect(settings).toEqual({
      autoAdvance: true,
      correctAnswerTimer: 1,
      incorrectAnswerTimer: 5
    });
  });

  it('should handle localStorage errors gracefully', () => {
    // Mock localStorage to throw an error
    spyOn(localStorage, 'getItem').and.throwError('Storage error');
    spyOn(localStorage, 'setItem').and.throwError('Storage error');
    
    expect(() => service.getSettings()).not.toThrow();
    expect(() => service.saveSettings({
      autoAdvance: false,
      correctAnswerTimer: 2,
      incorrectAnswerTimer: 10
    })).not.toThrow();
  });
});