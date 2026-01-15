import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for ProjectFlow E2E Tests
 * 
 * This configuration sets up automated UI testing with:
 * - Console error detection and logging
 * - Screenshot on failure
 * - Video recording for debugging
 * - Multiple browser support
 */
export default defineConfig({
  // Global setup - runs once before all tests
  globalSetup: './global-setup.js',
  
  // Test directory
  testDir: './tests',
  
  // Test file pattern
  testMatch: '**/*.spec.js',
  
  // Timeout for each test (90 seconds for complex chart configuration)
  timeout: 90000,
  
  // Expect timeout
  expect: {
    timeout: 10000
  },
  
  // Run tests in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only
  forbidOnly: !!process.env.CI,
  
  // Retry failed tests (useful for flaky tests)
  retries: process.env.CI ? 2 : 0,
  
  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  // Output folder for test artifacts
  outputDir: 'test-results/artifacts',
  
  // Shared settings for all projects
  use: {
    // Base URL for navigation
    baseURL: 'http://localhost:5173',
    
    // Collect trace for debugging - 'on' captures console logs, network, etc.
    // Options: 'off', 'on', 'retain-on-failure', 'on-first-retry'
    trace: 'retain-on-failure',
    
    // Screenshot options: 'off', 'on', 'only-on-failure'
    // 'on' = screenshot after every test (good for documentation)
    // 'only-on-failure' = screenshot only when test fails
    screenshot: 'on',
    
    // Video options: 'off', 'on', 'retain-on-failure', 'on-first-retry'
    video: 'retain-on-failure',
    
    // Viewport size
    viewport: { width: 1920, height: 1080 },
    
    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,
    
    // Action timeout
    actionTimeout: 15000,
    
    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Browser projects
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to add more browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Web server configuration - starts the dev servers before tests
  webServer: [
    {
      command: 'cd ../backend && npm run dev',
      url: 'http://localhost:3001/health',
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd ../frontend && npm run dev',
      url: 'http://localhost:5173',
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
    }
  ],
});


