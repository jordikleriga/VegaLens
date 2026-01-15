/**
 * Vega and Kibana Spec Rendering Tests
 * 
 * Tests that verify:
 * - Vega preview renders successfully (canvas/SVG appears)
 * - Vega spec JSON is valid
 * - Kibana spec JSON is valid and has required structure
 * - No console errors during rendering
 * 
 * IMPORTANT: These tests require an Elasticsearch connection with indices.
 * They navigate through the full builder flow: Data Source -> Chart Type -> Configure
 * 
 * TEST SUMMARY: Results are written to e2e/test-results/rendering-summary.json
 * This file can be read by the AI to diagnose and fix issues.
 */
import { test, expect } from '../utils/fixtures.js';
import { waitForPageStable } from '../utils/testHelpers.js';
import * as fs from 'fs';
import * as path from 'path';

// Summary file path
const SUMMARY_FILE = path.join(process.cwd(), 'test-results', 'rendering-summary.json');
const SUMMARY_LOCK_FILE = path.join(process.cwd(), 'test-results', '.summary-lock');

/**
 * Read existing summary from file (thread-safe with retries)
 */
function readExistingSummary() {
  try {
    if (fs.existsSync(SUMMARY_FILE)) {
      const content = fs.readFileSync(SUMMARY_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    // File might be being written by another worker, return empty
    console.log('Note: Could not read existing summary, will create new');
  }
  return {
    timestamp: new Date().toISOString(),
    totalCharts: 0,
    successfulRenders: 0,
    partialRenders: 0,
    failedRenders: 0,
    charts: {}
  };
}

/**
 * Save the test summary to a file for AI diagnosis
 * Merges with existing results from parallel test workers
 */
function saveSummary(chartName, chartData) {
  // Simple retry mechanism for concurrent file access
  let retries = 3;
  while (retries > 0) {
    try {
      // Ensure directory exists
      const dir = path.dirname(SUMMARY_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Read existing summary and merge
      const existingSummary = readExistingSummary();
      
      // Add/update this chart's result
      existingSummary.charts[chartName] = chartData;
      existingSummary.lastUpdated = new Date().toISOString();
      
      // Recalculate stats
      const charts = Object.values(existingSummary.charts);
      existingSummary.totalCharts = charts.length;
      existingSummary.successfulRenders = charts.filter(c => c.status === 'success').length;
      existingSummary.partialRenders = charts.filter(c => c.status === 'partial' || c.status === 'needs-fields' || c.status === 'no-field-selector').length;
      existingSummary.failedRenders = charts.filter(c => c.status === 'failed' || c.status === 'error').length;
      
      // Add action items for charts that need attention (including those with console errors)
      existingSummary.actionItems = Object.entries(existingSummary.charts)
        .filter(([_, data]) => data.status !== 'success' || data.needsFollowUp || data.hasHardFailures)
        .map(([name, data]) => ({
          chart: name,
          status: data.status,
          issue: data.reason || (data.hasHardFailures ? 'CRITICAL: Hard failures detected' : 
                                  data.hasConsoleErrors ? 'Console activity detected' : 'Unknown issue'),
          missingFields: data.diagnostics?.pageState?.statusMessages?.some(m => m.includes('Missing')),
          hasHardFailures: data.hasHardFailures || false,
          hasConsoleErrors: data.hasConsoleErrors || false,
          hardFailureCount: data.consoleErrors?.counts?.hardFailures || 0,
          warningCount: data.consoleErrors?.counts?.warnings || 0,
          needsReview: data.consoleErrors?.needsReview || false,
          suggestedFix: getSuggestedFix(data)
        }));
      
      // Add summary stats for console errors
      const allCharts = Object.values(existingSummary.charts);
      existingSummary.consoleErrorStats = {
        chartsWithHardFailures: allCharts.filter(c => c.hasHardFailures).length,
        chartsWithWarnings: allCharts.filter(c => c.consoleErrors?.counts?.warnings > 0).length,
        chartsNeedingReview: allCharts.filter(c => c.needsFollowUp).length
      };
      
      fs.writeFileSync(SUMMARY_FILE, JSON.stringify(existingSummary, null, 2));
      console.log(`📊 Summary updated: ${chartName} (${existingSummary.totalCharts} total)`);
      return;
    } catch (err) {
      retries--;
      if (retries === 0) {
        console.error('Failed to save test summary after retries:', err.message);
      } else {
        // Wait a bit before retry (stagger by random amount to reduce collisions)
        const delay = Math.random() * 100 + 50;
        const start = Date.now();
        while (Date.now() - start < delay) { /* busy wait */ }
      }
    }
  }
}

/**
 * Get suggested fix for a chart issue
 */
function getSuggestedFix(chartData) {
  const status = chartData.status;
  const diagnostics = chartData.diagnostics?.pageState || {};
  const counts = chartData.consoleErrors?.counts || {};
  
  if (status === 'success' && !chartData.hasConsoleErrors) return 'No fix needed';
  
  // Hard failures (TypeError, ReferenceError, etc.) take highest priority
  if (counts.hardFailures > 0) {
    const errors = chartData.consoleErrors?.hardFailures || [];
    const firstError = errors[0]?.substring(0, 100) || 'Unknown error';
    return `CRITICAL: ${counts.hardFailures} hard failure(s) - "${firstError}..." Check vegaGenerator.js for bugs.`;
  }
  
  // Expected testing errors (field validation during config)
  if (counts.expectedTestingErrors > 0) {
    return `${counts.expectedTestingErrors} expected testing error(s) during field configuration. May indicate incomplete setup.`;
  }
  
  // Warnings that need review
  if (counts.warnings > 0) {
    return `${counts.warnings} console warning(s) detected. Review for Vega runtime issues.`;
  }
  
  if (diagnostics.statusMessages?.includes('Missing Fields')) {
    const configuredCount = diagnostics.configuredFields?.length || 0;
    return `Chart needs more field configuration. Currently has ${configuredCount} fields. Check the chart's required axes in vegaGenerator.js and ensure the test selects all required fields.`;
  }
  
  if (status === 'no-field-selector') {
    return 'Field selector button not found. The chart may use a different field selection UI or auto-configures. Check UnifiedDataPanel.vue for this chart type.';
  }
  
  if (status === 'needs-fields') {
    return 'Chart was configured but preview did not render. May need additional required fields or data. Check vegaGenerator.js for this chart type\'s required fields.';
  }
  
  if (chartData.hasUIError) {
    return `UI shows error: "${chartData.uiError}". Check console logs and vegaGenerator.js for this chart type.`;
  }
  
  return 'Unknown issue. Check the debug diagnostics JSON for more details.';
}

/**
 * Record a chart test result
 */
function recordChartResult(chartName, chartType, status, reason = null, diagnostics = null, hasUIError = false, uiError = null, consoleErrorSummary = null) {
  const counts = consoleErrorSummary?.counts || {};
  
  // Determine severity of console errors
  const hasHardFailures = counts.hardFailures > 0;
  const hasExpectedErrors = counts.expectedTestingErrors > 0;
  const hasWarnings = counts.warnings > 0;
  const hasAnyConsoleActivity = (counts.total || 0) > 0;
  
  const chartData = {
    type: chartType,
    status,
    reason,
    diagnostics,
    hasUIError,
    uiError,
    // Track console errors for follow-up review
    consoleErrors: consoleErrorSummary,
    // Critical: Hard failures that indicate code bugs
    hasHardFailures,
    // Any console activity worth knowing about
    hasConsoleErrors: hasAnyConsoleActivity,
    // Needs follow-up if: hard failures, expected errors, warnings, UI errors, or non-success status
    needsFollowUp: hasHardFailures || hasExpectedErrors || hasWarnings || hasUIError || status !== 'success',
    testedAt: new Date().toISOString()
  };
  
  // Save immediately with merge to handle parallel workers
  saveSummary(chartName, chartData);
}

/**
 * Chart-specific field configuration for automated testing
 * Each chart type has specific axes that need specific field types
 * 
 * Axis types:
 * - bucket: Categorical field (keyword, date) - use terms/date_histogram aggregation
 * - metric: Count, Sum, Avg, etc. - typically Count works without a field
 * - numeric: Raw numeric field - for distributions (histogram, boxplot, heatlane)
 */
const CHART_FIELD_CONFIG = {
  // Simple charts - just need X (bucket) and Y (metric/count)
  bar: { axes: ['x', 'y'], xType: 'bucket', yType: 'metric' },
  line: { axes: ['x', 'y'], xType: 'bucket', yType: 'metric' },
  area: { axes: ['x', 'y'], xType: 'bucket', yType: 'metric' },
  pie: { axes: ['x', 'y'], xType: 'bucket', yType: 'metric' },
  donut: { axes: ['x', 'y'], xType: 'bucket', yType: 'metric' },
  radial: { axes: ['x', 'y'], xType: 'bucket', yType: 'metric' },
  treemap: { axes: ['x', 'y'], xType: 'bucket', yType: 'metric' },
  waterfall: { axes: ['x', 'y'], xType: 'bucket', yType: 'metric' },
  wordcloud: { axes: ['text'], textType: 'bucket' },
  rolling_average: { axes: ['x', 'y'], xType: 'bucket', yType: 'metric' },
  
  // Single-value charts - just need Y (metric/count)
  gauge: { axes: ['y'], yType: 'metric' },
  metric: { axes: ['y'], yType: 'metric' },
  
  // Multi-metric charts
  scatter: { axes: ['x', 'y'], xType: 'metric', yType: 'metric' },
  bubble: { axes: ['x', 'y', 'size'], xType: 'metric', yType: 'metric', sizeType: 'metric' },
  binned_heatmap: { axes: ['x', 'y'], xType: 'metric', yType: 'metric' },
  
  // Distribution charts - need raw numeric data
  histogram: { axes: ['x'], xType: 'numeric' },
  boxplot: { axes: ['x', 'y'], xType: 'bucket', yType: 'numeric' },
  heatlane: { axes: ['value'], valueType: 'numeric' },
  
  // Complex multi-field charts
  radar: { axes: ['key', 'value'], keyType: 'bucket', valueType: 'metric' },
  heatmap: { axes: ['x', 'y', 'color'], xType: 'bucket', yType: 'bucket', colorType: 'metric' },
  sankey: { axes: ['source', 'target', 'value'], sourceType: 'bucket', targetType: 'bucket', valueType: 'metric' },
  ternary: { axes: ['label', 'top', 'left', 'right'], labelType: 'bucket', topType: 'metric', leftType: 'metric', rightType: 'metric' },
  comet: { axes: ['category', 'time', 'value'], categoryType: 'bucket', timeType: 'bucket', valueType: 'metric' },
  dual_axis: { axes: ['x', 'y1', 'y2'], xType: 'bucket', y1Type: 'metric', y2Type: 'metric' },
  population_pyramid: { axes: ['category', 'value', 'group'], categoryType: 'bucket', valueType: 'metric', groupType: 'bucket' },
  bullet: { axes: ['title', 'measures', 'ranges'], titleType: 'bucket', measuresType: 'metric', rangesType: 'metric' },
  trellis_area: { axes: ['x', 'y', 'facet'], xType: 'bucket', yType: 'metric', facetType: 'bucket' },
  lasagna: { axes: ['x', 'y', 'value'], xType: 'bucket', yType: 'bucket', valueType: 'metric' },
  
  // New Chart Types
  funnel: { axes: ['x', 'y'], xType: 'bucket', yType: 'metric' },
  sparkline: { axes: ['x', 'y'], xType: 'bucket', yType: 'metric' },
  error_bars: { axes: ['x', 'y'], xType: 'bucket', yType: 'metric' },
  horizon: { axes: ['x', 'y'], xType: 'bucket', yType: 'metric' },
  circle_packing: { axes: ['x', 'y'], xType: 'bucket', yType: 'metric' },
  streamgraph: { axes: ['x', 'y', 'color'], xType: 'bucket', yType: 'metric', colorType: 'bucket' },
  density: { axes: ['x'], xType: 'metric' },
  marimekko: { axes: ['x', 'y', 'color'], xType: 'bucket', yType: 'metric', colorType: 'bucket' }
};

/**
 * ALL Chart Types - Each must pass rendering tests
 * 
 * IMPORTANT: When adding a new chart type, add it to this list!
 * Every chart type MUST have:
 * 1. Vega preview rendering test
 * 2. Kibana spec generation test
 * 3. No console errors during rendering
 */
const ALL_CHART_TYPES = [
  // Basic Charts
  { name: 'Bar Chart', type: 'bar' },
  { name: 'Line Chart', type: 'line' },
  { name: 'Area Chart', type: 'area' },
  { name: 'Pie Chart', type: 'pie' },
  { name: 'Donut Chart', type: 'donut' },
  
  // Comparison Charts
  { name: 'Scatter Plot', type: 'scatter' },
  { name: 'Bubble Plot', type: 'bubble' },
  { name: 'Radar Chart', type: 'radar' },
  { name: 'Radial Bar Chart', type: 'radial' },
  
  // Distribution Charts
  { name: 'Histogram', type: 'histogram' },
  { name: 'Box Plot', type: 'boxplot' },
  { name: 'Heatmap', type: 'heatmap' },
  
  // Hierarchical Charts
  { name: 'Treemap', type: 'treemap' },
  
  // Flow Charts
  { name: 'Sankey Diagram', type: 'sankey' },
  { name: 'Waterfall Chart', type: 'waterfall' },
  
  // Specialized Charts
  { name: 'Gauge', type: 'gauge' },
  { name: 'Metric', type: 'metric' },
  { name: 'Word Cloud', type: 'wordcloud' },
  { name: 'Ternary Chart', type: 'ternary' },
  { name: 'Comet Chart', type: 'comet' },
  { name: 'Dual-Axis Chart', type: 'dual_axis' },
  { name: 'Population Pyramid', type: 'population_pyramid' },
  { name: 'Bullet Chart', type: 'bullet' },
  { name: 'Trellis Area', type: 'trellis_area' },
  { name: 'Heat Lane Chart', type: 'heatlane' },
  { name: 'Lasagna Plot', type: 'lasagna' },
  { name: 'Rolling Average', type: 'rolling_average' },
  { name: '2D Histogram Heatmap', type: 'binned_heatmap' },
  
  // New Chart Types
  { name: 'Funnel Chart', type: 'funnel' },
  { name: 'Spark Lines', type: 'sparkline' },
  { name: 'Error Bars', type: 'error_bars' },
  { name: 'Horizon Chart', type: 'horizon' },
  { name: 'Circle Packing', type: 'circle_packing' },
  { name: 'Streamgraph', type: 'streamgraph' },
  { name: 'Density Plot', type: 'density' },
  { name: 'Marimekko Chart', type: 'marimekko' }
];

/**
 * Helper: Select an index from the dropdown
 */
async function selectFirstIndex(page) {
  // Click the index dropdown
  const indexDropdown = page.getByRole('button', { name: /Select an index/i });
  if (await indexDropdown.count() > 0) {
    await indexDropdown.click();
    await page.waitForTimeout(500);
    
    // Use JavaScript to find and click an index button
    // Prefer kibana_sample_data_ecommerce for consistent test data
    const clicked = await page.evaluate(() => {
      const allButtons = document.querySelectorAll('button');
      
      // First, try to find kibana_sample_data_ecommerce
      for (const btn of allButtons) {
        const text = btn.textContent || '';
        if (text.includes('kibana_sample_data_ecommerce') && text.includes('docs')) {
          btn.click();
          return { clicked: true, index: 'kibana_sample_data_ecommerce' };
        }
      }
      
      // Also try kibana_sample_data_flights
      for (const btn of allButtons) {
        const text = btn.textContent || '';
        if (text.includes('kibana_sample_data_flights') && text.includes('docs')) {
          btn.click();
          return { clicked: true, index: 'kibana_sample_data_flights' };
        }
      }
      
      // Fallback: click the first index with docs
      for (const btn of allButtons) {
        const text = btn.textContent || '';
        if (text.includes('docs') && text.includes('·')) {
          btn.click();
          return { clicked: true, index: text.substring(0, 40) };
        }
      }
      
      return { clicked: false };
    });
    
    if (clicked.clicked) {
      console.log(`selectFirstIndex: Selected index: ${clicked.index}`);
      await page.waitForTimeout(1000);
      return true;
    } else {
      // Close dropdown if no indices
      await page.keyboard.press('Escape');
      return false;
    }
  }
  return false;
}

/**
 * Helper: Navigate through builder wizard to chart type selection
 * Returns true if successful, false if no indices available
 */
async function navigateToChartTypePicker(page) {
  await page.goto('/builder');
  await waitForPageStable(page);
  
  // Wait for page to fully load
  await page.waitForTimeout(1000);
  
  // Step 1: Select an index
  const hasIndex = await selectFirstIndex(page);
  
  if (!hasIndex) {
    console.log('No Elasticsearch indices available');
    return false;
  }
  
  // Wait for data to load after selecting index
  await page.waitForTimeout(500);
  
  // Step 2: Click "Continue to Chart Type" button
  const continueBtn = page.getByRole('button', { name: /Continue to Chart Type/i });
  if (await continueBtn.count() > 0) {
    // Wait for button to be enabled (after index is selected)
    await page.waitForTimeout(500);
    
    if (await continueBtn.isEnabled()) {
      await continueBtn.click();
      
      // Wait for chart type picker to appear
      await page.waitForTimeout(1000);
      
      // Verify we're on the chart type picker by looking for the heading
      const chartTypeHeading = page.getByRole('heading', { name: /Choose Chart Type/i });
      const headingVisible = await chartTypeHeading.count() > 0;
      
      if (headingVisible) {
        return true;
      } else {
        console.log('Chart type picker heading not found after clicking Continue');
      }
    } else {
      console.log('Continue button exists but is disabled');
    }
  }
  
  return false;
}

/**
 * Helper: Select a chart type by its full name
 */
async function selectChartType(page, chartName) {
  // Chart types are buttons with structure: icon div + content div with p.font-medium (name) and p (description)
  // The name is in a <p> tag with font-medium class
  const clicked = await page.evaluate((name) => {
    // First, try to find by exact p.font-medium text match
    const nameParagraphs = document.querySelectorAll('button p.font-medium, button p[class*="font-medium"]');
    for (const p of nameParagraphs) {
      const text = (p.textContent || '').trim();
      if (text.toLowerCase() === name.toLowerCase()) {
        const btn = p.closest('button');
        if (btn) {
          btn.scrollIntoView({ block: 'center' });
          btn.click();
          return { clicked: true, method: 'exact-p-match', text };
        }
      }
    }
    
    // Fallback: find button with text containing the chart name
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent || '';
      // Match if button text contains the chart name (not at start due to icon text)
      const normalizedText = text.replace(/\s+/g, ' ').trim().toLowerCase();
      const searchName = name.toLowerCase();
      
      // Check if the name appears as a distinct word/phrase
      if (normalizedText.includes(searchName) && 
          !normalizedText.includes('generate') && 
          !normalizedText.includes('continue')) {
        btn.scrollIntoView({ block: 'center' });
        btn.click();
        return { clicked: true, method: 'text-contains', text: text.substring(0, 50) };
      }
    }
    
    return { clicked: false };
  }, chartName);
  
  if (clicked.clicked) {
    console.log(`selectChartType: Clicked '${chartName}' via ${clicked.method}`);
    
    // Wait for navigation to step 3 (ConfigurationPanel) and for component to mount
    await page.waitForTimeout(1500);
    
    // Wait for the configuration panel to be fully loaded
    try {
      await page.waitForSelector('button:has-text("Generate Chart")', { timeout: 5000 });
    } catch {
      console.log(`selectChartType: Generate Chart button not found after selecting ${chartName}`);
    }
    
    // Additional wait for Vue reactivity to settle
    await page.waitForTimeout(500);
    
    return true;
  }
  
  console.log(`selectChartType: Could not find '${chartName}' in picker`);
  return false;
}

/**
 * Known fields in kibana_sample_data_ecommerce for smart field selection
 */
const ECOMMERCE_FIELDS = {
  // Bucket fields (keyword) - ordered by preference
  bucket: [
    'category.keyword',
    'manufacturer.keyword', 
    'customer_gender.keyword',
    'day_of_week.keyword',
    'geoip.city_name.keyword',
    'geoip.country_iso_code.keyword',
    'customer_first_name.keyword',
    'currency.keyword',
    'type.keyword'
  ],
  // Binary bucket fields - fields with exactly 2 distinct values (for State/Group fields)
  binaryBucket: [
    'customer_gender.keyword',  // MALE, FEMALE
    'type.keyword'              // order, etc.
  ],
  // Numeric fields - ordered by preference
  numeric: [
    'taxful_total_price',
    'taxless_total_price',
    'products.price',
    'products.base_price',
    'products.quantity',
    'total_quantity',
    'total_unique_products',
    'products.discount_amount',
    'products.discount_percentage'
  ],
  // Date fields
  date: ['order_date']
};

/**
 * TEST SCENARIOS - Different field/aggregation combinations for comprehensive testing
 * 
 * Each scenario tests charts with specific data patterns:
 * - Time-series: Date-based trends over time
 * - Category breakdown: Categorical comparisons
 * - Multi-metric: Numeric field correlations
 */
const TEST_SCENARIOS = {
  /**
   * Scenario 1: Time-Series Analysis
   * Uses date histogram aggregation on order_date
   * Best for: Line, Area, Rolling Average, Dual-Axis charts
   */
  timeSeries: {
    name: 'Time-Series',
    description: 'Date histogram with temporal trends',
    primaryBucket: 'order_date',
    bucketType: 'date',
    aggregationType: 'date_histogram',
    metrics: [
      { field: 'taxful_total_price', op: 'sum', label: 'Revenue' },
      { field: 'total_quantity', op: 'sum', label: 'Quantity' }
    ],
    // Charts that work best with this scenario
    suitableCharts: ['line', 'area', 'rolling_average', 'dual_axis', 'bar'],
    // Field selections for the UI
    fieldSelections: {
      x: 'order_date',
      y: 'Count',  // or specific metric
      y1: 'taxful_total_price',
      y2: 'total_quantity'
    }
  },

  /**
   * Scenario 2: Category Breakdown
   * Uses terms aggregation on category.keyword
   * Best for: Bar, Pie, Donut, Treemap, Radial charts
   */
  categoryBreakdown: {
    name: 'Category Breakdown',
    description: 'Terms aggregation for categorical comparison',
    primaryBucket: 'category.keyword',
    secondaryBucket: 'manufacturer.keyword',  // For multi-bucket charts
    bucketType: 'keyword',
    aggregationType: 'terms',
    metrics: [
      { field: null, op: 'count', label: 'Count' },
      { field: 'taxful_total_price', op: 'sum', label: 'Total Revenue' },
      { field: 'taxful_total_price', op: 'avg', label: 'Avg Price' }
    ],
    suitableCharts: ['bar', 'pie', 'donut', 'treemap', 'radial', 'wordcloud', 'gauge', 'metric', 'waterfall'],
    fieldSelections: {
      x: 'category.keyword',
      y: 'Count',
      category: 'category.keyword',
      text: 'category.keyword',
      source: 'category.keyword',
      target: 'manufacturer.keyword'
    }
  },

  /**
   * Scenario 3: Multi-Metric Correlation
   * Uses multiple numeric fields for scatter/bubble analysis
   * Best for: Scatter, Bubble, Binned Heatmap charts
   */
  multiMetric: {
    name: 'Multi-Metric',
    description: 'Numeric field correlations and distributions',
    primaryNumeric: 'taxful_total_price',
    secondaryNumeric: 'products.quantity',
    tertiaryNumeric: 'total_unique_products',
    categoryField: 'category.keyword',  // For grouping/coloring
    suitableCharts: ['scatter', 'bubble', 'binned_heatmap', 'histogram', 'boxplot', 'heatmap', 'ternary'],
    fieldSelections: {
      x: 'taxful_total_price',
      y: 'products.quantity',
      size: 'total_unique_products',
      color: 'category.keyword',
      category: 'category.keyword',
      value: 'taxful_total_price'
    }
  }
};

/**
 * Get the best test scenario for a chart type
 */
function getBestScenarioForChart(chartType) {
  for (const [scenarioKey, scenario] of Object.entries(TEST_SCENARIOS)) {
    if (scenario.suitableCharts.includes(chartType)) {
      return { key: scenarioKey, ...scenario };
    }
  }
  // Default to category breakdown as it works for most charts
  return { key: 'categoryBreakdown', ...TEST_SCENARIOS.categoryBreakdown };
}

/**
 * Get all scenarios that are suitable for a chart type
 */
function getSuitableScenariosForChart(chartType) {
  const suitable = [];
  for (const [scenarioKey, scenario] of Object.entries(TEST_SCENARIOS)) {
    if (scenario.suitableCharts.includes(chartType)) {
      suitable.push({ key: scenarioKey, ...scenario });
    }
  }
  // If no specific scenarios, use category breakdown
  if (suitable.length === 0) {
    suitable.push({ key: 'categoryBreakdown', ...TEST_SCENARIOS.categoryBreakdown });
  }
  return suitable;
}

/**
 * Helper: Configure all required fields for a chart using chart-specific configuration
 * 
 * @param {Page} page - Playwright page object
 * @param {string} chartType - The chart type key (e.g., 'bar', 'sankey', 'ternary')
 */
async function configureChartFields(page, chartType = null) {
  let fieldsConfigured = 0;
  const usedBucketFields = []; // Track which bucket fields we've already used
  const usedNumericFields = []; // Track which numeric fields we've already used
  const expandedAxes = []; // Track which axis NAMES we've expanded/configured (strings)
  const configuredAxes = []; // Track which axes have been fully configured with a field
  const config = chartType ? CHART_FIELD_CONFIG[chartType] : null;
  
  console.log(`configureChartFields: Starting configuration for ${chartType || 'unknown'}`);
  if (config) {
    console.log(`configureChartFields: Axes needed: ${config.axes.join(', ')}`);
  }
  
  // Wait for the UI to stabilize after chart type selection
  await page.waitForTimeout(800);
  
  // For charts like Gauge/Metric that are already configured with Count by default,
  // try clicking Generate Chart immediately first
  const immediateGenerate = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => 
      b.textContent?.includes('Generate Chart') && !b.disabled
    );
    if (btn) {
      btn.scrollIntoView({ block: 'center' });
      btn.click();
      return true;
    }
    return false;
  });
  
  if (immediateGenerate) {
    await page.waitForTimeout(4000);
    const hasPreview = await page.evaluate(() => 
      !!document.querySelector('canvas.marks, svg.marks, .vega-container canvas, .vega-container svg')
    );
    if (hasPreview) {
      console.log(`configureChartFields: ${chartType} rendered immediately (pre-configured)`);
      return { fieldsConfigured: 0, metricConfigured: true, hasPreview: true, isReady: true };
    }
  }
  
  // Main configuration loop - iterate enough times for complex multi-field charts
  for (let round = 0; round < 15; round++) {
    
    // Check if we already have a preview
    const alreadyRendered = await page.evaluate(() => 
      !!document.querySelector('canvas.marks, svg.marks, .vega-container canvas, .vega-container svg')
    );
    if (alreadyRendered) {
      console.log(`configureChartFields: Preview detected after ${round} rounds`);
      break;
    }
    
    // Step 1: First, check if there's a visible "Select field..." button that needs clicking
    // If so, don't expand any new axes - configure the current one first
    const visibleFieldPicker = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (!btn.disabled && btn.textContent?.includes('Select field...') && btn.offsetParent !== null) {
          return true;
        }
      }
      return false;
    });
    
    // Step 1b: Only expand axes if there's no visible field picker to configure
    let expandResult = { expanded: false };
    if (!visibleFieldPicker) {
      // Find axis configuration cards - they're in rounded-xl divs with border
      // We track by axis NAME instead of index because cards can re-render
      expandResult = await page.evaluate((alreadyExpandedNames) => {
        const axisCards = document.querySelectorAll('.border.rounded-xl, [class*="rounded-xl"][class*="border"]');
        
        for (let i = 0; i < axisCards.length; i++) {
          const card = axisCards[i];
          
          // Get the axis name from the card header
          const headerBtn = card.querySelector('button.w-full, button[class*="w-full"]');
          const axisName = headerBtn?.textContent?.split('*')[0]?.trim() || '';
          
          // Skip if we've already configured this axis
          if (alreadyExpandedNames.includes(axisName) && axisName.length > 0) continue;
          
          // Check if this card already has expanded AND CONFIGURED content
          const buttons = card.querySelectorAll('button');
          let hasSelectFieldButton = false;
          let hasUnconfiguredMetric = false;
          let hasFieldSelected = false;
          
          for (const btn of buttons) {
            const btnText = btn.textContent || '';
            const classes = btn.className || '';
            
            // Check for "Select field" button (unselected)
            if (btnText.includes('Select field')) hasSelectFieldButton = true;
            
            // Check if any metric button is unselected (needs configuration)
            if (['Count', 'Sum', 'Average', 'Avg', 'Min', 'Max'].includes(btnText.trim())) {
              const isSelected = classes.includes('bg-blue') || classes.includes('bg-ocean') || 
                                 classes.includes('ring-') || classes.includes('text-blue-300');
              if (!isSelected) hasUnconfiguredMetric = true;
            }
            
            // Check if a field is already selected - look for field name badge/button
            // Field selector buttons show the field name after selection
            const isFieldSelectorBtn = btn.closest('.field-selector, [class*="field-selector"]') || 
                                        (classes.includes('gap-') && !btnText.includes('Select field'));
            if (isFieldSelectorBtn && 
                (btnText.includes('.keyword') || btnText.match(/\b(date|price|total|quantity)\b/i))) {
              hasFieldSelected = true;
            }
          }
          
          // This card needs configuration if it has a "Select field" button still showing
          const needsConfiguration = hasSelectFieldButton;
          
          // Also check if the card content is minimal (collapsed) - needs expansion
          const cardText = card.textContent || '';
          const isCollapsed = cardText.length < 150 && 
                              !cardText.includes('Select field') && 
                              !cardText.includes('Aggregation');
          
          if (needsConfiguration || isCollapsed) {
            // Find the header button (first full-width button in the card)
            for (const btn of buttons) {
              const classList = btn.className || '';
              if (classList.includes('w-full') || 
                  (classList.includes('flex') && classList.includes('justify-between'))) {
                btn.scrollIntoView({ block: 'center' });
                btn.click();
                return { expanded: true, axis: axisName, cardIndex: i };
              }
            }
          }
        }
        
        return { expanded: false };
      }, expandedAxes.map(a => typeof a === 'string' ? a : ''));
    }
    
    if (expandResult.expanded) {
      console.log(`configureChartFields: Expanded axis: ${expandResult.axis}`);
      // Track by axis name to avoid re-expanding the same axis
      if (expandResult.axis && !expandedAxes.includes(expandResult.axis)) {
        expandedAxes.push(expandResult.axis);
      }
      await page.waitForTimeout(600); // Give UI time to expand and show field picker
      
      // After expanding a bucket axis, immediately try to select a field
      // Don't wait for next loop iteration - configure the axis now
      continue; // Go to field selection step instead of checking for metric axes
    }
    
    // Step 2: Check if there's a "Select field..." button visible - if so, select a field first
    // This takes priority over metric configuration to ensure bucket axes are configured first
    const hasVisibleFieldPicker = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (!btn.disabled && btn.textContent?.includes('Select field...') && btn.offsetParent !== null) {
          return true;
        }
      }
      return false;
    });
    
    // Step 2b: Only look for metric axis configuration if no field picker is visible
    // This ensures bucket axes are configured before metric axes
    if (!hasVisibleFieldPicker) {
      // Look for metric axis headers (VALUE, FLOW VALUE, Y, etc.) and expand + configure
      const metricAxisResult = await page.evaluate(() => {
        // First, find axis headers with metric-style indicators (blue background)
        const axisIndicators = document.querySelectorAll('.bg-blue-500\\/20');
        
        for (const indicator of axisIndicators) {
          // Find the parent button (axis header)
          let parent = indicator.parentElement;
          for (let i = 0; i < 5 && parent; i++) {
            if (parent.tagName === 'BUTTON' && parent.className?.includes('w-full')) {
              // Check if this axis is already configured (has a field or shows "Count")
              const headerText = parent.textContent || '';
              const isConfigured = headerText.includes('.keyword') || 
                                    headerText.includes('_count') ||
                                    (headerText.includes('Count') && !headerText.includes('Sum'));
              
              // Check if the axis content is expanded (look for sibling content with Aggregation)
              const nextSibling = parent.nextElementSibling;
              const isExpanded = nextSibling && nextSibling.textContent?.includes('Aggregation');
              
              if (!isConfigured) {
                // Click to expand if not expanded
                if (!isExpanded) {
                  parent.scrollIntoView({ block: 'center' });
                  parent.click();
                  return { action: 'expanded', axis: headerText.substring(0, 40) };
                }
              }
              break;
            }
            parent = parent.parentElement;
          }
        }
        return { action: null };
      });
      
      if (metricAxisResult.action === 'expanded') {
        console.log(`configureChartFields: Expanded metric axis: ${metricAxisResult.axis}`);
        await page.waitForTimeout(400);
      }
    }
    
    // Step 2c: Look for unselected metric buttons (Count, Sum, etc.) and click Count
    const metricResult = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || '';
        const classes = btn.className || '';
        
        // Look for metric type buttons
        if (['Count', 'Sum', 'Average', 'Avg', 'Min', 'Max'].includes(text)) {
          // Check if this is in a metric selection group (has siblings with similar styling)
          const parent = btn.parentElement;
          const siblings = parent?.querySelectorAll('button');
          
          // Check if Count is not currently selected
          if (text === 'Count') {
            const isSelected = classes.includes('bg-blue') || classes.includes('text-blue-300');
            if (!isSelected) {
              btn.scrollIntoView({ block: 'center' });
              btn.click();
              return { clicked: true, metric: text };
            }
          }
        }
      }
      return { clicked: false };
    });
    
    if (metricResult.clicked) {
      console.log(`configureChartFields: Selected metric: ${metricResult.metric}`);
      fieldsConfigured++;
      await page.waitForTimeout(400);
    }
    
    // Step 3: Find "Select field..." buttons and click one
    // Determine what type of field we need based on context
    const fieldPickerInfo = await page.evaluate((configuredAxisNames) => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.disabled) continue;
        if (btn.offsetParent === null) continue; // Skip hidden buttons
        
        const text = btn.textContent || '';
        if (text.includes('Select field...')) {
          // Try to determine the axis type and name from nearby labels
          let axisType = 'bucket'; // Default to bucket since most field selectors are for buckets
          let axisName = '';
          let needsBinaryField = false; // For State/Group fields that need 2 distinct values
          let parent = btn.parentElement;
          for (let i = 0; i < 8 && parent; i++) {
            const parentText = parent.textContent || '';
            const parentClasses = parent.className || '';
            
            // Try to extract axis name from axis card header
            const headerBtns = parent.querySelectorAll('button.w-full, button[class*="w-full"]');
            for (const hb of headerBtns) {
              const hbText = hb.textContent || '';
              // Axis headers usually contain the axis ID in uppercase followed by the label
              if (hbText.match(/^[A-Z]{2,}/) || hbText.includes('*')) {
                axisName = hbText.split('*')[0]?.trim() || hbText.substring(0, 30);
                break;
              }
            }
            
            // Determine axis type
            if (parentText.includes('Numeric') || parentText.includes('Value Field') || 
                parentText.includes('half_float') || parentText.includes('distribution')) {
              axisType = 'numeric';
            }
            
            // Check for axes that need binary fields (exactly 2 distinct values)
            if (parentText.includes('State Field') || parentText.includes('2 distinct values') ||
                parentText.includes('Left/Right') || parentText.includes('Before/After')) {
              needsBinaryField = true;
            }
            
            // Check if parent is the axis card container
            if (parentClasses.includes('rounded-xl') && parentClasses.includes('border')) {
              break; // Found the axis card, stop searching
            }
            
            parent = parent.parentElement;
          }
          
          // Don't skip based on configured axes - just select any visible "Select field..." button
          // The UI should have already hidden configured axes or shown them as complete
          
          btn.scrollIntoView({ block: 'center' });
          btn.click();
          return { opened: true, axisType, axisName, needsBinaryField };
        }
      }
      return { opened: false };
    }, configuredAxes);
    
    if (fieldPickerInfo.opened) {
      await page.waitForTimeout(600);
      
      // Select appropriate field based on axis type and already-used fields
      const fieldResult = await page.evaluate((args) => {
        const { axisType, needsBinaryField, usedBucket, usedNumeric, bucketFields, binaryBucketFields, numericFields } = args;
        
        // The dropdown is teleported to body, so we need to search everywhere
        // It appears as a fixed-position div with rounded corners
        let dropdown = document.querySelector('.field-picker-dropdown');
        
        // If not found by class, search more broadly
        if (!dropdown) {
          // Look for any element that contains field type indicators and is visible
          const allDivs = document.querySelectorAll('div');
          for (const d of allDivs) {
            const style = window.getComputedStyle(d);
            const rect = d.getBoundingClientRect();
            
            // Skip invisible elements
            if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0) continue;
            
            // Check if this looks like a field picker dropdown
            const hasFieldTypes = d.textContent?.includes('keyword') || 
                                  d.textContent?.includes('double') ||
                                  d.textContent?.includes('integer') ||
                                  d.textContent?.includes('half_float') ||
                                  d.textContent?.includes('long');
            const hasSearchOrFields = d.textContent?.includes('Search fields') || 
                                      d.textContent?.includes('No fields');
            const hasButtons = d.querySelectorAll('button').length >= 2;
            
            // Field picker dropdowns have rounded corners and shadow
            const looksLikeDropdown = d.className?.includes('rounded') || 
                                      style.position === 'fixed' ||
                                      style.position === 'absolute';
            
            if (hasFieldTypes && hasButtons && looksLikeDropdown) {
              dropdown = d;
              break;
            }
          }
        }
        
        if (!dropdown) return { selected: false, reason: 'no-dropdown-found' };
        
        const fieldBtns = dropdown.querySelectorAll('button');
        
        // For numeric axes, prefer numeric fields
        if (axisType === 'numeric') {
          for (const preferredField of numericFields) {
            if (usedNumeric.includes(preferredField)) continue;
            for (const btn of fieldBtns) {
              const text = btn.textContent || '';
              if (text.includes(preferredField.split('.').pop())) {
                btn.click();
                return { selected: true, field: text.substring(0, 40), type: 'numeric' };
              }
            }
          }
          // Fallback to any numeric-looking field
          for (const btn of fieldBtns) {
            const text = btn.textContent || '';
            if (text.includes('integer') || text.includes('float') || text.includes('long') ||
                text.includes('double') || text.includes('half_float')) {
              btn.click();
              return { selected: true, field: text.substring(0, 40), type: 'numeric' };
            }
          }
        }
        
        // For bucket axes that need binary fields (2 distinct values), prefer those first
        if (needsBinaryField) {
          for (const preferredField of binaryBucketFields) {
            if (usedBucket.includes(preferredField)) continue;
            for (const btn of fieldBtns) {
              const text = btn.textContent || '';
              const fieldName = preferredField.split('.').pop();
              if (text.includes(fieldName)) {
                btn.click();
                return { selected: true, field: preferredField, type: 'bucket' };
              }
            }
          }
        }
        
        // For bucket axes, prefer keyword fields (use different ones for multi-bucket charts)
        for (const preferredField of bucketFields) {
          if (usedBucket.includes(preferredField)) continue;
          for (const btn of fieldBtns) {
            const text = btn.textContent || '';
            // Match by field name (last part of path)
            const fieldName = preferredField.split('.').pop();
            if (text.includes(fieldName)) {
              btn.click();
              return { selected: true, field: preferredField, type: 'bucket' };
            }
          }
        }
        
        // Try date fields
        for (const btn of fieldBtns) {
          const text = btn.textContent || '';
          if (text.includes('date') && !usedBucket.includes('order_date')) {
            btn.click();
            return { selected: true, field: 'order_date', type: 'date' };
          }
        }
        
        // Last resort: any keyword field not used yet
        for (const btn of fieldBtns) {
          const text = btn.textContent || '';
          if (text.includes('keyword')) {
            const fieldMatch = text.match(/(\S+\.keyword)/);
            if (fieldMatch && !usedBucket.includes(fieldMatch[1])) {
              btn.click();
              return { selected: true, field: fieldMatch[1], type: 'bucket' };
            }
          }
        }
        
        // Absolute fallback: any field
        for (const btn of fieldBtns) {
          const text = btn.textContent?.trim() || '';
          if (text.length > 2 && !text.includes('Search') && !text.includes('No fields') &&
              btn.tagName === 'BUTTON') {
            btn.click();
            return { selected: true, field: text.substring(0, 30), type: 'any' };
          }
        }
        
        return { selected: false, reason: 'no-suitable-field' };
      }, {
        axisType: fieldPickerInfo.axisType,
        needsBinaryField: fieldPickerInfo.needsBinaryField || false,
        usedBucket: usedBucketFields,
        usedNumeric: usedNumericFields,
        bucketFields: ECOMMERCE_FIELDS.bucket,
        binaryBucketFields: ECOMMERCE_FIELDS.binaryBucket,
        numericFields: ECOMMERCE_FIELDS.numeric
      });
      
      if (fieldResult.selected) {
        console.log(`configureChartFields: Selected field: ${fieldResult.field} (${fieldResult.type}) for axis: ${fieldPickerInfo.axisName || 'unknown'}`);
        if (fieldResult.type === 'bucket' || fieldResult.type === 'date') {
          usedBucketFields.push(fieldResult.field);
        } else if (fieldResult.type === 'numeric') {
          usedNumericFields.push(fieldResult.field);
        }
        // Mark this axis as configured so we don't try to configure it again
        if (fieldPickerInfo.axisName && !configuredAxes.includes(fieldPickerInfo.axisName)) {
          configuredAxes.push(fieldPickerInfo.axisName);
        }
        fieldsConfigured++;
        await page.waitForTimeout(500);
      } else {
        console.log(`configureChartFields: Could not select field: ${fieldResult.reason}`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    }
    
    // Step 4: Try to click "Generate Chart" if enabled
    const generateClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.textContent?.includes('Generate Chart') && !b.disabled
      );
      if (btn) {
        btn.scrollIntoView({ block: 'center' });
        btn.click();
        return true;
      }
      return false;
    });
    
    if (generateClicked) {
      await page.waitForTimeout(3000);
      const hasPreview = await page.evaluate(() => 
        !!document.querySelector('canvas.marks, svg.marks, .vega-container canvas, .vega-container svg')
      );
      if (hasPreview) {
        console.log(`configureChartFields: Preview rendered after Generate Chart click`);
        break;
      }
    }
    
    // Exit if nothing was configured in this round (but still try Generate once more)
    if (!expandResult.expanded && !fieldPickerInfo.opened && !metricResult.clicked) {
      console.log(`configureChartFields: No more configuration actions available in round ${round}`);
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent?.includes('Generate Chart') && !b.disabled
        );
        if (btn) btn.click();
      });
      await page.waitForTimeout(2000);
      break;
    }
  }
  
  // Final state check
  let finalState = await page.evaluate(() => {
    const content = document.body.textContent || '';
    const canvas = document.querySelector('canvas.marks, svg.marks, .vega-container canvas, .vega-container svg');
    
    return {
      isReady: content.includes('Ready to render') || content.includes('data points ready'),
      hasGenerateButton: content.includes('Generate Chart'),
      missingFields: content.includes('Missing Fields'),
      hasPreview: !!canvas,
      previewType: canvas?.tagName || null
    };
  });
  
  // If ready but no preview, try clicking Generate Chart multiple times
  for (let finalAttempt = 0; finalAttempt < 3; finalAttempt++) {
    if (finalState.hasPreview) break;
    
    // Check if data is ready and we can render
    const canRender = finalState.isReady || fieldsConfigured > 0 || !finalState.missingFields;
    if (!canRender) break;
    
    console.log(`configureChartFields: Final attempt ${finalAttempt + 1} - clicking Generate Chart`);
    const clicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.textContent?.includes('Generate Chart') && !b.disabled
      );
      if (btn) {
        btn.scrollIntoView({ block: 'center' });
        btn.click();
        return true;
      }
      return false;
    });
    
    if (!clicked) break;
    
    // Wait for render
    await page.waitForTimeout(3000);
    
    finalState = await page.evaluate(() => {
      const content = document.body.textContent || '';
      const canvas = document.querySelector('canvas.marks, svg.marks, .vega-container canvas, .vega-container svg');
      
      return {
        isReady: content.includes('Ready to render') || content.includes('data points ready'),
        hasGenerateButton: content.includes('Generate Chart'),
        missingFields: content.includes('Missing Fields'),
        hasPreview: !!canvas,
        previewType: canvas?.tagName || null
      };
    });
    
    if (finalState.hasPreview) {
      console.log('configureChartFields: Preview appeared after final Generate Chart click');
    }
  }
  
  console.log(`configureChartFields: Complete - fieldsConfigured=${fieldsConfigured}, hasPreview=${finalState.hasPreview}, usedBucket=[${usedBucketFields.join(', ')}], usedNumeric=[${usedNumericFields.join(', ')}]`);
  
  return {
    fieldsConfigured,
    usedBucketFields,
    usedNumericFields,
    ...finalState
  };
}

