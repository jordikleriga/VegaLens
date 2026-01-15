/**
 * Base Page Object Model
 * 
 * Provides common functionality for all page objects:
 * - Navigation
 * - Common elements (header, sidebar)
 * - Utility methods
 */
export class BasePage {
  constructor(page) {
    this.page = page;
    
    // Common selectors
    this.selectors = {
      // Header elements
      header: 'header',
      logo: 'header a[href="/"]',
      
      // Sidebar elements
      sidebar: 'aside, nav, [class*="sidebar"]',
      
      // Navigation links
      navHome: 'a[href="/"]',
      navBuilder: 'a[href="/builder"]',
      navLibrary: 'a[href="/library"]',
      navExplore: 'a[href="/explore"]',
      navHelp: 'a[href="/help"]',
      
      // Common UI elements
      loadingSpinner: '[class*="loading"], [class*="spinner"]',
      notification: '[class*="notification"], [class*="toast"], [class*="alert"]',
      modal: '[class*="modal"], [role="dialog"]',
      dropdown: '[class*="dropdown"], [role="listbox"]',
      
      // Buttons
      primaryButton: 'button[class*="primary"], button[class*="bg-indigo"]',
      secondaryButton: 'button[class*="secondary"], button[class*="bg-gray"]',
    };
  }

  /**
   * Navigate to a specific path
   */
  async navigate(path = '/') {
    await this.page.goto(path);
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.hideLoadingSpinners();
  }

  /**
   * Wait for loading spinners to disappear
   */
  async hideLoadingSpinners() {
    const spinner = this.page.locator(this.selectors.loadingSpinner).first();
    if (await spinner.count() > 0) {
      await spinner.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    }
  }

  /**
   * Click navigation link
   */
  async navigateTo(destination) {
    const navMap = {
      'home': this.selectors.navHome,
      'builder': this.selectors.navBuilder,
      'library': this.selectors.navLibrary,
      'explore': this.selectors.navExplore,
      'help': this.selectors.navHelp
    };
    
    const selector = navMap[destination.toLowerCase()];
    if (!selector) throw new Error(`Unknown navigation destination: ${destination}`);
    
    await this.page.locator(selector).first().click();
    await this.waitForPageLoad();
  }

  /**
   * Check if element exists
   */
  async elementExists(selector) {
    return await this.page.locator(selector).count() > 0;
  }

  /**
   * Get text content of element
   */
  async getText(selector) {
    return await this.page.locator(selector).textContent();
  }

  /**
   * Wait for element to be visible
   */
  async waitForElement(selector, options = {}) {
    await this.page.locator(selector).waitFor({ 
      state: 'visible',
      timeout: options.timeout || 10000 
    });
  }

  /**
   * Click element with retry
   */
  async clickWithRetry(selector, options = {}) {
    const { retries = 3, delay = 500 } = options;
    
    for (let i = 0; i < retries; i++) {
      try {
        await this.page.locator(selector).click({ timeout: 5000 });
        return;
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.page.waitForTimeout(delay);
      }
    }
  }

  /**
   * Fill input field
   */
  async fillInput(selector, value) {
    await this.page.locator(selector).fill(value);
  }

  /**
   * Select option from dropdown
   */
  async selectOption(selector, value) {
    await this.page.locator(selector).selectOption(value);
  }

  /**
   * Take screenshot
   */
  async screenshot(name) {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  /**
   * Get current URL
   */
  getCurrentUrl() {
    return this.page.url();
  }

  /**
   * Check if notification appeared
   */
  async hasNotification(type = 'any') {
    const notification = this.page.locator(this.selectors.notification);
    return await notification.count() > 0;
  }

  /**
   * Close modal if open
   */
  async closeModal() {
    const modal = this.page.locator(this.selectors.modal);
    if (await modal.count() > 0) {
      // Try clicking close button or backdrop
      const closeBtn = modal.locator('button[class*="close"], [aria-label="Close"]');
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
      } else {
        await this.page.keyboard.press('Escape');
      }
      await modal.waitFor({ state: 'hidden' }).catch(() => {});
    }
  }
}


