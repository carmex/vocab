const { createCjsPreset } = require('jest-preset-angular/presets');

const basePreset = createCjsPreset({
    astTransformers: {
        before: [
            require.resolve('./jest-import-meta-transformer.js')
        ]
    }
});

module.exports = {
    ...basePreset,
    setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
    globalSetup: 'jest-preset-angular/global-setup',
    testRegex: '.*\\.spec\\.ts$',
    testPathIgnorePatterns: [
        '<rootDir>/node_modules/',
        '<rootDir>/dist/',
        '<rootDir>/src/test.ts',
        '<rootDir>/e2e/',
        '<rootDir>/src/environments/'
    ],
    transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$|rxjs|vosk-browser|double-metaphone))'],
};

