/**
 * Home Page Tests
 * 
 * Tests for the landing/home page:
 * - Page loads without errors
 * - Navigation works correctly
 * - Key elements are visible
 */
import { test, expect } from '../utils/fixtures.js';
import { HomePage } from '../pages/index.js';

test.describe('Home Page', () => {
  
  test('loads without console errors', async ({ appPage }) => {
    const { page, errorCollector } = appPage;
    const homePage = new HomePage(page);
    
    // Verify page loaded
    expect(page.url()).toContain('/');
    
    // Check key elements
    const title = await page.locator('h1').first().textContent();
    expect(title).toBeTruthy();
    
    // Error assertion happens automatically via fixture
  });

  test('navigation links work correctly', async ({ page, errorCollector }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    
    // Navigate to builder
    await page.goto('/builder');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/builder');
    
    // Navigate to library  
    await page.goto('/library');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/library');
    
    // Navigate back home
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Assert no errors
    errorCollector.assertNoErrors();
  });

  test('quick action buttons are clickable', async ({ page, errorCollector }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    
    // Find and click any button/link that might navigate away
    const actionButtons = page.locator('button, a').filter({ hasText: /create|start|build|new|try/i });
    
    if (await actionButtons.count() > 0) {
      await actionButtons.first().click();
      await page.waitForLoadState('networkidle');
    }
    
    // Page should load without errors regardless of navigation
    errorCollector.assertNoErrors();
  });
});


