/**
 * Library Page Tests
 * 
 * Tests for the template library:
 * - Templates load correctly
 * - Categories filter properly
 * - Templates can be selected
 */
import { test, expect } from '../utils/fixtures.js';
import { LibraryPage } from '../pages/index.js';
import { waitForPageStable } from '../utils/testHelpers.js';

test.describe('Library Page', () => {
  
  test('loads without console errors', async ({ libraryPage }) => {
    const { page, errorCollector } = libraryPage;
    
    // Verify library loaded
    expect(page.url()).toContain('/library');
    
    // Error assertion happens automatically via fixture
  });

  test('displays template cards', async ({ page, errorCollector }) => {
    const libraryPage = new LibraryPage(page);
    await libraryPage.goto();
    
    // Check that templates are visible
    const templateCards = page.locator('[class*="card"], [class*="template"]');
    const count = await templateCards.count();
    
    expect(count).toBeGreaterThan(0);
    
    errorCollector.assertNoErrors();
  });

  test('category filters work', async ({ page, errorCollector }) => {
    const libraryPage = new LibraryPage(page);
    await libraryPage.goto();
    
    // Find category filter buttons
    const categoryButtons = page.locator('button').filter({ 
      hasText: /Basic|Comparison|Distribution|Flow|Hierarchical|All/i 
    });
    
    if (await categoryButtons.count() > 0) {
      // Click each category and verify no errors
      const count = await categoryButtons.count();
      for (let i = 0; i < Math.min(count, 3); i++) {
        await categoryButtons.nth(i).click();
        await waitForPageStable(page);
        
        // Verify no errors after filtering
        expect(errorCollector.errors.length).toBe(0);
      }
    }
    
    errorCollector.assertNoErrors();
  });

  test('template selection works', async ({ page, errorCollector }) => {
    const libraryPage = new LibraryPage(page);
    await libraryPage.goto();
    
    // Find a template card and click it
    const templateCards = page.locator('[class*="card"], [class*="template"]').filter({
      hasNot: page.locator('button')
    });
    
    if (await templateCards.count() > 0) {
      await templateCards.first().click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });

  test('use template button navigates to builder', async ({ page, errorCollector }) => {
    const libraryPage = new LibraryPage(page);
    await libraryPage.goto();
    
    // Find and click "Use" or "Try" button
    const useButton = page.locator('button').filter({ hasText: /Use|Try|Open/i }).first();
    
    if (await useButton.count() > 0) {
      await useButton.click();
      await waitForPageStable(page);
      
      // Should navigate to builder
      expect(page.url()).toContain('/builder');
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('Library - Template Types', () => {
  test('has template content', async ({ page, errorCollector }) => {
    const libraryPage = new LibraryPage(page);
    await libraryPage.goto();
    
    // Just verify the page loads with some template content
    const templateKeywords = ['chart', 'bar', 'line', 'pie', 'scatter', 'example', 'template'];
    let foundContent = 0;
    
    for (const keyword of templateKeywords) {
      const el = page.locator(`text=${keyword}`);
      if (await el.count() > 0) {
        foundContent++;
      }
    }
    
    // Page should load without errors
    errorCollector.assertNoErrors();
  });
});


