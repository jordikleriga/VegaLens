/**
 * Chart Test Helpers
 * Utilities for testing multi-level bucket support across all chart types
 */

/**
 * Sample multi-level aggregated data for testing
 * Simulates what the backend returns when multi-level buckets are configured
 */
export const MULTI_LEVEL_TEST_DATA = {
  // 2-level: Category + Gender
  twoLevel: [
    { category_keyword: "Men's Clothing", customer_gender: "MALE", _count: 2024, _composite_key: "Men's Clothing - MALE" },
    { category_keyword: "Men's Clothing", customer_gender: "FEMALE", _count: 1543, _composite_key: "Men's Clothing - FEMALE" },
    { category_keyword: "Women's Clothing", customer_gender: "MALE", _count: 1232, _composite_key: "Women's Clothing - MALE" },
    { category_keyword: "Women's Clothing", customer_gender: "FEMALE", _count: 2156, _composite_key: "Women's Clothing - FEMALE" },
    { category_keyword: "Accessories", customer_gender: "MALE", _count: 876, _composite_key: "Accessories - MALE" },
    { category_keyword: "Accessories", customer_gender: "FEMALE", _count: 943, _composite_key: "Accessories - FEMALE" }
  ],
  
  // 3-level: Category + Gender + Day
  threeLevel: [
    { category_keyword: "Men's Clothing", customer_gender: "MALE", day_of_week: "Monday", _count: 324, _composite_key: "Men's Clothing - MALE - Monday" },
    { category_keyword: "Men's Clothing", customer_gender: "MALE", day_of_week: "Tuesday", _count: 287, _composite_key: "Men's Clothing - MALE - Tuesday" },
    { category_keyword: "Men's Clothing", customer_gender: "FEMALE", day_of_week: "Monday", _count: 256, _composite_key: "Men's Clothing - FEMALE - Monday" },
    { category_keyword: "Men's Clothing", customer_gender: "FEMALE", day_of_week: "Tuesday", _count: 234, _composite_key: "Men's Clothing - FEMALE - Tuesday" },
    { category_keyword: "Women's Clothing", customer_gender: "MALE", day_of_week: "Monday", _count: 198, _composite_key: "Women's Clothing - MALE - Monday" },
    { category_keyword: "Women's Clothing", customer_gender: "MALE", day_of_week: "Tuesday", _count: 176, _composite_key: "Women's Clothing - MALE - Tuesday" },
    { category_keyword: "Women's Clothing", customer_gender: "FEMALE", day_of_week: "Monday", _count: 354, _composite_key: "Women's Clothing - FEMALE - Monday" },
    { category_keyword: "Women's Clothing", customer_gender: "FEMALE", day_of_week: "Tuesday", _count: 321, _composite_key: "Women's Clothing - FEMALE - Tuesday" }
  ],
  
  // Time series with sub-grouping
  timeSeries: [
    { order_date: "2024-01-01", category_keyword: "Electronics", _count: 150, _composite_key: "2024-01-01 - Electronics" },
    { order_date: "2024-01-01", category_keyword: "Clothing", _count: 200, _composite_key: "2024-01-01 - Clothing" },
    { order_date: "2024-01-02", category_keyword: "Electronics", _count: 175, _composite_key: "2024-01-02 - Electronics" },
    { order_date: "2024-01-02", category_keyword: "Clothing", _count: 225, _composite_key: "2024-01-02 - Clothing" },
    { order_date: "2024-01-03", category_keyword: "Electronics", _count: 160, _composite_key: "2024-01-03 - Electronics" },
    { order_date: "2024-01-03", category_keyword: "Clothing", _count: 190, _composite_key: "2024-01-03 - Clothing" }
  ],
  
  // For hierarchical charts (Treemap, Circle Packing)
  hierarchical: [
    { level1: "North America", level2: "USA", level3: "California", _count: 5000, _composite_key: "North America - USA - California" },
    { level1: "North America", level2: "USA", level3: "Texas", _count: 4200, _composite_key: "North America - USA - Texas" },
    { level1: "North America", level2: "Canada", level3: "Ontario", _count: 2100, _composite_key: "North America - Canada - Ontario" },
    { level1: "Europe", level2: "UK", level3: "London", _count: 3500, _composite_key: "Europe - UK - London" },
    { level1: "Europe", level2: "Germany", level3: "Berlin", _count: 2800, _composite_key: "Europe - Germany - Berlin" },
    { level1: "Asia", level2: "Japan", level3: "Tokyo", _count: 4100, _composite_key: "Asia - Japan - Tokyo" }
  ],

  // For distribution charts (numeric values)
  distribution: [
    { category_keyword: "Group A", customer_gender: "MALE", avg_price: 45.5, _count: 500, _composite_key: "Group A - MALE" },
    { category_keyword: "Group A", customer_gender: "FEMALE", avg_price: 52.3, _count: 480, _composite_key: "Group A - FEMALE" },
    { category_keyword: "Group B", customer_gender: "MALE", avg_price: 38.2, _count: 420, _composite_key: "Group B - MALE" },
    { category_keyword: "Group B", customer_gender: "FEMALE", avg_price: 41.8, _count: 390, _composite_key: "Group B - FEMALE" }
  ],
  
  // For flow charts (Sankey, Chord)
  flow: [
    { source: "Website", target: "Cart", intermediate: "Browse", _count: 1000, _composite_key: "Website - Browse - Cart" },
    { source: "Website", target: "Cart", intermediate: "Search", _count: 800, _composite_key: "Website - Search - Cart" },
    { source: "Cart", target: "Checkout", intermediate: "Review", _count: 600, _composite_key: "Cart - Review - Checkout" },
    { source: "Cart", target: "Checkout", intermediate: "Quick", _count: 400, _composite_key: "Cart - Quick - Checkout" }
  ]
};

