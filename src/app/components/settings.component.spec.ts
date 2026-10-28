import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsComponent } from './settings.component';
import { SettingsService, AppSettings } from '../services/settings.service';
import { SpeechService } from '../services/speech.service';
import { AuthService } from '../services/auth.service';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let mockSettingsService: jest.Mocked<Partial<SettingsService>>;
  let mockSpeechService: any;
  let mockAuthService: any;

  const defaultMockSettings: AppSettings = {
    autoAdvance: true,
    correctAnswerTimer: 1,
    incorrectAnswerTimer: 5,
    delayAnswers: true,
    delayAnswerTimer: 3,
    darkMode: false,
    enhancedTTS: false,
    usePremiumVoice: true,
    ttsVoice: 'cmu_us_slt_arctic-wav-arctic_a0001',
    scrambleCorrection: true
  };

  beforeEach(async () => {
    mockSettingsService = {
      loadSettings: jest.fn().mockResolvedValue(defaultMockSettings),
      getSettings: jest.fn().mockReturnValue({ ...defaultMockSettings }),
      getDefaultSettings: jest.fn().mockReturnValue({ ...defaultMockSettings }),
      saveSettings: jest.fn().mockResolvedValue(undefined)
    };

    mockSpeechService = {
      getModelLoadingProgress: jest.fn().mockReturnValue(of({ progress: 0 })),
      preloadTTS: jest.fn()
    };

    mockAuthService = {
      profile$: of({ role: 'teacher' }),
      updateRole: jest.fn().mockResolvedValue(undefined)
    };

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: SpeechService, useValue: mockSpeechService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: MatDialog, useValue: { open: jest.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
  });

  it('should initialize scrambleCorrection from settings', async () => {
    mockSettingsService.getSettings!.mockReturnValue({
      ...defaultMockSettings,
      scrambleCorrection: true
    });

    await component.ngOnInit();
    expect(component.scrambleCorrection).toBe(true);
  });

  it('should include scrambleCorrection in autoSave', async () => {
    await component.ngOnInit();
    component.scrambleCorrection = false;
    await component.autoSave();

    expect(mockSettingsService.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        scrambleCorrection: false
      })
    );
  });

  it('should reset scrambleCorrection on reset', async () => {
    await component.ngOnInit();
    component.scrambleCorrection = false;
    component.onReset();

    expect(component.scrambleCorrection).toBe(true);
  });
});
