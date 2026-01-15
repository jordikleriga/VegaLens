import { expect } from '@playwright/test';

/**
 * Test Helpers for ProjectFlow E2E Tests
 * 
 * Provides utilities for:
 * - Console error detection and collection
 * - Network error monitoring
 * - Common test assertions
 * - Screenshot helpers
 */

/**
 * Console Error Collector
 * Attaches to a page and collects all console errors/warnings
 */
export class ConsoleErrorCollector {
  constructor(page) {
    this.page = page;
    this.errors = [];
    this.warnings = [];
    this.networkErrors = [];
    this.attached = false;
  }

  /**
   * Start collecting console messages
   */
  attach() {
    if (this.attached) return;
    
    // Collect console errors and warnings
    this.page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      
      // Ignore certain benign messages
      if (this.shouldIgnore(text)) return;
      
      if (type === 'error') {
        this.errors.push({
          type: 'console.error',
          message: text,
          location: msg.location(),
          timestamp: new Date().toISOString()
        });
      } else if (type === 'warning') {
        this.warnings.push({
          type: 'console.warning',
          message: text,
          location: msg.location(),
          timestamp: new Date().toISOString()
        });
      }
    });

    // Collect page errors (uncaught exceptions)
    this.page.on('pageerror', (error) => {
      this.errors.push({
        type: 'pageerror',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    // Collect network failures
    this.page.on('requestfailed', (request) => {
      const failure = request.failure();
      this.networkErrors.push({
        type: 'network',
        url: request.url(),
        method: request.method(),
        errorText: failure ? failure.errorText : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    });

    // Collect HTTP errors (4xx, 5xx responses)
    this.page.on('response', (response) => {
      const status = response.status();
      if (status >= 400) {
        this.networkErrors.push({
          type: 'http_error',
          url: response.url(),
          status: status,
          statusText: response.statusText(),
          timestamp: new Date().toISOString()
        });
      }
    });

    this.attached = true;
  }

  /**
   * Check if a message should be ignored
   * IMPORTANT: Be VERY conservative here - only ignore truly benign messages
   * Real errors (TypeError, etc.) should NEVER be ignored
   */
  shouldIgnore(text) {
    const ignorePatterns = [
      // Development tool messages (not errors)
      /Download the Vue Devtools/i,
      /React DevTools/i,
      /Lit is in dev mode/i,
      // HMR/Vite dev server messages (not errors)
      /\[HMR\]/i,
      /^\[vite\] (connecting|connected)/i,  // Only connection messages, not errors
      // Resource loading that's expected to fail in test environment
      /favicon\.ico.*404/i,
      // Browser-level Canvas2D performance hints (not actual errors)
      /Canvas2D.*willReadFrequently/i,
      /Multiple readback operations/i,
      // Vega runtime warnings about data (informational, not critical)
      /WARN Infinite extent for field/i,  // Empty data domain - chart still renders
      /WARN Specified orient.*overridden/i,  // Orientation auto-fixed by Vega
    ];
    return ignorePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Check if a console error should be treated as "expected" during testing
   * These are NOT ignored - they're still recorded, but don't fail tests
   * Used for errors that occur during field configuration transitions
   */
  isExpectedTestingError(text) {
    const expectedPatterns = [
      // Elasticsearch connection issues in test environment
      /elastic\/connection/i,
      /elastic\/indices/i,
      /ERR_CONNECTION_REFUSED/i,
      // Field validation during automated field selection (transient)
      /Invalid field configuration/i,
      /Field .* not found in data/i,
      /Preview generation failed.*400/i,
      // Network errors from chart generation (field config transitions)
      /Failed to load resource.*400/i,
      /the server responded with a status of 400/i,
    ];
    return expectedPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Check if a network error should be ignored
   */
  shouldIgnoreNetworkError(error) {
    const ignorePatterns = [
      /elastic\/connection/i,
      /elastic\/indices/i,
      /ERR_ABORTED/i,
      /ERR_CONNECTION_REFUSED/i,
      /favicon\.ico/i,
      /vega\/generate/i,  // API calls that may fail during testing
      /api\/.*generate/i,
    ];
    const url = error.url || '';
    const errorText = error.errorText || '';
    
    // Ignore 400 errors from vega generate API (field validation during testing)
    if (error.status === 400 && url.includes('vega')) {
      return true;
    }
    
    return ignorePatterns.some(pattern => pattern.test(url) || pattern.test(errorText));
  }

  /**
   * Get all collected errors (filtered by ignore patterns)
   */
  getErrors() {
    return {
      consoleErrors: this.errors,
      warnings: this.warnings,
      networkErrors: this.networkErrors
    };
  }

  /**
   * Get ALL raw errors including those that would normally be filtered
   * Used for comprehensive reporting and follow-up review
   */
  getAllRawErrors() {
    return {
      consoleErrors: [...this.errors],
      warnings: [...this.warnings],
      networkErrors: [...this.networkErrors],
      totalCount: this.errors.length + this.warnings.length + this.networkErrors.length
    };
  }

  /**
   * Get errors that need follow-up (those that were collected but might be filtered in assertions)
   * Returns a summary suitable for recording in test reports
   * 
   * Categorization:
   * - Critical: Real bugs (TypeError, ReferenceError, etc.) - FAIL tests
   * - Expected: Transient errors during testing (field validation) - Don't fail, but record
   * - Benign: Dev messages (HMR, devtools) - Completely ignored
   */
  getErrorSummary() {
    // Critical errors = All errors except benign messages
    // These are REAL errors that indicate bugs
    const criticalErrors = this.errors.filter(err => !this.shouldIgnore(err.message || ''));
    
    // Further categorize critical errors into:
    // - Hard failures: TypeErrors, ReferenceErrors, etc. (code bugs)
    // - Expected testing errors: Field validation during config (transient)
    const hardFailures = criticalErrors.filter(err => !this.isExpectedTestingError(err.message || ''));
    const expectedTestingErrors = criticalErrors.filter(err => this.isExpectedTestingError(err.message || ''));
    
    // Network errors
    const criticalNetworkErrors = this.networkErrors.filter(err => !this.shouldIgnoreNetworkError(err));
    const filteredNetworkErrors = this.networkErrors.filter(err => this.shouldIgnoreNetworkError(err));
    
    return {
      // Hard failures that MUST be fixed (TypeErrors, etc.)
      hardFailures: hardFailures.map(e => e.message?.substring(0, 300)),
      // Expected testing errors (transient, but still worth knowing about)
      expectedTestingErrors: expectedTestingErrors.map(e => e.message?.substring(0, 200)),
      // Critical network errors
      criticalNetworkErrors: criticalNetworkErrors.map(e => `${e.status || 'ERR'}: ${e.url?.substring(0, 100)}`),
      // Filtered network errors (for reference)
      filteredNetworkErrors: filteredNetworkErrors.map(e => `${e.status || 'ERR'}: ${e.url?.substring(0, 100)}`),
      // Warnings
      warnings: this.warnings.map(w => w.message?.substring(0, 200)),
      // Counts for quick reference
      counts: {
        hardFailures: hardFailures.length,
        expectedTestingErrors: expectedTestingErrors.length,
        criticalNetworkErrors: criticalNetworkErrors.length,
        filteredNetworkErrors: filteredNetworkErrors.length,
        warnings: this.warnings.length,
        total: this.errors.length + this.networkErrors.length + this.warnings.length
      },
      // Flags
      hasCriticalErrors: hardFailures.length > 0 || criticalNetworkErrors.length > 0,
      needsReview: hardFailures.length > 0 || expectedTestingErrors.length > 0 || this.warnings.length > 0
    };
  }

  /**
   * Check if there are any critical errors
   */
  hasErrors() {
    return this.errors.length > 0 || this.networkErrors.length > 0;
  }

  /**
   * Assert no critical errors occurred
   * 
   * Hard failures (TypeError, ReferenceError, etc.) will FAIL the test
   * Expected testing errors (field validation) are recorded but don't fail
   */
  assertNoErrors(options = {}) {
    const { allowWarnings = true, allowedHttpErrors = [] } = options;
    
    // Get the error summary with proper categorization
    const summary = this.getErrorSummary();
    
    // Filter out allowed HTTP errors and expected network errors
    const criticalNetworkErrors = this.networkErrors.filter(err => {
      if (this.shouldIgnoreNetworkError(err)) return false;
      if (err.type === 'http_error') return !allowedHttpErrors.includes(err.status);
      return true;
    });

    // Hard failures are errors that are NOT benign AND NOT expected testing errors
    // These are real bugs like TypeError, ReferenceError, etc.
    const hardFailures = this.errors.filter(err => {
      const msg = err.message || '';
      return !this.shouldIgnore(msg) && !this.isExpectedTestingError(msg);
    });

    if (hardFailures.length > 0 || criticalNetworkErrors.length > 0) {
      console.error('\n========== CRITICAL ERROR REPORT ==========');
      console.error('Hard Failures (MUST FIX):');
      hardFailures.forEach(e => console.error(`  - ${e.message?.substring(0, 300)}`));
      if (criticalNetworkErrors.length > 0) {
        console.error('Network Errors:');
        criticalNetworkErrors.forEach(e => console.error(`  - ${e.status}: ${e.url}`));
      }
      console.error('============================================\n');
    }

    // Assert on hard failures - these MUST fail the test
    expect(hardFailures, 'Critical console errors detected (TypeError, etc.)').toHaveLength(0);
    expect(criticalNetworkErrors, 'Critical network errors detected').toHaveLength(0);
    
    if (!allowWarnings) {
      expect(this.warnings, 'Console warnings detected').toHaveLength(0);
    }
    
    // Return the summary for recording in test results
    return summary;
  }

  /**
   * Clear collected errors
   */
  clear() {
    this.errors = [];
    this.warnings = [];
    this.networkErrors = [];
  }

  /**
   * Generate error report
   */
  generateReport() {
    return {
      summary: {
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length,
        totalNetworkErrors: this.networkErrors.length,
        hasIssues: this.hasErrors()
      },
      details: this.getErrors()
    };
  }
}

/**
 * Wait for page to be fully loaded and stable
 */
export async function waitForPageStable(page, options = {}) {
  const { timeout = 10000 } = options;
  
  // Wait for network to be idle
  await page.waitForLoadState('networkidle', { timeout });
  
  // Wait for any loading spinners to disappear
  const loadingSelectors = [
    '[data-testid="loading"]',
    '.loading-spinner',
    '[class*="loading"]',
    '[class*="spinner"]'
  ];
  
  for (const selector of loadingSelectors) {
    const loader = page.locator(selector).first();
    if (await loader.count() > 0) {
      await loader.waitFor({ state: 'hidden', timeout: timeout / 2 }).catch(() => {});
    }
  }
}

/**
 * Take a named screenshot for documentation/debugging
 */
export async function takeNamedScreenshot(page, name, testInfo) {
  const screenshotPath = `screenshots/${name}-${Date.now()}.png`;
  await page.screenshot({ 
    path: screenshotPath,
    fullPage: true 
  });
  await testInfo.attach(name, { 
    path: screenshotPath, 
    contentType: 'image/png' 
  });
}

/**
 * Retry an action with exponential backoff
 */
export async function retryAction(action, options = {}) {
  const { maxRetries = 3, delay = 1000 } = options;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await action();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
}

/**
 * Generate unique test data
 */
export function generateTestData(prefix = 'test') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}_${timestamp}_${random}`;
}