/**
 * Chart types grouped by multi-level support strategy
 */
export const CHART_MULTI_LEVEL_STRATEGIES = {
  // Use _composite_key for primary axis, optional color for secondary
  composite: ['bar', 'radial', 'pareto', 'bullet', 'waterfall'],
  
  // Use color encoding for secondary bucket, facet for tertiary
  colorEncoded: ['line', 'area', 'scatter', 'bubble', 'streamgraph'],
  
  // Natural hierarchy support
  hierarchical: ['treemap', 'circle_packing', 'sunburst'],
  
  // Grouped side-by-side
  grouped: ['boxplot', 'violin', 'error_bars', 'histogram'],
  
  // Multi-hop / multi-stage
  multiStage: ['sankey', 'funnel', 'chord'],
  
  // Faceted small multiples
  faceted: ['trellis_area', 'lasagna', 'horizon', 'binned_heatmap'],
  
  // Concentric / nested
  concentric: ['pie', 'donut', 'gauge'],
  
  // Multi-encoding (color, shape, size)
  multiEncode: ['radar', 'ternary', 'comet'],
  
  // Grid layout
  gridLayout: ['metric', 'sparkline', 'table', 'heatmap']
};

/**
 * Expected multi-level mode options for each chart
 */
export const CHART_MULTI_LEVEL_MODES = {
  bar: ['composite', 'grouped', 'stacked', 'faceted'],
  line: ['series', 'faceted', 'layered'],
  area: ['stacked', 'overlapping', 'faceted'],
  pie: ['sunburst', 'exploded'],
  donut: ['concentric', 'sunburst'],
  treemap: ['nested'],
  scatter: ['color', 'shape', 'faceted'],
  bubble: ['color', 'shape', 'faceted'],
  heatmap: ['nested_axes', 'faceted'],
  boxplot: ['grouped', 'faceted'],
  histogram: ['stacked', 'overlapping', 'faceted'],
  funnel: ['split', 'faceted'],
  sankey: ['multi_hop'],
  radial: ['nested', 'composite'],
  pareto: ['stacked', 'composite'],
  radar: ['overlapping', 'faceted'],
  violin: ['split', 'grouped'],
  waterfall: ['grouped', 'composite']
};

