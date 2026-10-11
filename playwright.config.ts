import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'es-VE',
    timezoneId: 'America/Caracas',
    acceptDownloads: true,
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { viewport: { width: 1366, height: 900 } } },
  ],
  webServer: {
    command: 'node tests/serve.mjs',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});
