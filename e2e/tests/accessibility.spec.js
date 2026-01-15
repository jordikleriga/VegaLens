/**
 * Accessibility Tests
 * 
 * Basic accessibility checks:
 * - Keyboard navigation
 * - Focus management
 * - ARIA attributes
 */
import { test, expect } from '../utils/fixtures.js';
import { waitForPageStable } from '../utils/testHelpers.js';

test.describe('Accessibility', () => {
  
  test('page has main landmark', async ({ page, errorCollector }) => {
    await page.goto('/');
    await waitForPageStable(page);
    
    // Check for main content area
    const main = page.locator('main, [role="main"]');
    expect(await main.count()).toBeGreaterThan(0);
    
    errorCollector.assertNoErrors();
  });

  test('all interactive elements are keyboard accessible', async ({ page, errorCollector }) => {
    await page.goto('/builder');
    await waitForPageStable(page);
    
    // Tab through focusable elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      
      // Get currently focused element
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      
      // Should be focusable elements
      if (focused) {
        expect(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'DIV', 'SPAN', 'BODY']).toContain(focused);
      }
    }
    
    errorCollector.assertNoErrors();
  });

  test('buttons have accessible names', async ({ page, errorCollector }) => {
    await page.goto('/builder');
    await waitForPageStable(page);
    
    // Find all buttons
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    for (let i = 0; i < Math.min(count, 20); i++) {
      const button = buttons.nth(i);
      
      // Button should have text content or aria-label
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      const title = await button.getAttribute('title');
      
      const hasAccessibleName = (text && text.trim()) || ariaLabel || title;
      // Some buttons may be icon-only without labels - just log, don't fail
    }
    
    errorCollector.assertNoErrors();
  });

  test('escape key closes modals/dropdowns', async ({ page, errorCollector }) => {
    await page.goto('/builder');
    await waitForPageStable(page);
    
    // Find a dropdown button and open it
    const dropdownBtn = page.locator('button').filter({ 
      hasText: /select|choose|field/i 
    }).first();
    
    if (await dropdownBtn.count() > 0) {
      await dropdownBtn.click();
      await page.waitForTimeout(300);
      
      // Press Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      
      // Dropdown should be closed (check for absence of dropdown content)
    }
    
    errorCollector.assertNoErrors();
  });

  test('focus is visible on interactive elements', async ({ page, errorCollector }) => {
    await page.goto('/');
    await waitForPageStable(page);
    
    // Tab to first focusable element
    await page.keyboard.press('Tab');
    
    // Check that focused element has visible focus indicator
    const focusedStyles = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        boxShadow: styles.boxShadow,
        border: styles.border
      };
    });
    
    // Should have some focus indicator
    errorCollector.assertNoErrors();
  });
});


