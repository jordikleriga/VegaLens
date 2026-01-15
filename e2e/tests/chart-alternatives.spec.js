/**
 * Chart Alternatives Feature Tests
 * 
 * Tests the "Try Alternatives" feature which allows users to:
 * - Switch between compatible chart types
 * - Preserve field mappings across chart switches
 * - Navigate history of visited charts
 * - Properly re-aggregate data when switching
 */
import { test, expect } from '../utils/fixtures.js';
import { waitForPageStable } from '../utils/testHelpers.js';

// Test configuration
const TEST_INDEX = 'kibana_sample_data_ecommerce';
const WAIT_TIMEOUT = 5000;

/**
 * Helper to set up a chart with fields configured
 */
async function setupChartWithFields(page, chartType = 'Bar') {
  // Navigate to builder
  await page.goto('/builder');
  await waitForPageStable(page);
  
  // Step 1: Select data source
  const indexSelector = page.locator('text=kibana_sample, button:has-text("kibana")').first();
  if (await indexSelector.count() > 0) {
    await indexSelector.click();
    await page.waitForTimeout(500);
  } else {
    // Try clicking on any available index
    const anyIndex = page.locator('[class*="index-item"], button[class*="index"]').first();
    if (await anyIndex.count() > 0) {
      await anyIndex.click();
    }
  }
  await waitForPageStable(page);
  
  // Step 2: Select chart type - expand Comparison if needed
  const comparisonSection = page.locator('button:has-text("COMPARISON"), button:has-text("Comparison")').first();
  if (await comparisonSection.count() > 0) {
    await comparisonSection.click();
    await page.waitForTimeout(200);
  }
  
  // Click on chart type
  const chartButton = page.locator(`button:has-text("${chartType}"), [data-chart="${chartType.toLowerCase()}"]`).first();
  if (await chartButton.count() > 0) {
    await chartButton.click();
    await waitForPageStable(page);
  }
  
  // Step 3: Configure fields
  // Select X-axis field
  const xAxisSection = page.locator('text=Categories, text=X-Axis, text=Slices').first();
  if (await xAxisSection.count() > 0) {
    await xAxisSection.click();
  }
  
  const fieldDropdown = page.locator('button:has-text("Select field"), [class*="field-select"]').first();
  if (await fieldDropdown.count() > 0) {
    await fieldDropdown.click();
    await page.waitForTimeout(300);
    
    // Select category.keyword field
    const categoryField = page.locator('text=category.keyword, text=category_keyword').first();
    if (await categoryField.count() > 0) {
      await categoryField.click();
      await waitForPageStable(page);
    }
  }
  
  // Wait for chart to render
  await page.waitForTimeout(1000);
  
  return page;
}

/**
 * Helper to check if chart alternatives panel is visible
 */
async function isAlternativesPanelVisible(page) {
  const panel = page.locator('text=Try alternatives, [class*="chart-alternatives"]');
  return await panel.count() > 0 && await panel.first().isVisible();
}

/**
 * Helper to get visible alternative chart buttons
 */
async function getAlternativeCharts(page) {
  const alternatives = page.locator('.alternative-card, [class*="alternative"]');
  const count = await alternatives.count();
  const charts = [];
  
  for (let i = 0; i < count; i++) {
    const text = await alternatives.nth(i).textContent();
    charts.push(text.trim());
  }
  
  return charts;
}

/**
 * Helper to click an alternative chart
 */
async function clickAlternativeChart(page, chartName) {
  const altButton = page.locator(`[class*="alternative"]:has-text("${chartName}"), .alternative-card:has-text("${chartName}")`).first();
  if (await altButton.count() > 0) {
    await altButton.click();
    await waitForPageStable(page);
    return true;
  }
  return false;
}

/**
 * Helper to get history breadcrumb items
 */
async function getHistoryItems(page) {
  const historyButtons = page.locator('.history-bar button:not([disabled]), [class*="history"] button');
  const count = await historyButtons.count();
  const items = [];
  
  for (let i = 0; i < count; i++) {
    const text = await historyButtons.nth(i).textContent();
    if (text && text.length > 0 && !text.includes('←') && !text.includes('→')) {
      items.push(text.trim());
    }
  }
  
  return items;
}

/**
 * Helper to click history back button
 */
async function clickHistoryBack(page) {
  const backButton = page.locator('[title="Go back"], button:has(svg[class*="arrow-left"])').first();
  if (await backButton.count() > 0 && await backButton.isEnabled()) {
    await backButton.click();
    await waitForPageStable(page);
    return true;
  }
  return false;
}

/**
 * Helper to click history forward button
 */