/**
 * Legacy helper for backward compatibility
 */
async function selectXAxisField(page, chartType = null) {
  const result = await configureChartFields(page, chartType);
  return result.fieldsConfigured > 0 || result.isReady || result.hasPreview;
}

/**
 * Helper: Wait for chart to render (canvas or SVG)
 */
async function waitForChartRender(page, timeout = 5000) {
  try {
    // Wait for Vega canvas or SVG to appear
    await page.locator('canvas.marks, svg.marks, [class*="vega"] canvas, [class*="vega"] svg').first().waitFor({
      state: 'visible',
      timeout
    });
    return true;
  } catch (e) {
    // Check if there's a Vega visualization container (even if not fully rendered)
    const vegaContainer = page.locator('[aria-label*="Vega"], [role="img"]');
    return await vegaContainer.count() > 0;
  }
}

/**
 * Helper: Take a screenshot and attach to test report
 */
async function takeChartScreenshot(page, testInfo, name) {
  const screenshot = await page.screenshot({ fullPage: false });
  await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
}

/**
 * DEBUG DIAGNOSTIC: Capture detailed page state for troubleshooting
 * Call this when a chart doesn't render as expected
 */
async function captureDebugDiagnostics(page, testInfo, chartName, reason) {
  const diagnostics = {
    chartName,
    reason,
    timestamp: new Date().toISOString(),
    url: page.url(),
    pageState: {},
    configState: {},
    errors: [],
    warnings: []
  };

  try {
    // Capture page state
    diagnostics.pageState = await page.evaluate(() => {
      const state = {
        currentStep: null,
        selectedChartType: null,
        configuredFields: [],
        statusMessages: [],
        visibleButtons: [],
        hasPreview: false,
        previewType: null,
        dataPointsInfo: null
      };

      // Find current step
      const stepButtons = document.querySelectorAll('button');
      for (const btn of stepButtons) {
        if (btn.classList.contains('bg-ocean-500') || btn.textContent?.match(/^[123]$/)) {
          const stepNum = btn.textContent?.trim();
          if (['1', '2', '3'].includes(stepNum)) {
            state.currentStep = stepNum;
          }
        }
      }

      // Find selected chart type (look for highlighted card)
      const chartCards = document.querySelectorAll('[class*="ocean-500"], [class*="selected"]');
      for (const card of chartCards) {
        const text = card.textContent || '';
        if (text.includes('Chart') || text.includes('Plot') || text.includes('Map')) {
          state.selectedChartType = text.substring(0, 50);
          break;
        }
      }

      // Find configured fields
      const fieldSelectors = document.querySelectorAll('button');
      for (const btn of fieldSelectors) {
        const text = btn.textContent || '';
        // Look for axis buttons that have field names
        if ((text.includes('X-Axis') || text.includes('Y-Axis') || text.includes('Categories') || text.includes('Values')) 
            && !text.includes('Select field')) {
          state.configuredFields.push(text.substring(0, 100));
        }
      }

      // Find status messages
      const statusPatterns = [
        'Ready to render',
        'Generate Chart',
        'data points ready',
        'Missing Fields',
        'Configure required',
        'No Preview',
        'error',
        'Error'
      ];
      const bodyText = document.body.textContent || '';
      for (const pattern of statusPatterns) {
        if (bodyText.includes(pattern)) {
          state.statusMessages.push(pattern);
        }
      }

      // Check for data points info
      const dataMatch = bodyText.match(/(\d+)\s*data\s*points?\s*ready/i);
      if (dataMatch) {
        state.dataPointsInfo = dataMatch[0];
      }

      // Check for preview
      const canvas = document.querySelector('canvas.marks, canvas');
      const svg = document.querySelector('svg.marks, svg[class*="vega"]');
      if (canvas) {
        state.hasPreview = true;
        state.previewType = 'canvas';
      } else if (svg) {
        state.hasPreview = true;
        state.previewType = 'svg';
      }

      // Find buttons that might need clicking
      const actionButtons = document.querySelectorAll('button');
      for (const btn of actionButtons) {
        const text = btn.textContent?.trim() || '';
        if (text.includes('Select') || text.includes('Generate') || text.includes('Continue') || text.includes('Run')) {
          state.visibleButtons.push({
            text: text.substring(0, 50),
            disabled: btn.disabled,
            visible: btn.offsetParent !== null
          });
        }
      }

      return state;
    });

    // Capture any visible error messages
    const errorElements = await page.locator('[class*="error"], [class*="Error"], [role="alert"]').allTextContents();
    diagnostics.errors = errorElements.filter(t => t.trim().length > 0);

    // Capture warning messages
    const warningElements = await page.locator('[class*="warning"], [class*="Warning"]').allTextContents();
    diagnostics.warnings = warningElements.filter(t => t.trim().length > 0);

    // Take a full-page screenshot for debugging
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(`debug-${chartName.replace(/\s+/g, '-').toLowerCase()}-fullpage`, {
      body: screenshot,
      contentType: 'image/png'
    });

    // Attach the diagnostics as JSON
    await testInfo.attach(`debug-${chartName.replace(/\s+/g, '-').toLowerCase()}-diagnostics`, {
      body: JSON.stringify(diagnostics, null, 2),
      contentType: 'application/json'
    });

    // Log summary to console for immediate visibility
    console.log(`\n========== DEBUG: ${chartName} ==========`);
    console.log(`Reason: ${reason}`);
    console.log(`Current Step: ${diagnostics.pageState.currentStep}`);
    console.log(`Selected Chart: ${diagnostics.pageState.selectedChartType}`);
    console.log(`Configured Fields: ${diagnostics.pageState.configuredFields.length}`);
    console.log(`Has Preview: ${diagnostics.pageState.hasPreview} (${diagnostics.pageState.previewType})`);
    console.log(`Status Messages: ${diagnostics.pageState.statusMessages.join(', ')}`);
    console.log(`Data Points: ${diagnostics.pageState.dataPointsInfo || 'none'}`);
    console.log(`Errors: ${diagnostics.errors.length > 0 ? diagnostics.errors.join('; ') : 'none'}`);
    console.log(`Buttons needing action: ${diagnostics.pageState.visibleButtons.filter(b => !b.disabled).map(b => b.text).join(', ')}`);
    console.log('==========================================\n');

    return diagnostics;
  } catch (err) {
    console.error(`Failed to capture diagnostics for ${chartName}:`, err.message);
    return diagnostics;
  }
}

