import { formatTtsInputText } from './audio-utils';

describe('formatTtsInputText', () => {
    it('should wrap single word in quotes with trailing period', () => {
        expect(formatTtsInputText('audio')).toBe('"audio".');
    });

    it('should strip existing quotes before wrapping', () => {
        expect(formatTtsInputText('"audio"')).toBe('"audio".');
        expect(formatTtsInputText("'audio'")).toBe('"audio".');
    });

    it('should strip trailing periods before wrapping', () => {
        expect(formatTtsInputText('audio.')).toBe('"audio".');
        expect(formatTtsInputText('audio...')).toBe('"audio".');
    });

    it('should trim surrounding whitespace', () => {
        expect(formatTtsInputText('  audio  ')).toBe('"audio".');
    });

    it('should handle phrases and sentences cleanly', () => {
        expect(formatTtsInputText('she has a blue car.')).toBe('"she has a blue car".');
    });
});