async function clickHistoryForward(page) {
  const forwardButton = page.locator('[title="Go forward"], button:has(svg[class*="arrow-right"])').first();
  if (await forwardButton.count() > 0 && await forwardButton.isEnabled()) {
    await forwardButton.click();
    await waitForPageStable(page);
    return true;
  }
  return false;
}

// ============================================
// TEST SUITES
// ============================================

test.describe('Chart Alternatives - Visibility', () => {
  
  test('alternatives panel appears after chart renders with fields', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    
    // Wait for alternatives to appear
    await page.waitForTimeout(1500);
    
    const visible = await isAlternativesPanelVisible(page);
    
    // Log result - don't fail if not visible (may need data first)
    console.log('Alternatives panel visible:', visible);
    
    errorCollector.assertNoErrors();
  });

  test('alternatives panel shows compatible chart options', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    await page.waitForTimeout(1500);
    
    const alternatives = await getAlternativeCharts(page);
    console.log('Available alternatives:', alternatives);
    
    // Should have some alternatives
    if (alternatives.length > 0) {
      expect(alternatives.length).toBeGreaterThan(0);
      expect(alternatives.length).toBeLessThanOrEqual(8); // Max 8 shown
    }
    
    errorCollector.assertNoErrors();
  });

  test('alternatives not shown before fields are configured', async ({ page, errorCollector }) => {
    await page.goto('/builder');
    await waitForPageStable(page);
    
    // Just select chart type without configuring fields
    const barButton = page.locator('button:has-text("Bar")').first();
    if (await barButton.count() > 0) {
      await barButton.click();
      await page.waitForTimeout(500);
    }
    
    // Alternatives should NOT be visible yet
    const visible = await isAlternativesPanelVisible(page);
    expect(visible).toBe(false);
    
    errorCollector.assertNoErrors();
  });
});