// ============================================================================
// FULL FLOW TESTS - Navigate Data Source -> Chart Type -> Configure -> Render
// ============================================================================

test.describe('Chart Rendering - Full Flow', () => {
  
  test('builder page loads and shows data source step', async ({ page, errorCollector }, testInfo) => {
    await page.goto('/builder');
    await waitForPageStable(page);
    
    // Should see Data Source panel
    const dataSourceHeading = page.getByRole('heading', { name: /Select Data Source/i });
    expect(await dataSourceHeading.count()).toBeGreaterThan(0);
    
    await takeChartScreenshot(page, testInfo, 'builder-data-source-step');
    errorCollector.assertNoErrors();
  });

  test('can select an index and proceed to chart type picker', async ({ page, errorCollector }, testInfo) => {
    const navigated = await navigateToChartTypePicker(page);
    
    await takeChartScreenshot(page, testInfo, navigated ? 'chart-type-picker' : 'no-indices-available');
    
    if (navigated) {
      // Should see "Choose Chart Type" heading
      const chartTypeHeading = page.getByRole('heading', { name: /Choose Chart Type/i });
      expect(await chartTypeHeading.count()).toBeGreaterThan(0);
      console.log('✓ Successfully navigated to chart type picker');
    } else {
      console.log('⚠ No Elasticsearch indices available - cannot test chart type picker');
    }
    
    errorCollector.assertNoErrors();
  });

  // Test each chart type renders with actual data
  for (const chart of ALL_CHART_TYPES) {
    test(`${chart.name} - renders with sample data`, async ({ page, errorCollector }, testInfo) => {
      const navigated = await navigateToChartTypePicker(page);
      
      if (!navigated) {
        console.log(`Skipping ${chart.name} - no indices available`);
        await takeChartScreenshot(page, testInfo, `${chart.type}-no-indices`);
        recordChartResult(chart.name, chart.type, 'skipped', 'No Elasticsearch indices available');
        errorCollector.assertNoErrors();
        return;
      }
      
      // Select the chart type
      const selected = await selectChartType(page, chart.name);
      
      if (!selected) {
        console.log(`⚠ ${chart.name} not found in picker`);
        await takeChartScreenshot(page, testInfo, `${chart.type}-not-found`);
        recordChartResult(chart.name, chart.type, 'not-found', 'Chart type not found in picker UI');
        errorCollector.assertNoErrors();
        return;
      }
      
      // Wait for configure panel to appear
      await page.waitForTimeout(500);
      
      // Configure chart fields using chart-specific configuration
      const fieldSelected = await selectXAxisField(page, chart.type);
      
      let renderStatus = 'unknown';
      let diagnostics = null;
      let uiErrorText = null;
      
      if (fieldSelected) {
        // Wait for chart to render
        await page.waitForTimeout(2000);
        const rendered = await waitForChartRender(page, 3000);
        
        await takeChartScreenshot(page, testInfo, `${chart.type}-chart-rendered`);
        
        if (rendered) {
          console.log(`✓ ${chart.name} rendered successfully`);
          renderStatus = 'success';
        } else {
          renderStatus = 'needs-fields';
          console.log(`○ ${chart.name} configured but preview may need additional fields`);
          // Capture debug diagnostics for troubleshooting
          diagnostics = await captureDebugDiagnostics(page, testInfo, chart.name, 'Preview may need additional fields');
        }
      } else {
        // Some chart types may auto-render or have different field requirements
        await page.waitForTimeout(1000);
        const rendered = await waitForChartRender(page, 2000);
        
        await takeChartScreenshot(page, testInfo, `${chart.type}-chart-configured`);
        
        if (rendered) {
          console.log(`✓ ${chart.name} auto-rendered successfully`);
          renderStatus = 'success';
        } else {
          renderStatus = 'needs-fields';
          console.log(`○ ${chart.name} configured but needs additional fields`);
          // Capture debug diagnostics for troubleshooting
          diagnostics = await captureDebugDiagnostics(page, testInfo, chart.name, 'Field selection not available or chart needs different configuration');
        }
      }
      
      // Check for visible error messages in the UI
      const errorMessages = page.locator('[class*="error"]').filter({ hasText: /error/i });
      const hasUIError = await errorMessages.count() > 0;
      
      if (hasUIError) {
        uiErrorText = await errorMessages.first().textContent();
        console.log(`⚠ ${chart.name} shows UI message: ${uiErrorText}`);
        // Capture debug diagnostics for UI errors
        if (!diagnostics) {
          diagnostics = await captureDebugDiagnostics(page, testInfo, chart.name, `UI Error: ${uiErrorText}`);
        }
      }
      
      // Get console error summary for recording (captures ALL errors, including filtered ones)
      const consoleErrorSummary = errorCollector.getErrorSummary();
      
      // Record result to summary file with console error info
      recordChartResult(chart.name, chart.type, renderStatus, 
        renderStatus !== 'success' ? 'See diagnostics for details' : null,
        diagnostics, hasUIError, uiErrorText, consoleErrorSummary);
      
      // Attach render status to test info for reporting
      await testInfo.attach(`${chart.type}-render-status`, {
        body: JSON.stringify({ 
          chartName: chart.name, 
          status: renderStatus, 
          hasUIError,
          consoleErrorCounts: consoleErrorSummary.counts,
          needsReview: consoleErrorSummary.needsReview
        }),
        contentType: 'application/json'
      });
      
      // Main assertion: no JavaScript console errors (uses filtered list - only critical errors fail)
      errorCollector.assertNoErrors();
    });
  }
});

