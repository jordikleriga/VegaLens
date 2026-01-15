import { BasePage } from './BasePage.js';

/**
 * Library Page Object Model
 * 
 * Handles interactions with the template library:
 * - Browsing templates
 * - Filtering by category
 * - Selecting and previewing templates
 */
export class LibraryPage extends BasePage {
  constructor(page) {
    super(page);
    
    this.selectors = {
      ...this.selectors,
      
      // Template grid
      templateGrid: '[class*="grid"], [class*="template-list"]',
      templateCard: '[class*="template"], [class*="card"]',
      
      // Categories
      categoryFilter: '[class*="category"], [class*="filter"]',
      categoryButton: 'button[class*="category"]',
      
      // Search
      searchInput: 'input[type="search"], input[placeholder*="Search"]',
      
      // Template details
      templateTitle: '[class*="title"], h2, h3',
      templateDescription: '[class*="description"], p',
      templatePreview: '[class*="preview"], canvas, svg',
      
      // Actions
      useTemplateButton: 'button:has-text("Use"), button:has-text("Try")',
      viewDetailsButton: 'button:has-text("View"), button:has-text("Details")',
    };
  }

  /**
   * Navigate to library page
   */
  async goto() {
    await this.navigate('/library');
  }

  /**
   * Search for templates
   */
  async search(query) {
    const searchInput = this.page.locator(this.selectors.searchInput).first();
    await searchInput.fill(query);
    await this.waitForPageLoad();
  }

  /**
   * Filter by category
   */
  async filterByCategory(category) {
    await this.page.locator(`button:has-text("${category}")`).first().click();
    await this.waitForPageLoad();
  }

  /**
   * Get number of visible templates
   */
  async getTemplateCount() {
    return await this.page.locator(this.selectors.templateCard).count();
  }

  /**
   * Click on a template by name
   */
  async selectTemplate(templateName) {
    await this.page.locator(`text="${templateName}"`).first().click();
    await this.waitForPageLoad();
  }

  /**
   * Use a template (opens in builder)
   */
  async useTemplate(templateName) {
    await this.selectTemplate(templateName);
    await this.page.locator(this.selectors.useTemplateButton).first().click();
    await this.waitForPageLoad();
  }

  /**
   * Get all template names
   */
  async getTemplateNames() {
    const cards = this.page.locator(this.selectors.templateCard);
    const count = await cards.count();
    const names = [];
    
    for (let i = 0; i < count; i++) {
      const title = await cards.nth(i).locator(this.selectors.templateTitle).first().textContent();
      if (title) names.push(title.trim());
    }
    
    return names;
  }

  /**
   * Check if a specific template exists
   */
  async hasTemplate(templateName) {
    const templates = await this.getTemplateNames();
    return templates.some(t => t.toLowerCase().includes(templateName.toLowerCase()));
  }

  /**
   * Get available categories
   */
  async getCategories() {
    const buttons = this.page.locator(this.selectors.categoryButton);
    const count = await buttons.count();
    const categories = [];
    
    for (let i = 0; i < count; i++) {
      const text = await buttons.nth(i).textContent();
      if (text) categories.push(text.trim());
    }
    
    return categories;
  }
}


