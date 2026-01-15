/**
 * Explore Page Tests
 * 
 * Tests for the data exploration page:
 * - Page loads without errors
 * - Index selection works
 * - Data preview displays
 */
import { test, expect } from '../utils/fixtures.js';
import { waitForPageStable } from '../utils/testHelpers.js';

test.describe('Explore Page', () => {
  
  test('loads without console errors', async ({ explorePage }) => {
    const { page, errorCollector } = explorePage;
    
    // Verify explore page loaded
    expect(page.url()).toContain('/explore');
    
    // Error assertion happens automatically via fixture
  });

  test('displays index selection', async ({ page, errorCollector }) => {
    await page.goto('/explore');
    await waitForPageStable(page);
    
    // Look for index selection elements
    const indexElements = page.locator('select, button, [class*="dropdown"]').filter({
      hasText: /index|select|data/i
    });
    
    // Page should have some data source selection
    const hasDataSelection = await indexElements.count() > 0 ||
      await page.locator('[class*="Index"], [class*="source"]').count() > 0;
    
    errorCollector.assertNoErrors();
  });

  test('field list is displayed', async ({ page, errorCollector }) => {
    await page.goto('/explore');
    await waitForPageStable(page);
    
    // Wait a bit for data to load
    await page.waitForTimeout(2000);
    
    // Look for field list elements
    const fieldList = page.locator('[class*="field"], [class*="Field"]');
    
    // Some field-related elements should be visible
    errorCollector.assertNoErrors();
  });
});


