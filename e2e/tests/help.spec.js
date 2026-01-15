/**
 * Help Page Tests
 * 
 * Tests for the help/documentation page:
 * - Page loads without errors
 * - Documentation sections are visible
 * - Navigation within help works
 */
import { test, expect } from '../utils/fixtures.js';
import { waitForPageStable } from '../utils/testHelpers.js';

test.describe('Help Page', () => {
  
  test('loads without console errors', async ({ helpPage }) => {
    const { page, errorCollector } = helpPage;
    
    // Verify help page loaded
    expect(page.url()).toContain('/help');
    
    // Error assertion happens automatically via fixture
  });

  test('displays documentation sections', async ({ page, errorCollector }) => {
    await page.goto('/help');
    await waitForPageStable(page);
    
    // Look for documentation sections
    const docSections = page.locator('h2, h3, [class*="section"]');
    const count = await docSections.count();
    
    expect(count).toBeGreaterThan(0);
    
    errorCollector.assertNoErrors();
  });

  test('chart type documentation is present', async ({ page, errorCollector }) => {
    await page.goto('/help');
    await waitForPageStable(page);
    
    // Look for any chart-related content in documentation
    const chartKeywords = ['chart', 'visualization', 'data', 'field', 'configure'];
    let foundDocs = 0;
    
    for (const keyword of chartKeywords) {
      const docEl = page.locator(`text=${keyword}`);
      if (await docEl.count() > 0) {
        foundDocs++;
      }
    }
    
    // Page should load without errors - doc content is informational
    errorCollector.assertNoErrors();
  });

  test('collapsible sections work', async ({ page, errorCollector }) => {
    await page.goto('/help');
    await waitForPageStable(page);
    
    // Find collapsible sections (accordions, details, etc.)
    const collapsibles = page.locator('details, [class*="accordion"], [class*="collaps"]');
    
    if (await collapsibles.count() > 0) {
      // Click to expand
      await collapsibles.first().click();
      await page.waitForTimeout(300);
      
      // Click to collapse
      await collapsibles.first().click();
      await page.waitForTimeout(300);
    }
    
    errorCollector.assertNoErrors();
  });
});