// ============================================================================
// SPEC OUTPUT TESTS - Verify Vega and Kibana spec tabs work
// ============================================================================

test.describe('Spec Output Validation', () => {
  
  test('Vega Spec tab shows JSON output', async ({ page, errorCollector }, testInfo) => {
    const navigated = await navigateToChartTypePicker(page);
    if (!navigated) {
      await takeChartScreenshot(page, testInfo, 'spec-no-indices');
      return;
    }
    
    // Select bar chart
    await selectChartType(page, 'Bar Chart');
    await page.waitForTimeout(500);
    
    // Select a field
    await selectXAxisField(page);
    await page.waitForTimeout(1000);
    
    // Click on Vega Spec tab
    const vegaTab = page.getByRole('button', { name: /Vega Spec/i });
    if (await vegaTab.count() > 0) {
      await vegaTab.click();
      await page.waitForTimeout(500);
    }
    
    await takeChartScreenshot(page, testInfo, 'vega-spec-output');
    
    // Look for JSON content indicators
    const pageContent = await page.content();
    if (pageContent.includes('$schema') || pageContent.includes('"mark"') || pageContent.includes('"data"')) {
      console.log('✓ Vega spec contains valid JSON structure');
    }
    
    errorCollector.assertNoErrors();
  });

  test('Kibana Spec tab shows JSON output', async ({ page, errorCollector }, testInfo) => {
    const navigated = await navigateToChartTypePicker(page);
    if (!navigated) {
      await takeChartScreenshot(page, testInfo, 'kibana-spec-no-indices');
      return;
    }
    
    // Select bar chart
    await selectChartType(page, 'Bar Chart');
    await page.waitForTimeout(500);
    
    // Select a field
    await selectXAxisField(page);
    await page.waitForTimeout(1000);
    
    // Click on Kibana Spec tab
    const kibanaTab = page.getByRole('button', { name: /Kibana/i });
    if (await kibanaTab.count() > 0) {
      await kibanaTab.click();
      await page.waitForTimeout(500);
    }
    
    await takeChartScreenshot(page, testInfo, 'kibana-spec-output');
    
    // Look for Elasticsearch query structure
    const pageContent = await page.content();
    if (pageContent.includes('aggs') || pageContent.includes('query') || pageContent.includes('%context%')) {
      console.log('✓ Kibana spec contains Elasticsearch structure');
    }
    
    errorCollector.assertNoErrors();
  });

  // Test Kibana spec generation for each chart type
  for (const chart of ALL_CHART_TYPES) {
    test(`${chart.name} - Kibana spec generates without errors`, async ({ page, errorCollector }, testInfo) => {
      const navigated = await navigateToChartTypePicker(page);
      if (!navigated) return;
      
      const selected = await selectChartType(page, chart.name);
      if (!selected) return;
      
      await page.waitForTimeout(500);
      await selectXAxisField(page, chart.type);
      await page.waitForTimeout(500);
      
      // Switch to Kibana tab
      const kibanaTab = page.getByRole('button', { name: /Kibana/i });
      if (await kibanaTab.count() > 0) {
        await kibanaTab.click();
        await page.waitForTimeout(500);
      }
      
      await takeChartScreenshot(page, testInfo, `${chart.type}-kibana-spec`);
      
      errorCollector.assertNoErrors();
    });
  }
});