/**
 * Verify chart spec contains expected multi-level handling
 * @param {Object} spec - Vega/Vega-Lite spec
 * @param {string} mode - Expected multi-level mode
 * @returns {Object} Validation result
 */
export function validateMultiLevelSpec(spec, mode) {
  const result = {
    valid: false,
    hasCompositeKey: false,
    hasColorEncoding: false,
    hasFacet: false,
    hasNestedData: false,
    details: []
  };
  
  if (!spec) {
    result.details.push('Spec is null or undefined');
    return result;
  }
  
  // Check for composite key usage
  const specStr = JSON.stringify(spec);
  result.hasCompositeKey = specStr.includes('_composite_key');
  
  // Check for color encoding
  if (spec.encoding?.color || spec.scales?.some(s => s.name === 'color')) {
    result.hasColorEncoding = true;
  }
  
  // Check for faceting
  if (spec.facet || spec.encoding?.facet || spec.encoding?.row || spec.encoding?.column) {
    result.hasFacet = true;
  }
  
  // Check for nested data transforms
  if (spec.data?.transform?.some(t => t.type === 'nest' || t.type === 'stratify')) {
    result.hasNestedData = true;
  }
  
  // Validate based on mode
  switch (mode) {
    case 'composite':
      result.valid = result.hasCompositeKey;
      break;
    case 'grouped':
    case 'series':
    case 'stacked':
    case 'overlapping':
      result.valid = result.hasColorEncoding;
      break;
    case 'faceted':
      result.valid = result.hasFacet;
      break;
    case 'nested':
    case 'sunburst':
    case 'concentric':
      result.valid = result.hasNestedData || result.hasCompositeKey;
      break;
    default:
      result.valid = true; // Default pass
  }
  
  return result;
}

/**
 * Create mock API response for testing
 * @param {string} dataType - Type of test data to return
 * @returns {Object} Mock API response
 */
export function createMockAggregationResponse(dataType = 'twoLevel') {
  const data = MULTI_LEVEL_TEST_DATA[dataType] || MULTI_LEVEL_TEST_DATA.twoLevel;
  return {
    success: true,
    data,
    meta: {
      bucketLevels: dataType === 'threeLevel' ? 3 : 2,
      hasCompositeKey: true,
      recordCount: data.length
    }
  };
}

/**
 * Wait for chart to render with multi-level data
 * @param {Page} page - Playwright page
 * @param {number} timeout - Max wait time in ms
 */
export async function waitForChartRender(page, timeout = 10000) {
  // Wait for Vega view to be present
  await page.waitForSelector('canvas, svg.vega', { timeout });
  
  // Wait for any loading indicators to disappear
  await page.waitForFunction(() => {
    const loading = document.querySelector('[data-loading="true"]');
    return !loading;
  }, { timeout });
  
  // Small delay for render completion
  await page.waitForTimeout(500);
}

/**
 * Get chart bucket fields from data
 * @param {Array} data - Chart data array
 * @returns {Array} List of bucket field names
 */
export function getBucketFields(data) {
  if (!data || data.length === 0) return [];
  
  const sample = data[0];
  return Object.keys(sample).filter(k => 
    !['_count', '_composite_key', '_split_count'].includes(k) && 
    typeof sample[k] === 'string'
  );
}

/**
 * Get metric fields from data
 * @param {Array} data - Chart data array
 * @returns {Array} List of metric field names
 */
export function getMetricFields(data) {
  if (!data || data.length === 0) return [];
  
  const sample = data[0];
  return Object.keys(sample).filter(k => 
    typeof sample[k] === 'number'
  );
}

export default {
  MULTI_LEVEL_TEST_DATA,
  CHART_MULTI_LEVEL_STRATEGIES,
  CHART_MULTI_LEVEL_MODES,
  validateMultiLevelSpec,
  createMockAggregationResponse,
  waitForChartRender,
  getBucketFields,
  getMetricFields
};

