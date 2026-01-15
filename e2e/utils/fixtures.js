import { test as base } from '@playwright/test';
import { ConsoleErrorCollector, waitForPageStable } from './testHelpers.js';

/**
 * Custom Test Fixtures for ProjectFlow
 * 
 * Extends Playwright's base test with:
 * - Automatic console error collection
 * - Error assertion at end of each test
 * - Common page objects
 * - Console log attachment to HTML report
 */

export const test = base.extend({
  /**
   * Console error collector - automatically attached to each test
   * Logs are attached to the HTML report for debugging
   */
  errorCollector: async ({ page }, use, testInfo) => {
    const collector = new ConsoleErrorCollector(page);
    const allLogs = [];
    
    // Collect ALL console messages (not just errors)
    page.on('console', (msg) => {
      allLogs.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: new Date().toISOString()
      });
    });
    
    collector.attach();
    
    await use(collector);
    
    // After test: attach all logs to the report
    if (allLogs.length > 0) {
      const logText = allLogs.map(log => 
        `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.text}`
      ).join('\n');
      
      await testInfo.attach('console-logs', {
        body: logText,
        contentType: 'text/plain'
      });
    }
    
    // Attach error summary if there are any errors
    const report = collector.generateReport();
    if (report.summary.hasIssues) {
      await testInfo.attach('error-report', {
        body: JSON.stringify(report, null, 2),
        contentType: 'application/json'
      });
    }
  },

  /**
   * Auto-wait for page stability
   */
  stablePage: async ({ page }, use) => {
    // Extend page with stability helpers
    page.waitForStable = async (options) => {
      await waitForPageStable(page, options);
    };
    
    await use(page);
  },

  /**
   * Pre-configured page with error collection
   */
  appPage: async ({ page, errorCollector }, use) => {
    // Navigate to home page
    await page.goto('/');
    await waitForPageStable(page);
    
    await use({ page, errorCollector });
    
    // Assert no errors after test
    errorCollector.assertNoErrors();
  },

  /**
   * Builder page fixture
   */
  builderPage: async ({ page, errorCollector }, use) => {
    await page.goto('/builder');
    await waitForPageStable(page);
    
    await use({ page, errorCollector });
    
    errorCollector.assertNoErrors();
  },

  /**
   * Library page fixture
   */
  libraryPage: async ({ page, errorCollector }, use) => {
    await page.goto('/library');
    await waitForPageStable(page);
    
    await use({ page, errorCollector });
    
    errorCollector.assertNoErrors();
  },

  /**
   * Help page fixture
   */
  helpPage: async ({ page, errorCollector }, use) => {
    await page.goto('/help');
    await waitForPageStable(page);
    
    await use({ page, errorCollector });
    
    errorCollector.assertNoErrors();
  },

  /**
   * Explore page fixture
   */
  explorePage: async ({ page, errorCollector }, use) => {
    await page.goto('/explore');
    await waitForPageStable(page);
    
    await use({ page, errorCollector });
    
    errorCollector.assertNoErrors();
  }
});

export { expect } from '@playwright/test';