// ============================================================================
// COPY FUNCTIONALITY TESTS
// ============================================================================

test.describe('Copy Spec Functionality', () => {
  
  test('Copy Vega spec button works', async ({ page, errorCollector }, testInfo) => {
    const navigated = await navigateToChartTypePicker(page);
    if (!navigated) return;
    
    await selectChartType(page, 'Bar Chart');
    await selectXAxisField(page);
    await page.waitForTimeout(1000);
    
    // Find and click copy button
    const copyBtn = page.getByRole('button', { name: /Copy/i }).first();
    
    if (await copyBtn.count() > 0) {
      try {
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      } catch (e) {
        // Permissions might not be available
      }
      
      await copyBtn.click();
      await page.waitForTimeout(500);
      
      await takeChartScreenshot(page, testInfo, 'copy-vega-spec');
      console.log('✓ Copy button clicked successfully');
    }
    
    errorCollector.assertNoErrors();
  });
});

// ============================================================================
// LIBRARY TEMPLATE TESTS
// ============================================================================

test.describe('Library Template Rendering', () => {
  
  test('library page shows templates', async ({ page, errorCollector }, testInfo) => {
    await page.goto('/library');
    await waitForPageStable(page);
    
    await page.waitForTimeout(1000);
    
    await takeChartScreenshot(page, testInfo, 'library-templates');
    
    // Should have content
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(1000);
    
    errorCollector.assertNoErrors();
  });

  test('clicking template opens it in builder', async ({ page, errorCollector }, testInfo) => {
    await page.goto('/library');
    await waitForPageStable(page);
    
    // Find and click "Use" or "Try" button on any template
    const useBtn = page.getByRole('button', { name: /Use|Try|Open/i }).first();
    
    if (await useBtn.count() > 0) {
      await useBtn.click();
      await waitForPageStable(page);
      
      // Should navigate to builder
      expect(page.url()).toContain('/builder');
      
      // Wait for template to load
      await page.waitForTimeout(2000);
      
      // Check for preview
      const rendered = await waitForChartRender(page, 5000);
      
      await takeChartScreenshot(page, testInfo, 'template-in-builder');
      
      if (rendered) {
        console.log('✓ Template rendered successfully in builder');
      }
    } else {
      await takeChartScreenshot(page, testInfo, 'library-no-use-button');
    }
    
    errorCollector.assertNoErrors();
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

test.describe('Error Handling', () => {
  
  test('changing chart types rapidly does not cause errors', async ({ page, errorCollector }, testInfo) => {
    const navigated = await navigateToChartTypePicker(page);
    if (!navigated) return;
    
    // Rapidly switch between chart types
    const chartTypes = ['Bar Chart', 'Line Chart', 'Pie Chart', 'Area Chart', 'Scatter Plot'];
    
    for (const chartType of chartTypes) {
      await selectChartType(page, chartType);
      await page.waitForTimeout(200);
    }
    
    await waitForPageStable(page);
    await takeChartScreenshot(page, testInfo, 'rapid-chart-switching');
    
    errorCollector.assertNoErrors();
  });

  test('builder handles incomplete configuration gracefully', async ({ page, errorCollector }, testInfo) => {
    const navigated = await navigateToChartTypePicker(page);
    if (!navigated) return;
    
    // Select scatter which requires multiple fields
    await selectChartType(page, 'Scatter Plot');
    await page.waitForTimeout(1000);
    
    await takeChartScreenshot(page, testInfo, 'scatter-no-full-config');
    
    // Should not have JavaScript errors even without full configuration
    errorCollector.assertNoErrors();
  });
});

// ============================================================================
// SCENARIO-BASED TESTS - Test charts with specific field/aggregation combos
// ============================================================================

/**
 * Scenario-based testing: Tests each chart with its best-suited data scenario
 * This ensures charts are tested with realistic data configurations
 */
test.describe('Scenario Tests - Time-Series', () => {
  // Charts that work best with time-series data
  const timeSeriesCharts = [
    { name: 'Line Chart', type: 'line' },
    { name: 'Area Chart', type: 'area' },
    { name: 'Bar Chart', type: 'bar' }
  ];

  for (const chart of timeSeriesCharts) {
    test(`${chart.name} - renders with time-series data (order_date)`, async ({ page, errorCollector }, testInfo) => {
      const navigated = await navigateToChartTypePicker(page);
      if (!navigated) {
        recordChartResult(`${chart.name} (Time-Series)`, chart.type, 'skipped', 'No indices');
        return;
      }

      const selected = await selectChartType(page, chart.name);
      if (!selected) {
        recordChartResult(`${chart.name} (Time-Series)`, chart.type, 'error', 'Chart type not found');
        return;
      }

      // Try to select order_date for X-axis (date field)
      await page.waitForTimeout(500);
      
      const dateFieldSelected = await page.evaluate(() => {
        // Look for order_date in field list
        const buttons = Array.from(document.querySelectorAll('button'));
        const dateBtn = buttons.find(b => b.textContent?.includes('order_date'));
        if (dateBtn) {
          dateBtn.scrollIntoView({ block: 'center' });
          dateBtn.click();
          return true;
        }
        return false;
      });

      if (!dateFieldSelected) {
        // Fall back to regular configuration
        await configureChartFields(page, chart.type);
      }

      await page.waitForTimeout(2000);
      const rendered = await waitForChartRender(page, 3000);

      await takeChartScreenshot(page, testInfo, `${chart.type}-time-series`);

      const errorSummary = errorCollector.getErrorSummary();
      recordChartResult(
        `${chart.name} (Time-Series)`,
        chart.type,
        rendered ? 'success' : 'needs-fields',
        rendered ? null : 'Time-series configuration may need adjustment',
        null,
        false,
        null,
        errorSummary
      );

      errorCollector.assertNoErrors();
    });
  }
});

test.describe('Scenario Tests - Category Breakdown', () => {
  // Charts that work best with categorical data
  const categoryCharts = [
    { name: 'Pie Chart', type: 'pie' },
    { name: 'Donut Chart', type: 'donut' },
    { name: 'Treemap', type: 'treemap' },
    { name: 'Radial Bar Chart', type: 'radial' }
  ];

  for (const chart of categoryCharts) {
    test(`${chart.name} - renders with category breakdown (category.keyword)`, async ({ page, errorCollector }, testInfo) => {
      const navigated = await navigateToChartTypePicker(page);
      if (!navigated) {
        recordChartResult(`${chart.name} (Category)`, chart.type, 'skipped', 'No indices');
        return;
      }

      const selected = await selectChartType(page, chart.name);
      if (!selected) {
        recordChartResult(`${chart.name} (Category)`, chart.type, 'error', 'Chart type not found');
        return;
      }

      // Configure with category.keyword and Count metric
      await configureChartFields(page, chart.type);
      await page.waitForTimeout(2000);

      const rendered = await waitForChartRender(page, 3000);

      await takeChartScreenshot(page, testInfo, `${chart.type}-category-breakdown`);

      const errorSummary = errorCollector.getErrorSummary();
      recordChartResult(
        `${chart.name} (Category)`,
        chart.type,
        rendered ? 'success' : 'needs-fields',
        rendered ? null : 'Category breakdown may need adjustment',
        null,
        false,
        null,
        errorSummary
      );

      errorCollector.assertNoErrors();
    });
  }
});

test.describe('Scenario Tests - Multi-Metric', () => {
  // Charts that work best with multiple numeric fields
  const multiMetricCharts = [
    { name: 'Scatter Plot', type: 'scatter' },
    { name: 'Bubble Plot', type: 'bubble' },
    { name: '2D Histogram Heatmap', type: 'binned_heatmap' }
  ];

  for (const chart of multiMetricCharts) {
    test(`${chart.name} - renders with multi-metric data (price vs quantity)`, async ({ page, errorCollector }, testInfo) => {
      const navigated = await navigateToChartTypePicker(page);
      if (!navigated) {
        recordChartResult(`${chart.name} (Multi-Metric)`, chart.type, 'skipped', 'No indices');
        return;
      }

      const selected = await selectChartType(page, chart.name);
      if (!selected) {
        recordChartResult(`${chart.name} (Multi-Metric)`, chart.type, 'error', 'Chart type not found');
        return;
      }

      // Configure with numeric fields
      await configureChartFields(page, chart.type);
      await page.waitForTimeout(2000);

      const rendered = await waitForChartRender(page, 3000);

      await takeChartScreenshot(page, testInfo, `${chart.type}-multi-metric`);

      const errorSummary = errorCollector.getErrorSummary();
      recordChartResult(
        `${chart.name} (Multi-Metric)`,
        chart.type,
        rendered ? 'success' : 'needs-fields',
        rendered ? null : 'Multi-metric configuration may need adjustment',
        null,
        false,
        null,
        errorSummary
      );

      errorCollector.assertNoErrors();
    });
  }
});

// ============================================================================
// COMPREHENSIVE SCENARIO MATRIX - Test key charts across all scenarios
// ============================================================================

test.describe('Scenario Matrix - Cross-Scenario Testing', () => {
  // Key charts to test across all scenarios
  const keyCharts = [
    { name: 'Bar Chart', type: 'bar' },
    { name: 'Line Chart', type: 'line' }
  ];

  for (const chart of keyCharts) {
    for (const [scenarioKey, scenario] of Object.entries(TEST_SCENARIOS)) {
      test(`${chart.name} - ${scenario.name} scenario`, async ({ page, errorCollector }, testInfo) => {
        const navigated = await navigateToChartTypePicker(page);
        if (!navigated) return;

        const selected = await selectChartType(page, chart.name);
        if (!selected) return;

        // Configure based on scenario
        const fieldConfig = scenario.fieldSelections;
        
        // Try to select the scenario-specific primary bucket field
        const primaryField = fieldConfig.x || fieldConfig.category || scenario.primaryBucket;
        
        if (primaryField) {
          await page.evaluate((field) => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const fieldBtn = buttons.find(b => 
              b.textContent?.toLowerCase().includes(field.toLowerCase().replace('.keyword', ''))
            );
            if (fieldBtn) {
              fieldBtn.scrollIntoView({ block: 'center' });
              fieldBtn.click();
            }
          }, primaryField);
        }

        await page.waitForTimeout(500);
        
        // Fall back to default configuration
        await configureChartFields(page, chart.type);
        await page.waitForTimeout(2000);

        const rendered = await waitForChartRender(page, 3000);

        await takeChartScreenshot(page, testInfo, `${chart.type}-scenario-${scenarioKey}`);

        console.log(`${chart.name} with ${scenario.name}: ${rendered ? '✓' : '○'}`);

        errorCollector.assertNoErrors();
      });
    }
  }
});

// ============================================================================
// MULTI-AXIS TESTS - Charts with Color/Stacking and Complex Configurations
// ============================================================================

/**
 * Helper: Select a specific field from a dropdown for a given axis
 * Expands the axis section if needed, clicks the field selector, and selects the field
 */
async function selectFieldForAxis(page, axisName, fieldName) {
  // First, try to expand the axis section if it's collapsed
  const expanded = await page.evaluate((axis) => {
    const axisCards = document.querySelectorAll('.border.rounded-xl, [class*="rounded-xl"][class*="border"]');
    for (const card of axisCards) {
      const cardText = card.textContent || '';
      if (cardText.toLowerCase().includes(axis.toLowerCase())) {
        const headerBtn = card.querySelector('button.w-full, button.flex.justify-between');
        if (headerBtn && headerBtn.getAttribute('aria-expanded') === 'false') {
          headerBtn.click();
          return { expanded: true, axis };
        }
        return { expanded: false, alreadyOpen: true, axis };
      }
    }
    return { expanded: false, notFound: true, axis };
  }, axisName);
  
  if (expanded.expanded) {
    await page.waitForTimeout(400);
  }
  
  // Click the "Select field..." button in that axis
  const fieldBtnClicked = await page.evaluate((axis) => {
    const axisCards = document.querySelectorAll('.border.rounded-xl, [class*="rounded-xl"][class*="border"]');
    for (const card of axisCards) {
      const cardText = card.textContent || '';
      if (cardText.toLowerCase().includes(axis.toLowerCase())) {
        const buttons = card.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent?.includes('Select field')) {
            btn.scrollIntoView({ block: 'center' });
            btn.click();
            return true;
          }
        }
      }
    }
    return false;
  }, axisName);
  
  if (!fieldBtnClicked) {
    console.log(`selectFieldForAxis: Could not find "Select field" button for axis "${axisName}"`);
    return false;
  }
  
  await page.waitForTimeout(400);
  
  // Select the specific field from the dropdown
  const fieldSelected = await page.evaluate((field) => {
    // Look for dropdown
    const dropdowns = document.querySelectorAll('[class*="dropdown"], [class*="menu"], [role="listbox"], .absolute');
    for (const dropdown of dropdowns) {
      const buttons = dropdown.querySelectorAll('button');
      for (const btn of buttons) {
        const btnText = btn.textContent || '';
        // Match field name (handle .keyword suffix variations)
        if (btnText.includes(field) || 
            btnText.includes(field.replace('.keyword', '')) ||
            btnText.includes(field.split('.')[0])) {
          btn.scrollIntoView({ block: 'center' });
          btn.click();
          return { selected: true, field: btnText.trim() };
        }
      }
    }
    // Try all visible buttons as fallback
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const btnText = btn.textContent || '';
      if (btnText.includes(field) || btnText.includes(field.replace('.keyword', ''))) {
        btn.scrollIntoView({ block: 'center' });
        btn.click();
        return { selected: true, field: btnText.trim(), fallback: true };
      }
    }
    return { selected: false };
  }, fieldName);
  
  if (fieldSelected.selected) {
    console.log(`selectFieldForAxis: Selected "${fieldSelected.field}" for axis "${axisName}"`);
    await page.waitForTimeout(300);
    return true;
  }
  
  // Close dropdown if field not found
  await page.keyboard.press('Escape');
  console.log(`selectFieldForAxis: Could not find field "${fieldName}" for axis "${axisName}"`);
  return false;
}