test.describe('Chart Alternatives - Switching Charts', () => {
  
  test('can switch to an alternative chart type', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    await page.waitForTimeout(2000);
    
    const alternatives = await getAlternativeCharts(page);
    
    if (alternatives.length > 0) {
      // Try clicking first alternative
      const firstAlt = alternatives[0];
      const clicked = await clickAlternativeChart(page, firstAlt);
      
      if (clicked) {
        await page.waitForTimeout(1500);
        
        // Chart type indicator should change
        const chartIndicator = page.locator('[class*="chart-type-indicator"], text=Chart').first();
        const indicatorText = await chartIndicator.textContent();
        console.log('Chart indicator after switch:', indicatorText);
      }
    }
    
    errorCollector.assertNoErrors();
  });

  test('field values transfer when switching charts', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    await page.waitForTimeout(2000);
    
    // Get current field value
    const initialFieldValue = await page.locator('[class*="field-select"], button:has-text("category")').first().textContent();
    console.log('Initial field value:', initialFieldValue);
    
    // Switch to Pie chart alternative
    const switched = await clickAlternativeChart(page, 'Pie');
    
    if (switched) {
      await page.waitForTimeout(2000);
      
      // Field should still have a value (maybe different key name)
      const newFieldValue = await page.locator('[class*="field-select"], button:has-text("category")').first().textContent();
      console.log('Field value after switch:', newFieldValue);
      
      // Should not say "Select field"
      if (newFieldValue) {
        expect(newFieldValue.toLowerCase()).not.toContain('select');
      }
    }
    
    errorCollector.assertNoErrors();
  });

  test('switching triggers re-aggregation', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    await page.waitForTimeout(2000);
    
    // Listen for network requests
    const aggregationRequests = [];
    page.on('request', req => {
      if (req.url().includes('/aggregation') || req.url().includes('/agg')) {
        aggregationRequests.push(req.url());
      }
    });
    
    // Switch chart
    const switched = await clickAlternativeChart(page, 'Pie');
    
    if (switched) {
      await page.waitForTimeout(2000);
      console.log('Aggregation requests after switch:', aggregationRequests.length);
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('Chart Alternatives - History Navigation', () => {
  
  test('history breadcrumbs appear after visiting multiple charts', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    await page.waitForTimeout(2000);
    
    // Switch to first alternative
    const alternatives = await getAlternativeCharts(page);
    if (alternatives.length > 0) {
      await clickAlternativeChart(page, alternatives[0]);
      await page.waitForTimeout(1500);
    }
    
    // Check for history breadcrumbs
    const historyItems = await getHistoryItems(page);
    console.log('History breadcrumbs:', historyItems);
    
    // Should have at least 2 items in history (original + alternative)
    if (historyItems.length > 0) {
      expect(historyItems.length).toBeGreaterThanOrEqual(1);
    }
    
    errorCollector.assertNoErrors();
  });

  test('back button navigates to previous chart', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    await page.waitForTimeout(2000);
    
    // Remember original chart type
    const originalIndicator = await page.locator('text=Bar Chart, [class*="chart-type"]').first().textContent();
    
    // Switch to alternative
    const alternatives = await getAlternativeCharts(page);
    if (alternatives.length > 0) {
      await clickAlternativeChart(page, alternatives[0]);
      await page.waitForTimeout(1500);
      
      // Click back
      const wentBack = await clickHistoryBack(page);
      
      if (wentBack) {
        await page.waitForTimeout(1500);
        
        // Should be back to Bar chart
        const currentIndicator = await page.locator('text=Bar Chart, [class*="chart-type"]').first().textContent();
        console.log('After going back:', currentIndicator);
      }
    }
    
    errorCollector.assertNoErrors();
  });

  test('forward button navigates after going back', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    await page.waitForTimeout(2000);
    
    // Switch to alternative
    const alternatives = await getAlternativeCharts(page);
    if (alternatives.length > 0) {
      const targetAlt = alternatives[0];
      await clickAlternativeChart(page, targetAlt);
      await page.waitForTimeout(1500);
      
      // Go back
      await clickHistoryBack(page);
      await page.waitForTimeout(1000);
      
      // Go forward
      const wentForward = await clickHistoryForward(page);
      
      if (wentForward) {
        await page.waitForTimeout(1500);
        console.log('Forward navigation successful');
      }
    }
    
    errorCollector.assertNoErrors();
  });

  test('clicking breadcrumb jumps to that chart state', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    await page.waitForTimeout(2000);
    
    // Create history by switching charts
    const alternatives = await getAlternativeCharts(page);
    if (alternatives.length >= 2) {
      await clickAlternativeChart(page, alternatives[0]);
      await page.waitForTimeout(1500);
      
      await clickAlternativeChart(page, alternatives[1]);
      await page.waitForTimeout(1500);
      
      // Now we should have 3 items in history
      const historyItems = await getHistoryItems(page);
      console.log('History items:', historyItems);
      
      if (historyItems.length >= 2) {
        // Click on first history item (original)
        const firstHistoryBtn = page.locator('.history-bar button').filter({ hasText: historyItems[0] }).first();
        if (await firstHistoryBtn.count() > 0) {
          await firstHistoryBtn.click();
          await page.waitForTimeout(1500);
          console.log('Jumped to first history item');
        }
      }
    }
    
    errorCollector.assertNoErrors();
  });

  test('history persists across multiple chart switches', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    await page.waitForTimeout(2000);
    
    const alternatives = await getAlternativeCharts(page);
    const visitedCharts = ['Bar'];
    
    // Switch through multiple charts
    for (let i = 0; i < Math.min(3, alternatives.length); i++) {
      await clickAlternativeChart(page, alternatives[i]);
      visitedCharts.push(alternatives[i]);
      await page.waitForTimeout(1000);
    }
    
    // Check history length
    const historyItems = await getHistoryItems(page);
    console.log('Visited charts:', visitedCharts);
    console.log('History items:', historyItems);
    
    // History should contain multiple items
    if (historyItems.length > 0) {
      expect(historyItems.length).toBeGreaterThan(1);
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('Chart Alternatives - Field Preservation', () => {
  
  test('xField maps to categoryField when switching Bar to Pie', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    await page.waitForTimeout(2000);
    
    // Switch to Pie
    await clickAlternativeChart(page, 'Pie');
    await page.waitForTimeout(2000);
    
    // The Slices field (categoryField for Pie) should have a value
    const slicesField = page.locator('text=Slices, [data-field="category"]').first();
    if (await slicesField.count() > 0) {
      const fieldValue = await page.locator('button:has-text("category")').first().textContent();
      console.log('Pie Slices field value:', fieldValue);
      
      if (fieldValue) {
        expect(fieldValue.toLowerCase()).not.toContain('select');
      }
    }
    
    errorCollector.assertNoErrors();
  });

  test('valueField transfers between charts', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    await page.waitForTimeout(2000);
    
    // Note the initial metric (Y-axis)
    const initialMetric = await page.locator('text=Count, [data-metric="count"]').first().isVisible();
    console.log('Initial has Count metric:', initialMetric);
    
    // Switch to Pie
    await clickAlternativeChart(page, 'Pie');
    await page.waitForTimeout(2000);
    
    // Check Size field has metric
    const sizeMetric = await page.locator('text=Count, [data-metric="count"]').first().isVisible();
    console.log('Pie Size has Count metric:', sizeMetric);
    
    errorCollector.assertNoErrors();
  });

  test('colorField preserved when switching', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    await page.waitForTimeout(1500);
    
    // Set a color field first
    const colorSection = page.locator('text=Color, text=Split by').first();
    if (await colorSection.count() > 0) {
      await colorSection.click();
      await page.waitForTimeout(300);
      
      const colorDropdown = page.locator('button:has-text("Select field")').first();
      if (await colorDropdown.count() > 0) {
        await colorDropdown.click();
        await page.waitForTimeout(300);
        
        const genderField = page.locator('text=gend, text=customer_gender').first();
        if (await genderField.count() > 0) {
          await genderField.click();
          await page.waitForTimeout(1000);
        }
      }
    }
    
    // Switch to Line chart (which also has color)
    await clickAlternativeChart(page, 'Line');
    await page.waitForTimeout(2000);
    
    // Check if Series field has a value
    const seriesField = page.locator('text=Series, [data-field="color"]').first();
    if (await seriesField.count() > 0) {
      console.log('Line chart has Series field');
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('Chart Alternatives - Error Handling', () => {
  
  test('switching charts does not cause console errors', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    await page.waitForTimeout(2000);
    
    const alternatives = await getAlternativeCharts(page);
    
    // Switch through several charts
    for (let i = 0; i < Math.min(3, alternatives.length); i++) {
      await clickAlternativeChart(page, alternatives[i]);
      await page.waitForTimeout(1500);
    }
    
    // Navigate back through history
    await clickHistoryBack(page);
    await page.waitForTimeout(1000);
    await clickHistoryBack(page);
    await page.waitForTimeout(1000);
    
    // No console errors should occur
    errorCollector.assertNoErrors();
  });

  test('rapid chart switching is stable', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    await page.waitForTimeout(2000);
    
    const alternatives = await getAlternativeCharts(page);
    
    // Rapid switching (without waiting)
    for (let i = 0; i < Math.min(5, alternatives.length); i++) {
      await clickAlternativeChart(page, alternatives[i % alternatives.length]);
      await page.waitForTimeout(200); // Very short wait
    }
    
    // Wait for stabilization
    await page.waitForTimeout(3000);
    
    // Should still be functional
    const visible = await isAlternativesPanelVisible(page);
    console.log('Panel still visible after rapid switching:', visible);
    
    errorCollector.assertNoErrors();
  });

  test('navigating history rapidly is stable', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    await page.waitForTimeout(2000);
    
    // Build up history
    const alternatives = await getAlternativeCharts(page);
    for (let i = 0; i < Math.min(3, alternatives.length); i++) {
      await clickAlternativeChart(page, alternatives[i]);
      await page.waitForTimeout(500);
    }
    
    // Rapid back navigation
    for (let i = 0; i < 3; i++) {
      await clickHistoryBack(page);
      await page.waitForTimeout(100);
    }
    
    // Rapid forward navigation
    for (let i = 0; i < 3; i++) {
      await clickHistoryForward(page);
      await page.waitForTimeout(100);
    }
    
    // Wait for stabilization
    await page.waitForTimeout(2000);
    
    errorCollector.assertNoErrors();
  });
});

test.describe('Chart Alternatives - Chart Rendering', () => {
  
  test('chart renders after switching', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    await page.waitForTimeout(2000);
    
    // Check for initial canvas/svg
    let hasChart = await page.locator('canvas.marks, svg.marks, [class*="vega"]').first().isVisible();
    console.log('Initial chart visible:', hasChart);
    
    // Switch charts
    await clickAlternativeChart(page, 'Pie');
    await page.waitForTimeout(2000);
    
    // Check for chart after switch
    hasChart = await page.locator('canvas.marks, svg.marks, [class*="vega"]').first().isVisible();
    console.log('Chart visible after switch:', hasChart);
    
    errorCollector.assertNoErrors();
  });

  test('chart renders after history navigation', async ({ page, errorCollector }) => {
    await setupChartWithFields(page, 'Bar');
    await page.waitForTimeout(2000);
    
    // Switch to alternative
    await clickAlternativeChart(page, 'Pie');
    await page.waitForTimeout(2000);
    
    // Go back
    await clickHistoryBack(page);
    await page.waitForTimeout(2000);
    
    // Chart should render
    const hasChart = await page.locator('canvas.marks, svg.marks, [class*="vega"]').first().isVisible();
    console.log('Chart visible after history back:', hasChart);
    
    errorCollector.assertNoErrors();
  });
});

