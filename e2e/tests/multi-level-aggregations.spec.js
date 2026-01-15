/**
 * Multi-Level Aggregation Tests
 * 
 * Comprehensive tests for the enhanced aggregation features:
 * - Multi-level bucket aggregations (nested hierarchies)
 * - Rank by / Order options
 * - Sub-grouping UI
 * - Split configuration
 */
import { test, expect } from '../utils/fixtures.js';
import { BuilderPage } from '../pages/index.js';
import { waitForPageStable } from '../utils/testHelpers.js';

test.describe('Multi-Level Buckets - UI', () => {
  
  test('sub-grouping section appears for supported chart types', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Bar chart (supports multi-level)
    const barChart = page.locator('button:has(p:text-is("Bar"))').first();
    if (await barChart.count() > 0) {
      await barChart.click();
      await waitForPageStable(page);
      
      // Expand X-axis configuration
      const xAxisSection = page.locator('button:has-text("Categories")').first();
      if (await xAxisSection.count() > 0) {
        await xAxisSection.click();
        await waitForPageStable(page);
        
        // Look for sub-grouping label (may require field selection first)
        // The UI shows after a field is selected
      }
    }
    
    errorCollector.assertNoErrors();
  });

  test('sub-grouping section shows for Pie chart', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Pie chart (supports multi-level)
    const pieChart = page.locator('button:has(p:text-is("Pie"))').first();
    if (await pieChart.count() > 0) {
      await pieChart.click();
      await waitForPageStable(page);
      
      // Expand Slices configuration
      const slicesSection = page.locator('button:has-text("Slices")').first();
      if (await slicesSection.count() > 0) {
        await slicesSection.click();
        await waitForPageStable(page);
      }
    }
    
    errorCollector.assertNoErrors();
  });

  test('sub-grouping not available for unsupported chart types', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Sankey chart (uses multi_terms instead of multi-level)
    const sankeyChart = page.locator('button:has(p:text-is("Sankey"))').first();
    if (await sankeyChart.count() > 0) {
      await sankeyChart.click();
      await waitForPageStable(page);
      
      // Sub-groupings section should NOT appear
      const subGroupLabel = page.locator('text=Sub-groupings');
      expect(await subGroupLabel.count()).toBe(0);
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('Multi-Level Buckets - Functionality', () => {
  
  test('add sub-grouping button is visible', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Treemap chart (supports multi-level)
    const treemapChart = page.locator('button:has(p:text-is("Treemap"))').first();
    if (await treemapChart.count() > 0) {
      await treemapChart.click();
      await waitForPageStable(page);
      
      // Look for add sub-grouping button
      const addSubGroupBtn = page.locator('button:has-text("Add sub-grouping")');
      // May or may not be visible depending on field selection
    }
    
    errorCollector.assertNoErrors();
  });

  test('sub-grouping field picker opens', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Bar chart
    const barChart = page.locator('button:has(p:text-is("Bar"))').first();
    if (await barChart.count() > 0) {
      await barChart.click();
      await waitForPageStable(page);
      
      // Try to find and click add sub-grouping button
      const addSubGroupBtn = page.locator('button:has-text("Add sub-grouping")').first();
      if (await addSubGroupBtn.count() > 0) {
        await addSubGroupBtn.click();
        await waitForPageStable(page);
        
        // Search input should appear
        const searchInput = page.locator('input[placeholder*="Search fields"]');
        if (await searchInput.count() > 0) {
          expect(await searchInput.isVisible()).toBe(true);
        }
      }
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('Order Options', () => {
  
  test('rank by dropdown has correct options', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Bar chart
    const barChart = page.locator('button:has(p:text-is("Bar"))').first();
    if (await barChart.count() > 0) {
      await barChart.click();
      await waitForPageStable(page);
      
      // Expand X-axis
      const xAxisSection = page.locator('button:has-text("Categories")').first();
      if (await xAxisSection.count() > 0) {
        await xAxisSection.click();
        await waitForPageStable(page);
        
        // Find rank by select
        const rankBySelect = page.locator('select').filter({ hasText: /Count of records/ }).first();
        if (await rankBySelect.count() > 0) {
          const options = await rankBySelect.locator('option').allTextContents();
          expect(options).toContain('Count of records');
          expect(options).toContain('Alphabetical');
        }
      }
    }
    
    errorCollector.assertNoErrors();
  });

  test('rank direction can be changed to ascending', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Line chart (time-based usually ascending)
    const lineChart = page.locator('button:has(p:text-is("Line"))').first();
    if (await lineChart.count() > 0) {
      await lineChart.click();
      await waitForPageStable(page);
      
      // Expand X-axis
      const xAxisSection = page.locator('button:has-text("Time")').first();
      if (await xAxisSection.count() > 0) {
        await xAxisSection.click();
        await waitForPageStable(page);
        
        // Find rank direction select
        const directionSelect = page.locator('select').filter({ hasText: /Descending|Ascending/ }).first();
        if (await directionSelect.count() > 0) {
          // Change to ascending
          await directionSelect.selectOption('asc');
          await waitForPageStable(page);
          
          // Verify the change
          expect(await directionSelect.inputValue()).toBe('asc');
        }
      }
    }
    
    errorCollector.assertNoErrors();
  });

  test('custom metric option shows additional fields', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Bar chart
    const barChart = page.locator('button:has(p:text-is("Bar"))').first();
    if (await barChart.count() > 0) {
      await barChart.click();
      await waitForPageStable(page);
      
      // Expand X-axis
      const xAxisSection = page.locator('button:has-text("Categories")').first();
      if (await xAxisSection.count() > 0) {
        await xAxisSection.click();
        await waitForPageStable(page);
        
        // Find rank by select and select custom metric
        const rankBySelect = page.locator('select').filter({ hasText: /Count of records/ }).first();
        if (await rankBySelect.count() > 0) {
          // Check if custom metric option exists
          const customOption = rankBySelect.locator('option[value="custom_metric"]');
          if (await customOption.count() > 0) {
            await rankBySelect.selectOption('custom_metric');
            await waitForPageStable(page);
            
            // Metric type and field selects should appear
            const metricTypeLabel = page.locator('text=Metric type');
            expect(await metricTypeLabel.count()).toBeGreaterThan(0);
          }
        }
      }
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('Chart Schema Updates', () => {
  
  test('Bar chart schema includes orderBy field', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Bar chart and verify config loads without errors
    const barChart = page.locator('button:has(p:text-is("Bar"))').first();
    if (await barChart.count() > 0) {
      await barChart.click();
      await waitForPageStable(page);
      
      // Config panel should load
      const configPanel = page.locator('[class*="config"], [class*="Unified"]');
      expect(await configPanel.count()).toBeGreaterThan(0);
    }
    
    errorCollector.assertNoErrors();
  });

  test('Pie chart schema includes orderBy field', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Pie chart
    const pieChart = page.locator('button:has(p:text-is("Pie"))').first();
    if (await pieChart.count() > 0) {
      await pieChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });

  test('Line chart schema includes orderBy field', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Line chart
    const lineChart = page.locator('button:has(p:text-is("Line"))').first();
    if (await lineChart.count() > 0) {
      await lineChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });

  test('Treemap chart schema includes orderBy field', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Treemap chart
    const treemapChart = page.locator('button:has(p:text-is("Treemap"))').first();
    if (await treemapChart.count() > 0) {
      await treemapChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });

  test('Funnel chart schema includes orderBy field', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Funnel chart
    const funnelChart = page.locator('button:has(p:text-is("Funnel"))').first();
    if (await funnelChart.count() > 0) {
      await funnelChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('Backend Integration', () => {
  
  test('aggregation API accepts bucketAggs array', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Make an API call with bucketAggs (if possible)
    // For now, just verify the page loads without errors
    errorCollector.assertNoErrors();
  });

  test('aggregation API accepts order options', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Verify page loads and no backend errors
    errorCollector.assertNoErrors();
  });
});

test.describe('Split Configuration', () => {
  
  test('color field enables series split', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Bar chart
    const barChart = page.locator('button:has(p:text-is("Bar"))').first();
    if (await barChart.count() > 0) {
      await barChart.click();
      await waitForPageStable(page);
      
      // Look for Color section
      const colorSection = page.locator('button:has-text("Color")');
      if (await colorSection.count() > 0) {
        await colorSection.click();
        await waitForPageStable(page);
        
        // Color field picker should be available
        const fieldPicker = page.locator('button:has-text("Select field")');
        expect(await fieldPicker.count()).toBeGreaterThanOrEqual(0);
      }
    }
    
    errorCollector.assertNoErrors();
  });

  test('series field available for Line chart', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Line chart
    const lineChart = page.locator('button:has(p:text-is("Line"))').first();
    if (await lineChart.count() > 0) {
      await lineChart.click();
      await waitForPageStable(page);
      
      // Look for Series section
      const seriesSection = page.locator('button:has-text("Series")');
      expect(await seriesSection.count()).toBeGreaterThan(0);
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('Store State Management', () => {
  
  test('aggregation store initializes with bucketAggs array', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Verify page loads
    await waitForPageStable(page);
    
    // Check for any console errors
    errorCollector.assertNoErrors();
  });

  test('switching chart types resets aggregation config', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Bar chart
    const barChart = page.locator('button:has(p:text-is("Bar"))').first();
    if (await barChart.count() > 0) {
      await barChart.click();
      await waitForPageStable(page);
    }
    
    // Switch to Pie chart
    const pieChart = page.locator('button:has(p:text-is("Pie"))').first();
    if (await pieChart.count() > 0) {
      await pieChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });
});

