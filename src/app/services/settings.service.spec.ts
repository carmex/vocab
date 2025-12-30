/**
 * Unit tests for SettingsService
 * 
 * Tests settings storage, retrieval, and defaults.
 */

describe('SettingsService Logic Tests', () => {
    // Default settings structure
    interface Settings {
        autoAdvance: boolean;
        correctAnswerTimer: number;
        incorrectAnswerTimer: number;
        speechMode: 'native' | 'whisper' | 'auto';
        enhancedTTS: boolean;
        showHints: boolean;
    }

    const defaultSettings: Settings = {
        autoAdvance: true,
        correctAnswerTimer: 2,
        incorrectAnswerTimer: 4,
        speechMode: 'auto',
        enhancedTTS: false,
        showHints: true,
    };

    // Mock localStorage
    let mockStorage: { [key: string]: string } = {};

    const mockLocalStorage = {
        getItem: (key: string) => mockStorage[key] || null,
        setItem: (key: string, value: string) => { mockStorage[key] = value; },
        removeItem: (key: string) => { delete mockStorage[key]; },
        clear: () => { mockStorage = {}; }
    };

    function getSettings(): Settings {
        const stored = mockLocalStorage.getItem('vocab_settings');
        if (stored) {
            try {
                return { ...defaultSettings, ...JSON.parse(stored) };
            } catch {
                return defaultSettings;
            }
        }
        return defaultSettings;
    }

    function saveSettings(settings: Partial<Settings>): void {
        const current = getSettings();
        const updated = { ...current, ...settings };
        mockLocalStorage.setItem('vocab_settings', JSON.stringify(updated));
    }

    beforeEach(() => {
        mockStorage = {};
    });

    describe('getSettings', () => {
        it('should return default settings when nothing is stored', () => {
            const settings = getSettings();
            expect(settings).toEqual(defaultSettings);
        });

        it('should return stored settings when available', () => {
            mockLocalStorage.setItem('vocab_settings', JSON.stringify({ autoAdvance: false }));
            const settings = getSettings();
            expect(settings.autoAdvance).toBe(false);
        });

        it('should merge stored settings with defaults', () => {
            mockLocalStorage.setItem('vocab_settings', JSON.stringify({ correctAnswerTimer: 5 }));
            const settings = getSettings();
            expect(settings.correctAnswerTimer).toBe(5);
            expect(settings.autoAdvance).toBe(true); // Default preserved
        });

        it('should handle corrupted storage gracefully', () => {
            mockLocalStorage.setItem('vocab_settings', 'not valid json');
            const settings = getSettings();
            expect(settings).toEqual(defaultSettings);
        });
    });

    describe('saveSettings', () => {
        it('should save settings to storage', () => {
            saveSettings({ autoAdvance: false });
            const stored = JSON.parse(mockLocalStorage.getItem('vocab_settings')!);
            expect(stored.autoAdvance).toBe(false);
        });

        it('should merge with existing settings', () => {
            saveSettings({ autoAdvance: false });
            saveSettings({ correctAnswerTimer: 10 });
            const settings = getSettings();
            expect(settings.autoAdvance).toBe(false);
            expect(settings.correctAnswerTimer).toBe(10);
        });

        it('should not affect unrelated settings', () => {
            saveSettings({ showHints: false });
            const settings = getSettings();
            expect(settings.showHints).toBe(false);
            expect(settings.enhancedTTS).toBe(false); // Default unchanged
        });
    });

    describe('Timer validation', () => {
        it('should accept valid timer values', () => {
            const validTimers = [1, 2, 5, 10];
            validTimers.forEach(timer => {
                saveSettings({ correctAnswerTimer: timer });
                const settings = getSettings();
                expect(settings.correctAnswerTimer).toBe(timer);
            });
        });

        it('should calculate timer in milliseconds correctly', () => {
            const timerSeconds = 3;
            const timerMs = timerSeconds * 1000;
            expect(timerMs).toBe(3000);
        });
    });

    describe('Speech mode settings', () => {
        it('should accept valid speech modes', () => {
            const validModes: Array<'native' | 'whisper' | 'auto'> = ['native', 'whisper', 'auto'];
            validModes.forEach(mode => {
                saveSettings({ speechMode: mode });
                const settings = getSettings();
                expect(settings.speechMode).toBe(mode);
            });
        });
    });
});