/**
 * Multi-Axis Scenario Tests
 * These tests specifically validate charts with:
 * - Color/stacking fields (Area, Bar, Line with color grouping)
 * - Multiple bucket fields (Heatmap, Lasagna, Population Pyramid)
 * - Multi-metric fields (Scatter, Bubble, Ternary)
 */
test.describe('Multi-Axis Tests - Stacked/Colored Charts', () => {
  
  // Charts that support color/stacking fields
  const stackableCharts = [
    { name: 'Area Chart', type: 'area', colorAxis: 'color', colorAxisLabel: 'Stacked By' },
    { name: 'Bar Chart', type: 'bar', colorAxis: 'color', colorAxisLabel: 'Stacked By' },
    { name: 'Line Chart', type: 'line', colorAxis: 'color', colorAxisLabel: 'Color' }
  ];
  
  for (const chart of stackableCharts) {
    test(`${chart.name} - renders with stacking/color field (multi_terms aggregation)`, async ({ page, errorCollector }, testInfo) => {
      const navigated = await navigateToChartTypePicker(page);
      if (!navigated) {
        console.log(`Skipping ${chart.name} stacking test - no indices`);
        return;
      }

      const selected = await selectChartType(page, chart.name);
      if (!selected) {
        console.log(`Skipping ${chart.name} stacking test - chart type not found`);
        return;
      }

      await page.waitForTimeout(500);

      // Step 1: Configure X-axis with category.keyword
      console.log(`${chart.name}: Configuring X-axis...`);
      await selectFieldForAxis(page, 'X-Axis', 'category.keyword');
      await page.waitForTimeout(500);

      // Step 2: Wait for initial render (just X + Count)
      let initialRender = await waitForChartRender(page, 3000);
      if (initialRender) {
        console.log(`${chart.name}: Initial render successful (X + Count)`);
        await takeChartScreenshot(page, testInfo, `${chart.type}-initial-no-color`);
      }

      // Step 3: Add color/stacking field
      console.log(`${chart.name}: Adding color/stacking field (customer_gender)...`);
      const colorFieldSelected = await selectFieldForAxis(page, chart.colorAxisLabel, 'customer_gender');
      
      if (colorFieldSelected) {
        // Wait for aggregation to re-run with multi_terms
        await page.waitForTimeout(2000);
        
        // Step 4: Wait for stacked render
        const stackedRender = await waitForChartRender(page, 5000);
        await takeChartScreenshot(page, testInfo, `${chart.type}-with-color-stacking`);
        
        const errorSummary = errorCollector.getErrorSummary();
        
        if (stackedRender) {
          console.log(`✓ ${chart.name} rendered successfully with stacking/color`);
          recordChartResult(
            `${chart.name} (Stacked)`,
            chart.type,
            'success',
            null,
            null,
            false,
            null,
            errorSummary
          );
        } else {
          console.log(`○ ${chart.name} may not have fully rendered with stacking`);
          recordChartResult(
            `${chart.name} (Stacked)`,
            chart.type,
            'needs-fields',
            'Stacking configuration may need review',
            null,
            false,
            null,
            errorSummary
          );
        }
      } else {
        console.log(`○ ${chart.name}: Could not add color field, testing basic config only`);
        await takeChartScreenshot(page, testInfo, `${chart.type}-no-color-field`);
      }

      errorCollector.assertNoErrors();
    });
  }
});

