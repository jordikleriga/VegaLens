import { BasePage } from './BasePage.js';

/**
 * Home Page Object Model
 * 
 * Handles interactions with the home/landing page:
 * - Quick actions
 * - Dashboard overview
 * - Navigation to other sections
 */
export class HomePage extends BasePage {
  constructor(page) {
    super(page);
    
    this.selectors = {
      ...this.selectors,
      
      // Hero section
      hero: '[class*="hero"], main > section:first-child',
      heroTitle: 'h1',
      heroSubtitle: 'h2, p[class*="subtitle"]',
      
      // Quick actions
      createButton: 'button:has-text("Create"), a:has-text("Create")',
      getStartedButton: 'button:has-text("Get Started"), a:has-text("Get Started")',
      
      // Feature cards
      featureCard: '[class*="feature"], [class*="card"]',
      
      // Recent dashboards
      recentSection: '[class*="recent"]',
      dashboardCard: '[class*="dashboard"]',
    };
  }

  /**
   * Navigate to home page
   */
  async goto() {
    await this.navigate('/');
  }

  /**
   * Click create/get started button
   */
  async clickGetStarted() {
    const btn = this.page.locator(this.selectors.getStartedButton).or(
      this.page.locator(this.selectors.createButton)
    ).first();
    await btn.click();
    await this.waitForPageLoad();
  }

  /**
   * Get page title
   */
  async getTitle() {
    return await this.page.locator(this.selectors.heroTitle).first().textContent();
  }

  /**
   * Check if home page loaded correctly
   */
  async isLoaded() {
    const hero = this.page.locator(this.selectors.hero);
    return await hero.count() > 0;
  }

  /**
   * Get number of feature cards
   */
  async getFeatureCount() {
    return await this.page.locator(this.selectors.featureCard).count();
  }
}


