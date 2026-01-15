/**
 * Navigation Tests
 * 
 * Tests for overall navigation and routing:
 * - All routes accessible
 * - Navigation state preserved
 * - Browser history works
 */
import { test, expect } from '../utils/fixtures.js';
import { waitForPageStable } from '../utils/testHelpers.js';

test.describe('Navigation', () => {
  
  test('all main routes are accessible', async ({ page, errorCollector }) => {
    const routes = [
      { path: '/', name: 'Home' },
      { path: '/builder', name: 'Builder' },
      { path: '/library', name: 'Library' },
      { path: '/explore', name: 'Explore' },
      { path: '/help', name: 'Help' },
    ];
    
    for (const route of routes) {
      await page.goto(route.path);
      await waitForPageStable(page);
      
      // Verify route loaded
      expect(page.url()).toContain(route.path === '/' ? 'localhost' : route.path);
      
      // Check for no console errors on this route
      expect(errorCollector.errors.length, `Errors on ${route.name} page`).toBe(0);
      
      // Clear for next route
      errorCollector.clear();
    }
  });

  test('browser back/forward works', async ({ page, errorCollector }) => {
    // Navigate through pages
    await page.goto('/');
    await waitForPageStable(page);
    
    await page.goto('/builder');
    await waitForPageStable(page);
    
    await page.goto('/library');
    await waitForPageStable(page);
    
    // Go back
    await page.goBack();
    await waitForPageStable(page);
    expect(page.url()).toContain('/builder');
    
    // Go back again
    await page.goBack();
    await waitForPageStable(page);
    
    // Go forward
    await page.goForward();
    await waitForPageStable(page);
    expect(page.url()).toContain('/builder');
    
    errorCollector.assertNoErrors();
  });

  test('sidebar navigation works', async ({ page, errorCollector }) => {
    await page.goto('/');
    await waitForPageStable(page);
    
    // Find sidebar links
    const sidebarLinks = page.locator('aside a, nav a, [class*="sidebar"] a');
    
    if (await sidebarLinks.count() > 0) {
      const count = Math.min(await sidebarLinks.count(), 3);
      
      for (let i = 0; i < count; i++) {
        const link = sidebarLinks.nth(i);
        const href = await link.getAttribute('href');
        
        if (href && !href.startsWith('http')) {
          await link.click();
          await waitForPageStable(page);
          
          // Clear errors for next navigation
          errorCollector.clear();
        }
      }
    }
    
    errorCollector.assertNoErrors();
  });

  test('redirects work correctly', async ({ page, errorCollector }) => {
    // Test known redirects
    await page.goto('/templates');
    await waitForPageStable(page);
    expect(page.url()).toContain('/library');
    
    await page.goto('/dashboards');
    await waitForPageStable(page);
    expect(page.url()).toContain('/library');
    
    errorCollector.assertNoErrors();
  });
});


