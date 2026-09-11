import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/input-e2e', outputDir: './artifacts/local/input-test-results', fullyParallel: true, workers: 2, forbidOnly: true, retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop-input', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-input', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } } },
  ],
  webServer: {
    command: 'npm run build:input-test && vite preview --config tests/browser/vite.config.ts',
    url: 'http://127.0.0.1:4174', reuseExistingServer: false,
  },
});
