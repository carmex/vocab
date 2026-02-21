module.exports = {
    preset: 'jest-preset-angular',
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
