import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv();

// Silence console logs during tests to reduce noise
/* eslint-disable no-console */
global.console.log = () => { };
global.console.debug = () => { };
global.console.info = () => { };
/* eslint-enable no-console */