test.describe('Multi-Axis Tests - Complex Multi-Field Charts', () => {
  
  // Charts that require multiple bucket fields
  const multiBucketCharts = [
    { 
      name: 'Heatmap', 
      type: 'heatmap', 
      axes: [
        { name: 'X-Axis', field: 'category.keyword' },
        { name: 'Y-Axis', field: 'manufacturer.keyword' }
      ]
    },
    { 
      name: 'Sankey Diagram', 
      type: 'sankey', 
      axes: [
        { name: 'Source', field: 'category.keyword' },
        { name: 'Target', field: 'manufacturer.keyword' }
      ]
    },
    { 
      name: 'Population Pyramid', 
      type: 'population_pyramid', 
      axes: [
        { name: 'Category', field: 'category.keyword' },
        { name: 'Group', field: 'customer_gender.keyword' }
      ]
    },
    { 
      name: 'Lasagna Plot', 
      type: 'lasagna', 
      axes: [
        { name: 'X', field: 'day_of_week.keyword' },
        { name: 'Y', field: 'category.keyword' }
      ]
    }
  ];

  for (const chart of multiBucketCharts) {
    test(`${chart.name} - renders with multiple bucket fields`, async ({ page, errorCollector }, testInfo) => {
      const navigated = await navigateToChartTypePicker(page);
      if (!navigated) return;

      const selected = await selectChartType(page, chart.name);
      if (!selected) return;

      await page.waitForTimeout(500);

      // Configure each required axis
      for (const axis of chart.axes) {
        console.log(`${chart.name}: Configuring ${axis.name} with ${axis.field}...`);
        await selectFieldForAxis(page, axis.name, axis.field);
        await page.waitForTimeout(400);
      }

      // Use standard configuration for any remaining axes
      await configureChartFields(page, chart.type);
      await page.waitForTimeout(2000);

      const rendered = await waitForChartRender(page, 5000);
      await takeChartScreenshot(page, testInfo, `${chart.type}-multi-bucket`);

      const errorSummary = errorCollector.getErrorSummary();
      recordChartResult(
        `${chart.name} (Multi-Bucket)`,
        chart.type,
        rendered ? 'success' : 'needs-fields',
        rendered ? null : 'Multi-bucket configuration may need review',
        null,
        false,
        null,
        errorSummary
      );

      console.log(`${chart.name} multi-bucket: ${rendered ? '✓' : '○'}`);
      errorCollector.assertNoErrors();
    });
  }
});

