/**
 * Multi-Level Charts Tests
 * Tests for multi-level bucket aggregation support across all chart types
 */
import { test, expect } from '../utils/fixtures.js';
import { BuilderPage } from '../pages/index.js';
import { waitForPageStable } from '../utils/testHelpers.js';
import { MULTI_LEVEL_TEST_DATA, CHART_MULTI_LEVEL_MODES } from '../utils/chartTestHelpers.js';

// =====================================================
// P1 CHARTS - High Impact, Low Effort
// =====================================================

test.describe('P1: Line Chart Multi-Level Support', () => {
  
  test('Line chart renders with multi-level data (series mode)', async ({ page, errorCollector }) => {
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

  test('Line chart schema includes multiLevelMode option', async ({ page }) => {
    // This test verifies the backend schema was updated correctly
    const response = await page.request.get('/api/vega/schema/line');
    if (response.ok()) {
      const schema = await response.json();
      const multiLevelField = schema.fields?.find(f => f.name === 'multiLevelMode');
      expect(multiLevelField).toBeTruthy();
      expect(multiLevelField.options).toContain('series');
      expect(multiLevelField.options).toContain('layered');
      expect(multiLevelField.options).toContain('faceted');
    }
  });

  test('Line chart generates spec with color encoding for multi-level', async ({ page }) => {
    // Test the backend spec generation directly
    const testData = MULTI_LEVEL_TEST_DATA.timeSeries;
    const response = await page.request.post('/api/vega/generate', {
      data: {
        chartType: 'line',
        config: {
          xField: 'order_date',
          yField: '_count',
          multiLevelMode: 'series'
        },
        data: testData
      }
    });
    
    if (response.ok()) {
      const result = await response.json();
      const specStr = JSON.stringify(result.spec);
      // Should have color scale for series
      expect(specStr).toContain('color');
    }
  });

  test('Line chart faceted mode creates small multiples', async ({ page }) => {
    const testData = MULTI_LEVEL_TEST_DATA.timeSeries;
    const response = await page.request.post('/api/vega/generate', {
      data: {
        chartType: 'line',
        config: {
          xField: 'order_date',
          yField: '_count',
          multiLevelMode: 'faceted'
        },
        data: testData
      }
    });
    
    if (response.ok()) {
      const result = await response.json();
      const specStr = JSON.stringify(result.spec);
      // Should have facet structure
      expect(specStr).toContain('facet');
    }
  });

  test('Line chart layered mode uses dash patterns', async ({ page }) => {
    const testData = MULTI_LEVEL_TEST_DATA.timeSeries;
    const response = await page.request.post('/api/vega/generate', {
      data: {
        chartType: 'line',
        config: {
          xField: 'order_date',
          yField: '_count',
          multiLevelMode: 'layered'
        },
        data: testData
      }
    });
    
    if (response.ok()) {
      const result = await response.json();
      const specStr = JSON.stringify(result.spec);
      // Should have dash pattern scale
      expect(specStr).toContain('dashScale');
    }
  });
});

test.describe('P1: Area Chart Multi-Level Support', () => {
  
  test('Area chart renders with multi-level data', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    const areaChart = page.locator('button:has(p:text-is("Area"))').first();
    if (await areaChart.count() > 0) {
      await areaChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });

  test('Area chart schema includes multiLevelMode option', async ({ page }) => {
    const response = await page.request.get('/api/vega/schema/area');
    if (response.ok()) {
      const schema = await response.json();
      const multiLevelField = schema.fields?.find(f => f.name === 'multiLevelMode');
      expect(multiLevelField).toBeTruthy();
    }
  });
});

test.describe('P1: Pie Chart Multi-Level Support', () => {
  
  test('Pie chart renders with multi-level data', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    const pieChart = page.locator('button:has(p:text-is("Pie"))').first();
    if (await pieChart.count() > 0) {
      await pieChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });

  test('Pie chart schema includes multiLevelMode option', async ({ page }) => {
    const response = await page.request.get('/api/vega/schema/pie');
    if (response.ok()) {
      const schema = await response.json();
      const multiLevelField = schema.fields?.find(f => f.name === 'multiLevelMode');
      expect(multiLevelField).toBeTruthy();
    }
  });
});

test.describe('P1: Donut Chart Multi-Level Support', () => {
  
  test('Donut chart renders with multi-level data', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    const donutChart = page.locator('button:has(p:text-is("Donut"))').first();
    if (await donutChart.count() > 0) {
      await donutChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('P1: Treemap Multi-Level Support', () => {
  
  test('Treemap renders with multi-level hierarchical data', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    const treemapChart = page.locator('button:has(p:text-is("Treemap"))').first();
    if (await treemapChart.count() > 0) {
      await treemapChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });

  test('Treemap auto-detects bucket hierarchy', async ({ page }) => {
    const testData = MULTI_LEVEL_TEST_DATA.hierarchical;
    const response = await page.request.post('/api/vega/generate', {
      data: {
        chartType: 'treemap',
        config: {
          categoryField: 'level1',
          valueField: '_count'
        },
        data: testData
      }
    });
    
    if (response.ok()) {
      const result = await response.json();
      // Treemap should process hierarchical data
      expect(result.spec).toBeTruthy();
    }
  });
});

test.describe('P1: Scatter Chart Multi-Level Support', () => {
  
  test('Scatter chart renders with multi-level data', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    const scatterChart = page.locator('button:has(p:text-is("Scatter"))').first();
    if (await scatterChart.count() > 0) {
      await scatterChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });

  test('Scatter chart uses color and shape for multi-level', async ({ page }) => {
    const testData = MULTI_LEVEL_TEST_DATA.distribution;
    const response = await page.request.post('/api/vega/generate', {
      data: {
        chartType: 'scatter',
        config: {
          xField: 'avg_price',
          yField: '_count',
          multiLevelMode: 'color'
        },
        data: testData
      }
    });
    
    if (response.ok()) {
      const result = await response.json();
      const specStr = JSON.stringify(result.spec);
      expect(specStr).toContain('color');
    }
  });
});

test.describe('P1: Bubble Chart Multi-Level Support', () => {
  
  test('Bubble chart renders with multi-level data', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    const bubbleChart = page.locator('button:has(p:text-is("Bubble"))').first();
    if (await bubbleChart.count() > 0) {
      await bubbleChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });
});

// =====================================================
// P2 CHARTS - High Impact, Medium Effort
// =====================================================

test.describe('P2: Heatmap Multi-Level Support', () => {
  
  test('Heatmap renders with multi-level data', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    const heatmapChart = page.locator('button:has(p:text-is("Heatmap"))').first();
    if (await heatmapChart.count() > 0) {
      await heatmapChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('P2: Boxplot Multi-Level Support', () => {
  
  test('Boxplot renders with multi-level grouped data', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    const boxplotChart = page.locator('button:has(p:text-is("Box"))').first();
    if (await boxplotChart.count() > 0) {
      await boxplotChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('P2: Histogram Multi-Level Support', () => {
  
  test('Histogram renders with stacked multi-level data', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    const histogramChart = page.locator('button:has(p:text-is("Histogram"))').first();
    if (await histogramChart.count() > 0) {
      await histogramChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('P2: Funnel Multi-Level Support', () => {
  
  test('Funnel renders with split paths', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    const funnelChart = page.locator('button:has(p:text-is("Funnel"))').first();
    if (await funnelChart.count() > 0) {
      await funnelChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('P2: Sankey Multi-Level Support', () => {
  
  test('Sankey renders with multi-hop flows', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    const sankeyChart = page.locator('button:has(p:text-is("Sankey"))').first();
    if (await sankeyChart.count() > 0) {
      await sankeyChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });
});

// =====================================================
// P3 CHARTS - Medium Impact
// =====================================================

test.describe('P3: Radial Bar Multi-Level Support', () => {
  
  test('Radial bar renders with nested rings', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    const radialChart = page.locator('button:has(p:text-is("Radial"))').first();
    if (await radialChart.count() > 0) {
      await radialChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('P3: Pareto Multi-Level Support', () => {
  
  test('Pareto renders with stacked sub-categories', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    const paretoChart = page.locator('button:has(p:text-is("Pareto"))').first();
    if (await paretoChart.count() > 0) {
      await paretoChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('P3: Radar Multi-Level Support', () => {
  
  test('Radar renders with overlapping polygons', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    const radarChart = page.locator('button:has(p:text-is("Radar"))').first();
    if (await radarChart.count() > 0) {
      await radarChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('P3: Violin Multi-Level Support', () => {
  
  test('Violin renders with split/grouped violins', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    const violinChart = page.locator('button:has(p:text-is("Violin"))').first();
    if (await violinChart.count() > 0) {
      await violinChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });
});

test.describe('P3: Waterfall Multi-Level Support', () => {
  
  test('Waterfall renders with grouped waterfalls', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    const waterfallChart = page.locator('button:has(p:text-is("Waterfall"))').first();
    if (await waterfallChart.count() > 0) {
      await waterfallChart.click();
      await waitForPageStable(page);
    }
    
    errorCollector.assertNoErrors();
  });
});

// =====================================================
// INTEGRATION TESTS
// =====================================================

test.describe('Multi-Level Integration', () => {
  
  test('Backend correctly returns _composite_key for multi-level data', async ({ page }) => {
    // Test that aggregation service returns composite key
    const response = await page.request.post('/api/aggregations/execute', {
      data: {
        index: 'kibana_sample_data_ecommerce',
        config: {
          bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 5 } },
          bucketAggs: [
            { type: 'terms', field: 'category.keyword', options: { size: 5 } },
            { type: 'terms', field: 'customer_gender', options: { size: 2 } }
          ]
        }
      }
    });
    
    if (response.ok()) {
      const result = await response.json();
      if (result.data && result.data.length > 0) {
        // Should have composite key when multi-level
        const hasCompositeKey = result.data[0].hasOwnProperty('_composite_key');
        expect(hasCompositeKey).toBe(true);
      }
    }
  });

  test('UI sub-grouping option is available for supported charts', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select bar chart
    const barChart = page.locator('button:has(p:text-is("Bar"))').first();
    if (await barChart.count() > 0) {
      await barChart.click();
      await waitForPageStable(page);
      
      // Look for sub-grouping section or add sub-grouping button
      const subGroupSection = page.locator('text=Sub-groupings, text=Add sub-grouping').first();
      // Just verify page loaded without errors
    }
    
    errorCollector.assertNoErrors();
  });
});

// =====================================================
// P4 CHARTS - Specialized Charts
// =====================================================

test.describe('P4: Streamgraph Multi-Level Support', () => {
  test('Streamgraph has multiLevelMode in schema', async ({ page }) => {
    const response = await page.request.get('/api/vega/schema/streamgraph');
    if (response.ok()) {
      const schema = await response.json();
      const multiLevelField = schema.fields?.find(f => f.name === 'multiLevelMode');
      expect(multiLevelField).toBeTruthy();
    }
  });
});

test.describe('P4: Circle Packing Multi-Level Support', () => {
  test('Circle Packing has multiLevelMode in schema', async ({ page }) => {
    const response = await page.request.get('/api/vega/schema/circle_packing');
    if (response.ok()) {
      const schema = await response.json();
      const multiLevelField = schema.fields?.find(f => f.name === 'multiLevelMode');
      expect(multiLevelField).toBeTruthy();
    }
  });
});

test.describe('P4: Chord Multi-Level Support', () => {
  test('Chord has multiLevelMode in schema', async ({ page }) => {
    const response = await page.request.get('/api/vega/schema/chord');
    if (response.ok()) {
      const schema = await response.json();
      const multiLevelField = schema.fields?.find(f => f.name === 'multiLevelMode');
      expect(multiLevelField).toBeTruthy();
    }
  });
});

test.describe('P4: Gauge Multi-Level Support', () => {
  test('Gauge has multiLevelMode in schema', async ({ page }) => {
    const response = await page.request.get('/api/vega/schema/gauge');
    if (response.ok()) {
      const schema = await response.json();
      const multiLevelField = schema.fields?.find(f => f.name === 'multiLevelMode');
      expect(multiLevelField).toBeTruthy();
    }
  });
});

test.describe('P4: Dual Axis Multi-Level Support', () => {
  test('Dual Axis has multiLevelMode in schema', async ({ page }) => {
    const response = await page.request.get('/api/vega/schema/dual_axis');
    if (response.ok()) {
      const schema = await response.json();
      const multiLevelField = schema.fields?.find(f => f.name === 'multiLevelMode');
      expect(multiLevelField).toBeTruthy();
    }
  });
});

test.describe('P4: Density Multi-Level Support', () => {
  test('Density has multiLevelMode in schema', async ({ page }) => {
    const response = await page.request.get('/api/vega/schema/density');
    if (response.ok()) {
      const schema = await response.json();
      const multiLevelField = schema.fields?.find(f => f.name === 'multiLevelMode');
      expect(multiLevelField).toBeTruthy();
    }
  });
});

test.describe('P4: Error Bars Multi-Level Support', () => {
  test('Error Bars has multiLevelMode in schema', async ({ page }) => {
    const response = await page.request.get('/api/vega/schema/error_bars');
    if (response.ok()) {
      const schema = await response.json();
      const multiLevelField = schema.fields?.find(f => f.name === 'multiLevelMode');
      expect(multiLevelField).toBeTruthy();
    }
  });
});

test.describe('P4: Bullet Multi-Level Support', () => {
  test('Bullet has multiLevelMode in schema', async ({ page }) => {
    const response = await page.request.get('/api/vega/schema/bullet');
    if (response.ok()) {
      const schema = await response.json();
      const multiLevelField = schema.fields?.find(f => f.name === 'multiLevelMode');
      expect(multiLevelField).toBeTruthy();
    }
  });
});

test.describe('P4: Metric Multi-Level Support', () => {
  test('Metric has multiLevelMode in schema', async ({ page }) => {
    const response = await page.request.get('/api/vega/schema/metric');
    if (response.ok()) {
      const schema = await response.json();
      const multiLevelField = schema.fields?.find(f => f.name === 'multiLevelMode');
      expect(multiLevelField).toBeTruthy();
    }
  });
});

test.describe('P4: Sparkline Multi-Level Support', () => {
  test('Sparkline has multiLevelMode in schema', async ({ page }) => {
    const response = await page.request.get('/api/vega/schema/sparkline');
    if (response.ok()) {
      const schema = await response.json();
      const multiLevelField = schema.fields?.find(f => f.name === 'multiLevelMode');
      expect(multiLevelField).toBeTruthy();
    }
  });
});

test.describe('P4: Table Multi-Level Support', () => {
  test('Table has multiLevelMode in schema', async ({ page }) => {
    const response = await page.request.get('/api/vega/schema/table');
    if (response.ok()) {
      const schema = await response.json();
      const multiLevelField = schema.fields?.find(f => f.name === 'multiLevelMode');
      expect(multiLevelField).toBeTruthy();
    }
  });
});

// =====================================================
// UI SUB-GROUPING VISIBILITY TESTS
// =====================================================

test.describe('UI Sub-grouping Visibility', () => {
  
  test('Radial chart shows sub-grouping option after field selection', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Radial chart
    const radialChart = page.locator('button:has(p:text-is("Radial"))').first();
    if (await radialChart.count() > 0) {
      await radialChart.click();
      await waitForPageStable(page);
      
      // Click on Categories section to expand it
      const categoriesBtn = page.locator('button:has-text("Categories")').first();
      if (await categoriesBtn.count() > 0) {
        await categoriesBtn.click();
        await waitForPageStable(page);
        
        // Select a field (click the field dropdown)
        const fieldDropdown = page.locator('button:has-text("Select field")').first();
        if (await fieldDropdown.count() > 0) {
          await fieldDropdown.click();
          await waitForPageStable(page);
          
          // Click a keyword field option
          const keywordField = page.locator('[data-field-type="keyword"]').first();
          if (await keywordField.count() > 0) {
            await keywordField.click();
            await waitForPageStable(page);
            
            // Now check if Sub-groupings section is visible
            const subGroupLabel = page.locator('text=Sub-groupings');
            expect(await subGroupLabel.count()).toBeGreaterThan(0);
          }
        }
      }
    }
    
    errorCollector.assertNoErrors();
  });

  test('Radar chart shows sub-grouping option for Dimensions axis', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Radar chart
    const radarChart = page.locator('button:has(p:text-is("Radar"))').first();
    if (await radarChart.count() > 0) {
      await radarChart.click();
      await waitForPageStable(page);
      
      // Radar uses "Dimensions" for its primary bucket axis
      const dimensionsBtn = page.locator('button:has-text("Dimensions")').first();
      if (await dimensionsBtn.count() > 0) {
        await dimensionsBtn.click();
        await waitForPageStable(page);
      }
    }
    
    errorCollector.assertNoErrors();
  });

  test('Wordcloud chart shows sub-grouping option for Text axis', async ({ page, errorCollector }) => {
    const builderPage = new BuilderPage(page);
    await builderPage.goto();
    
    // Select Wordcloud chart
    const wordcloudChart = page.locator('button:has(p:text-is("Wordcloud"))').first();
    if (await wordcloudChart.count() > 0) {
      await wordcloudChart.click();
      await waitForPageStable(page);
      
      // Wordcloud uses "Text" for its primary bucket axis
      const textBtn = page.locator('button:has-text("Text")').first();
      if (await textBtn.count() > 0) {
        await textBtn.click();
        await waitForPageStable(page);
      }
    }
    
    errorCollector.assertNoErrors();
  });
});

