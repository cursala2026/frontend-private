import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 20000,
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    headless: true,
  },
  
  webServer: {
    command: 'npm start', 
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120 * 1000, 
  },
  
  tsconfig: './tsconfig.json',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});