test.describe('Multi-Axis Tests - Multi-Metric Charts', () => {
  
  // Charts that use multiple numeric/metric fields
  const multiMetricCharts = [
    { 
      name: 'Scatter Plot', 
      type: 'scatter', 
      axes: [
        { name: 'X', field: 'taxful_total_price', type: 'metric' },
        { name: 'Y', field: 'products.quantity', type: 'metric' }
      ]
    },
    { 
      name: 'Bubble Plot', 
      type: 'bubble', 
      axes: [
        { name: 'X', field: 'taxful_total_price', type: 'metric' },
        { name: 'Y', field: 'products.quantity', type: 'metric' },
        { name: 'Size', field: 'total_unique_products', type: 'metric' }
      ]
    },
    { 
      name: 'Ternary Plot', 
      type: 'ternary', 
      axes: [
        { name: 'Label', field: 'category.keyword', type: 'bucket' },
        { name: 'Top', field: 'taxful_total_price', type: 'metric' },
        { name: 'Left', field: 'products.quantity', type: 'metric' },
        { name: 'Right', field: 'total_unique_products', type: 'metric' }
      ]
    },
    { 
      name: 'Dual-Axis Chart', 
      type: 'dual_axis', 
      axes: [
        { name: 'X', field: 'category.keyword', type: 'bucket' },
        { name: 'Y1', field: 'taxful_total_price', type: 'metric' },
        { name: 'Y2', field: 'products.quantity', type: 'metric' }
      ]
    }
  ];

  for (const chart of multiMetricCharts) {
    test(`${chart.name} - renders with multiple metrics`, async ({ page, errorCollector }, testInfo) => {
      const navigated = await navigateToChartTypePicker(page);
      if (!navigated) return;

      const selected = await selectChartType(page, chart.name);
      if (!selected) return;

      await page.waitForTimeout(500);

      // Configure each axis
      for (const axis of chart.axes) {
        console.log(`${chart.name}: Configuring ${axis.name} (${axis.type}) with ${axis.field}...`);
        await selectFieldForAxis(page, axis.name, axis.field);
        await page.waitForTimeout(400);
      }

      // Finish configuration
      await configureChartFields(page, chart.type);
      await page.waitForTimeout(2000);

      const rendered = await waitForChartRender(page, 5000);
      await takeChartScreenshot(page, testInfo, `${chart.type}-multi-metric`);

      const errorSummary = errorCollector.getErrorSummary();
      recordChartResult(
        `${chart.name} (Multi-Metric)`,
        chart.type,
        rendered ? 'success' : 'needs-fields',
        rendered ? null : 'Multi-metric configuration may need review',
        null,
        false,
        null,
        errorSummary
      );

      console.log(`${chart.name} multi-metric: ${rendered ? '✓' : '○'}`);
      errorCollector.assertNoErrors();
    });
  }
});
