import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://127.0.0.1:5173',
    viewportWidth: 1280,
    viewportHeight: 720,
    requestTimeout: 10000,
    video: false,
    screenshotOnRunFailure: false,
    defaultCommandTimeout: 10000,
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.js',
  },
});
