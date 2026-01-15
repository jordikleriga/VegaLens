/**
 * Chart Types Test Suite
 * Tests all chart type generation endpoints to ensure proper configuration and output
 * 
 * Run with: npm test
 * Or: node tests/chartTypes.test.js
 */

import assert from 'assert';

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api';

// Sample test data
const SAMPLE_DATA = [
  { category: 'A', value: 100, date: '2024-01-01', count: 5, metric: 10.5 },
  { category: 'B', value: 200, date: '2024-01-02', count: 8, metric: 15.2 },
  { category: 'C', value: 150, date: '2024-01-03', count: 3, metric: 12.8 },
  { category: 'D', value: 300, date: '2024-01-04', count: 12, metric: 25.0 },
  { category: 'E', value: 250, date: '2024-01-05', count: 7, metric: 18.5 }
];

const AGGREGATED_DATA = [
  { key: 'New York', _count: 150, avg_salary: 75000 },
  { key: 'San Francisco', _count: 120, avg_salary: 95000 },
  { key: 'Austin', _count: 80, avg_salary: 65000 },
  { key: 'Seattle', _count: 100, avg_salary: 85000 },
  { key: 'Denver', _count: 60, avg_salary: 70000 }
];

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

// Helper function to make API requests
async function apiRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await response.json();
  
  return { status: response.status, data };
}

// Test runner
async function runTest(name, testFn) {
  try {
    await testFn();
    results.passed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    results.failed++;
    results.errors.push({ name, error: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

// ========================================
// VEGA SPEC GENERATOR TESTS
// ========================================

async function testBarChart() {
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'bar',
    config: {
      xField: 'category',
      yField: 'value',
      title: 'Test Bar Chart',
      colorConfig: { singleColor: '#0ea5e9', opacity: 0.8 }
    },
    data: SAMPLE_DATA
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  assert(data.marks, 'Missing marks array');
  assert(data.marks.some(m => m.type === 'rect'), 'Missing rect mark for bar chart');
}

async function testBarChartValidation() {
  // Test missing required field
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'bar',
    config: { xField: 'category' }, // Missing yField
    data: SAMPLE_DATA
  });
  
  assert.strictEqual(status, 400, `Expected 400 for missing field, got ${status}`);
  assert(data.message.includes('Missing'), 'Should indicate missing fields');
}

async function testLineChart() {
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'line',
    config: {
      xField: 'date',
      yField: 'value',
      title: 'Test Line Chart'
    },
    data: SAMPLE_DATA
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  assert(data.marks, 'Missing marks array');
}

async function testAreaChart() {
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'area',
    config: {
      xField: 'date',
      yField: 'value',
      title: 'Test Area Chart'
    },
    data: SAMPLE_DATA
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
}

async function testPieChart() {
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'pie',
    config: {
      categoryField: 'category',
      valueField: 'value',
      title: 'Test Pie Chart'
    },
    data: SAMPLE_DATA
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
}

async function testScatterChart() {
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'scatter',
    config: {
      xField: 'value',
      yField: 'metric',
      title: 'Test Scatter Chart'
    },
    data: SAMPLE_DATA
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
}

async function testHeatmapChart() {
  // Heatmap needs 2D data
  const heatmapData = [
    { x: 'Mon', y: 'Morning', value: 10 },
    { x: 'Mon', y: 'Afternoon', value: 25 },
    { x: 'Tue', y: 'Morning', value: 15 },
    { x: 'Tue', y: 'Afternoon', value: 30 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'heatmap',
    config: {
      xField: 'x',
      yField: 'y',
      valueField: 'value',
      title: 'Test Heatmap'
    },
    data: heatmapData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
}

async function testHistogramChart() {
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'histogram',
    config: {
      field: 'value',
      bins: 10,
      title: 'Test Histogram'
    },
    data: SAMPLE_DATA
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
}

async function testTreemapChart() {
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'treemap',
    config: {
      categoryField: 'category',
      valueField: 'value',
      title: 'Test Treemap'
    },
    data: SAMPLE_DATA
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
}

async function testGaugeChart() {
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'gauge',
    config: {
      valueField: 'value',
      minValue: 0,
      maxValue: 500,
      title: 'Test Gauge'
    },
    data: [{ value: 250 }]
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
}

async function testMetricChart() {
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'metric',
    config: {
      valueField: 'value',
      title: 'Test Metric'
    },
    data: [{ value: 1234 }]
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
}

// ========================================
// VEGA-LITE GENERATOR TESTS
// ========================================

async function testVegaLiteBarChart() {
  const { status, data } = await apiRequest('/vega/vegalite/chart/bar', 'POST', {
    data: SAMPLE_DATA,
    xField: 'category',
    yField: 'value',
    config: {
      colorConfig: { singleColor: '#22c55e', opacity: 0.9 }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema?.includes('vega-lite'), 'Should be Vega-Lite schema');
  assert.strictEqual(data.mark.type, 'bar', 'Should have bar mark');
  assert.strictEqual(data.mark.color, '#22c55e', 'Should apply color config');
}

async function testVegaLiteLineChart() {
  const { status, data } = await apiRequest('/vega/vegalite/chart/line', 'POST', {
    data: SAMPLE_DATA,
    xField: 'date',
    yField: 'value'
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema?.includes('vega-lite'), 'Should be Vega-Lite schema');
}

async function testVegaLiteAreaChart() {
  const { status, data } = await apiRequest('/vega/vegalite/chart/area', 'POST', {
    data: SAMPLE_DATA,
    xField: 'date',
    yField: 'value'
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
}

async function testVegaLitePieChart() {
  const { status, data } = await apiRequest('/vega/vegalite/chart/pie', 'POST', {
    data: SAMPLE_DATA,
    categoryField: 'category',
    valueField: 'value'
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
}

async function testVegaLiteScatterChart() {
  const { status, data } = await apiRequest('/vega/vegalite/chart/scatter', 'POST', {
    data: SAMPLE_DATA,
    xField: 'value',
    yField: 'metric'
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
}

async function testVegaLiteHeatmapChart() {
  const heatmapData = [
    { x: 'A', y: '1', value: 10 },
    { x: 'B', y: '1', value: 20 },
    { x: 'A', y: '2', value: 15 },
    { x: 'B', y: '2', value: 25 }
  ];
  
  const { status, data } = await apiRequest('/vega/vegalite/chart/heatmap', 'POST', {
    data: heatmapData,
    xField: 'x',
    yField: 'y',
    valueField: 'value'
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
}

async function testVegaLiteHistogramChart() {
  const { status, data } = await apiRequest('/vega/vegalite/chart/histogram', 'POST', {
    data: SAMPLE_DATA,
    field: 'value'
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
}

async function testVegaLiteBoxplotChart() {
  const { status, data } = await apiRequest('/vega/vegalite/chart/boxplot', 'POST', {
    data: SAMPLE_DATA,
    categoryField: 'category',
    valueField: 'value'
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
}

// ========================================
// VEGA-LITE FROM AGGREGATION TESTS
// ========================================

async function testFromAggregation() {
  const { status, data } = await apiRequest('/vega/vegalite/from-aggregation', 'POST', {
    data: AGGREGATED_DATA,
    bucketField: 'key',
    valueField: '_count',
    mark: 'bar',
    config: {
      colorConfig: { singleColor: '#8b5cf6', opacity: 0.85 }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema?.includes('vega-lite'), 'Should be Vega-Lite schema');
  assert.strictEqual(data.mark.color, '#8b5cf6', 'Should apply color config');
}

async function testFromAggregationWithMetric() {
  const { status, data } = await apiRequest('/vega/vegalite/from-aggregation', 'POST', {
    data: AGGREGATED_DATA,
    bucketField: 'key',
    valueField: 'avg_salary',
    mark: 'bar'
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
}

// ========================================
// VALIDATION TESTS
// ========================================

async function testMissingData() {
  const { status, data } = await apiRequest('/vega/vegalite/chart/bar', 'POST', {
    xField: 'category',
    yField: 'value'
    // Missing data
  });
  
  assert.strictEqual(status, 400, `Expected 400 for missing data, got ${status}`);
}

async function testInvalidChartType() {
  const { status, data } = await apiRequest('/vega/vegalite/chart/invalidtype', 'POST', {
    data: SAMPLE_DATA,
    xField: 'category',
    yField: 'value'
  });
  
  assert.strictEqual(status, 400, `Expected 400 for invalid chart type, got ${status}`);
}

async function testMissingRequiredFields() {
  const { status, data } = await apiRequest('/vega/vegalite/chart/bar', 'POST', {
    data: SAMPLE_DATA
    // Missing xField and yField
  });
  
  assert.strictEqual(status, 400, `Expected 400 for missing fields, got ${status}`);
  assert(data.message.includes('Missing'), 'Should indicate missing fields');
}

async function testFieldNotInData() {
  const { status, data } = await apiRequest('/vega/vegalite/chart/bar', 'POST', {
    data: SAMPLE_DATA,
    xField: 'nonexistent',
    yField: 'value'
  });
  
  assert.strictEqual(status, 400, `Expected 400 for field not in data, got ${status}`);
}

// ========================================
// TEMPORAL SORTING TESTS
// ========================================

// Test data with month names in wrong alphabetical order
const TEMPORAL_DATA_MONTHS = [
  { month: 'Apr', revenue: 61000 },
  { month: 'Feb', revenue: 52000 },
  { month: 'Jan', revenue: 45000 },
  { month: 'Jun', revenue: 67000 },
  { month: 'Mar', revenue: 48000 },
  { month: 'May', revenue: 55000 }
];

// Test data with ISO dates in wrong order
const TEMPORAL_DATA_ISO = [
  { date: '2024-03-01', value: 300 },
  { date: '2024-01-01', value: 100 },
  { date: '2024-05-01', value: 500 },
  { date: '2024-02-01', value: 200 },
  { date: '2024-04-01', value: 400 }
];

async function testTemporalSortingMonthNames() {
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'line',
    config: { xField: 'month', yField: 'revenue', title: 'Monthly Revenue' },
    data: TEMPORAL_DATA_MONTHS
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.data, 'Should have data array');
  
  // For Vega specs, check that the domain in xscale is properly sorted
  const xScale = data.scales.find(s => s.name === 'xscale');
  assert(xScale, 'Should have xscale');
  
  // Domain should be sorted chronologically: Jan, Feb, Mar, Apr, May, Jun
  if (Array.isArray(xScale.domain)) {
    assert.strictEqual(xScale.domain[0], 'Jan', 'First month should be Jan');
    assert.strictEqual(xScale.domain[5], 'Jun', 'Last month should be Jun');
  }
}

async function testTemporalSortingISODates() {
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'line',
    config: { xField: 'date', yField: 'value', title: 'Daily Values' },
    data: TEMPORAL_DATA_ISO
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.data, 'Should have data array');
  
  // Verify data is sorted by date
  const sourceData = data.data.find(d => d.name === 'source');
  assert(sourceData, 'Should have source data');
  
  // First data point should be the earliest date
  assert.strictEqual(sourceData.values[0].date, '2024-01-01', 'First date should be earliest');
  assert.strictEqual(sourceData.values[4].date, '2024-05-01', 'Last date should be latest');
}

async function testTemporalSortingBarChart() {
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'bar',
    config: { xField: 'month', yField: 'revenue', title: 'Monthly Revenue' },
    data: TEMPORAL_DATA_MONTHS
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // For bar charts, check that the domain is properly sorted
  const xScale = data.scales.find(s => s.name === 'xscale');
  assert(xScale, 'Should have xscale');
  
  if (Array.isArray(xScale.domain)) {
    assert.strictEqual(xScale.domain[0], 'Jan', 'First month should be Jan');
    assert.strictEqual(xScale.domain[5], 'Jun', 'Last month should be Jun');
  }
}

async function testTemporalSortingAreaChart() {
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'area',
    config: { xField: 'month', yField: 'revenue', title: 'Monthly Revenue' },
    data: TEMPORAL_DATA_MONTHS
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // For area charts, check that the domain is properly sorted
  const xScale = data.scales.find(s => s.name === 'xscale');
  assert(xScale, 'Should have xscale');
  
  if (Array.isArray(xScale.domain)) {
    assert.strictEqual(xScale.domain[0], 'Jan', 'First month should be Jan');
    assert.strictEqual(xScale.domain[5], 'Jun', 'Last month should be Jun');
  }
}

// ========================================
// COLOR CONFIG TESTS
// ========================================

async function testColorScheme() {
  const { status, data } = await apiRequest('/vega/vegalite/chart/bar', 'POST', {
    data: SAMPLE_DATA,
    xField: 'category',
    yField: 'value',
    colorField: 'category',
    config: {
      colorConfig: { scheme: 'set2' }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.encoding.color, 'Should have color encoding');
  assert(data.encoding.color.scale.scheme === 'set2', 'Should use set2 color scheme');
}

async function testCustomColors() {
  const customColors = ['#ff0000', '#00ff00', '#0000ff'];
  
  const { status, data } = await apiRequest('/vega/vegalite/chart/bar', 'POST', {
    data: SAMPLE_DATA,
    xField: 'category',
    yField: 'value',
    colorField: 'category',
    config: {
      colorConfig: { customColors }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.encoding.color.scale.range, 'Should have custom color range');
}

async function testOpacity() {
  const { status, data } = await apiRequest('/vega/vegalite/chart/bar', 'POST', {
    data: SAMPLE_DATA,
    xField: 'category',
    yField: 'value',
    config: {
      colorConfig: { opacity: 0.5 }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert.strictEqual(data.mark.opacity, 0.5, 'Should apply opacity');
}

// ========================================
// ADDITIONAL CHART TYPE TESTS
// ========================================

async function testDonutChart() {
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'donut',
    config: {
      categoryField: 'category',
      valueField: 'value',
      innerRadius: 50,
      title: 'Test Donut Chart'
    },
    data: SAMPLE_DATA
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
}

async function testWordcloudChart() {
  const wordData = [
    { word: 'analytics', count: 85 },
    { word: 'dashboard', count: 72 },
    { word: 'visualization', count: 68 },
    { word: 'data', count: 92 },
    { word: 'charts', count: 48 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'wordcloud',
    config: {
      textField: 'word',
      sizeField: 'count',
      title: 'Test Word Cloud'
    },
    data: wordData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
}

async function testSankeyChart() {
  const sankeyData = [
    { source: 'A', target: 'X', value: 100 },
    { source: 'A', target: 'Y', value: 50 },
    { source: 'B', target: 'X', value: 75 },
    { source: 'B', target: 'Z', value: 80 },
    { source: 'C', target: 'Y', value: 60 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'sankey',
    config: {
      sourceField: 'source',
      targetField: 'target',
      valueField: 'value',
      title: 'Test Sankey'
    },
    data: sankeyData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
}

async function testRadialChart() {
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'radial',
    config: {
      categoryField: 'category',
      valueField: 'value',
      title: 'Test Radial Bar'
    },
    data: SAMPLE_DATA
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
}

async function testWaterfallChart() {
  const waterfallData = [
    { label: 'Revenue', amount: 500000 },
    { label: 'Cost', amount: -180000 },
    { label: 'Operating', amount: -120000 },
    { label: 'Marketing', amount: -45000 },
    { label: 'Tax', amount: -35000 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'waterfall',
    config: {
      labelField: 'label',
      valueField: 'amount',
      title: 'Test Waterfall'
    },
    data: waterfallData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
}

async function testRollingAverageChart() {
  const timeData = [
    { date: '2024-01-01', temp: 12 },
    { date: '2024-01-02', temp: 15 },
    { date: '2024-01-03', temp: 10 },
    { date: '2024-01-04', temp: 18 },
    { date: '2024-01-05', temp: 14 },
    { date: '2024-01-06', temp: 11 },
    { date: '2024-01-07', temp: 16 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'rolling_average',
    config: {
      xField: 'date',
      yField: 'temp',
      windowSize: 3,
      title: 'Test Rolling Average'
    },
    data: timeData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
}

async function testTernaryChart() {
  const ternaryData = [
    { city: 'A', high: 45, medium: 35, low: 20 },
    { city: 'B', high: 30, medium: 45, low: 25 },
    { city: 'C', high: 15, medium: 35, low: 50 },
    { city: 'D', high: 35, medium: 40, low: 25 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'ternary',
    config: {
      labelField: 'city',
      topField: 'high',
      leftField: 'medium',
      rightField: 'low',
      title: 'Test Ternary'
    },
    data: ternaryData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
}

async function testCometChart() {
  const cometData = [
    { product: 'A', year: '2023', sales: 45000 },
    { product: 'A', year: '2024', sales: 62000 },
    { product: 'B', year: '2023', sales: 78000 },
    { product: 'B', year: '2024', sales: 71000 },
    { product: 'C', year: '2023', sales: 23000 },
    { product: 'C', year: '2024', sales: 35000 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'comet',
    config: {
      categoryField: 'product',
      timeField: 'year',
      valueField: 'sales',
      title: 'Test Comet'
    },
    data: cometData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
}

async function testHeatlaneChart() {
  const heatlaneData = [
    { score: 45 }, { score: 52 }, { score: 58 }, { score: 62 },
    { score: 68 }, { score: 72 }, { score: 75 }, { score: 78 },
    { score: 82 }, { score: 85 }, { score: 88 }, { score: 91 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'heatlane',
    config: {
      valueField: 'score',
      binCount: 8,
      title: 'Test Heat Lane'
    },
    data: heatlaneData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema || data.data, 'Missing schema or data');
}

async function testBinnedHeatmapChart() {
  // Sample data with two quantitative variables
  const binnedHeatmapData = [];
  for (let i = 0; i < 100; i++) {
    binnedHeatmapData.push({
      rating1: Math.random() * 10,
      rating2: Math.random() * 100
    });
  }
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'binned_heatmap',
    config: {
      xField: 'rating1',
      yField: 'rating2',
      xBins: 20,
      yBins: 20,
      colorScheme: 'viridis',
      aggregate: 'count',
      title: 'Test 2D Histogram Heatmap'
    },
    data: binnedHeatmapData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  assert(data.encoding, 'Missing encoding');
  assert(data.encoding.x.bin, 'X encoding should have bin');
  assert(data.encoding.y.bin, 'Y encoding should have bin');
  assert(data.encoding.color, 'Should have color encoding');
}

async function testBubbleChart() {
  // Gapminder-style data
  const bubbleData = [
    { country: 'USA', income: 55000, health: 78, population: 320000000 },
    { country: 'China', income: 12000, health: 75, population: 1400000000 },
    { country: 'India', income: 6000, health: 68, population: 1300000000 },
    { country: 'Japan', income: 40000, health: 84, population: 126000000 },
    { country: 'Germany', income: 48000, health: 81, population: 83000000 },
    { country: 'Brazil', income: 15000, health: 75, population: 210000000 },
    { country: 'UK', income: 42000, health: 81, population: 67000000 },
    { country: 'France', income: 43000, health: 82, population: 67000000 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'bubble',
    config: {
      xField: 'income',
      yField: 'health',
      sizeField: 'population',
      colorField: 'country',
      xScaleType: 'log',
      yZero: false,
      enableZoom: true,
      title: 'Health vs Income by Country'
    },
    data: bubbleData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  assert(data.encoding, 'Missing encoding');
  assert(data.encoding.size, 'Should have size encoding');
  assert(data.encoding.x.scale.type === 'log', 'X scale should be logarithmic');
  assert(data.mark === 'circle', 'Mark should be circle');
}

async function testPopulationPyramidChart() {
  const pyramidData = [
    { age: '0-9', population: 1000, gender: 'Male' },
    { age: '0-9', population: 950, gender: 'Female' },
    { age: '10-19', population: 1200, gender: 'Male' },
    { age: '10-19', population: 1100, gender: 'Female' },
    { age: '20-29', population: 1500, gender: 'Male' },
    { age: '20-29', population: 1400, gender: 'Female' },
    { age: '30-39', population: 1300, gender: 'Male' },
    { age: '30-39', population: 1350, gender: 'Female' }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'population_pyramid',
    config: {
      categoryField: 'age',
      valueField: 'population',
      groupField: 'gender',
      leftGroup: 'Male',
      rightGroup: 'Female',
      title: 'Test Population Pyramid'
    },
    data: pyramidData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  
  // Check that data has been pre-processed with signed_value field
  // Left group (Male) should have negative values, right group (Female) positive
  assert(data.data?.values, 'Missing data.values');
  const maleRecord = data.data.values.find(d => d.gender === 'Male');
  const femaleRecord = data.data.values.find(d => d.gender === 'Female');
  assert(maleRecord?.signed_value < 0, 'Male (left group) should have negative signed_value');
  assert(femaleRecord?.signed_value > 0, 'Female (right group) should have positive signed_value');
}

async function testLasagnaChart() {
  const lasagnaData = [
    { date: '2024-01-15', symbol: 'AAPL', price: 180 },
    { date: '2024-02-15', symbol: 'AAPL', price: 185 },
    { date: '2024-03-15', symbol: 'AAPL', price: 175 },
    { date: '2024-01-15', symbol: 'MSFT', price: 380 },
    { date: '2024-02-15', symbol: 'MSFT', price: 395 },
    { date: '2024-03-15', symbol: 'MSFT', price: 410 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'lasagna',
    config: {
      xField: 'date',
      yField: 'symbol',
      valueField: 'price',
      colorScheme: 'blues',
      title: 'Test Lasagna Plot'
    },
    data: lasagnaData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  assert.strictEqual(data.mark, 'rect', 'Should use rect mark');
}

async function testDualAxisChart() {
  const dualData = [
    { month: '2024-01', temp: 15, precip: 45 },
    { month: '2024-02', temp: 18, precip: 52 },
    { month: '2024-03', temp: 22, precip: 38 },
    { month: '2024-04', temp: 26, precip: 25 },
    { month: '2024-05', temp: 28, precip: 15 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'dual_axis',
    config: {
      xField: 'month',
      yField1: 'temp',
      yField2: 'precip',
      y1Label: 'Temperature',
      y2Label: 'Precipitation',
      title: 'Test Dual Axis'
    },
    data: dualData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  assert(data.layer, 'Missing layers');
  assert(data.layer.length === 2, 'Should have 2 layers');
  assert(data.resolve?.scale?.y === 'independent', 'Y scales should be independent');
}

async function testTrellisAreaChart() {
  const trellisData = [
    { date: '2024-01', price: 100, symbol: 'AAPL' },
    { date: '2024-02', price: 120, symbol: 'AAPL' },
    { date: '2024-03', price: 110, symbol: 'AAPL' },
    { date: '2024-01', price: 200, symbol: 'MSFT' },
    { date: '2024-02', price: 220, symbol: 'MSFT' },
    { date: '2024-03', price: 230, symbol: 'MSFT' },
    { date: '2024-01', price: 150, symbol: 'GOOG' },
    { date: '2024-02', price: 155, symbol: 'GOOG' },
    { date: '2024-03', price: 160, symbol: 'GOOG' }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'trellis_area',
    config: {
      xField: 'date',
      yField: 'price',
      facetField: 'symbol',
      title: 'Test Trellis Area'
    },
    data: trellisData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  assert(data.encoding.row, 'Should have row faceting');
  // Mark can be string 'area' or object { type: 'area', ... }
  const markType = typeof data.mark === 'string' ? data.mark : data.mark?.type;
  assert.strictEqual(markType, 'area', 'Should use area mark');
}

async function testBulletChart() {
  const bulletData = [
    { title: 'Revenue', subtitle: 'US$, in thousands', ranges: [150, 225, 300], measures: [220, 270], markers: [250] },
    { title: 'Profit', subtitle: '%', ranges: [20, 25, 30], measures: [21, 23], markers: [26] },
    { title: 'Satisfaction', subtitle: 'out of 5', ranges: [3.5, 4.25, 5], measures: [3.2, 4.7], markers: [4.4] }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'bullet',
    config: {
      titleField: 'title',
      measuresField: 'measures',
      rangesField: 'ranges',
      markersField: 'markers',
      title: 'Test Bullet Chart'
    },
    data: bulletData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  assert(data.facet, 'Should have faceting');
  assert(data.spec.layer, 'Should have layers in spec');
}

async function testFunnelChart() {
  const funnelData = [
    { stage: 'Visitors', value: 10000 },
    { stage: 'Leads', value: 6000 },
    { stage: 'Opportunities', value: 3000 },
    { stage: 'Proposals', value: 1500 },
    { stage: 'Closed', value: 800 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'funnel',
    config: {
      stageField: 'stage',
      valueField: 'value',
      showLabels: true,
      showPercentage: true,
      orientation: 'vertical',
      title: 'Test Funnel Chart'
    },
    data: funnelData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  // Funnel now uses full Vega with path marks for trapezoidal shapes
  assert(data.$schema.includes('vega/v5'), 'Should use full Vega schema');
  assert(data.marks, 'Should have marks array');
  assert(data.marks.some(m => m.type === 'path'), 'Should have path marks for trapezoid funnel shape');
}

async function testSparklineChart() {
  const sparkData = [
    { date: '2024-01-01', value: 100, series: 'A' },
    { date: '2024-01-02', value: 120, series: 'A' },
    { date: '2024-01-03', value: 115, series: 'A' },
    { date: '2024-01-04', value: 130, series: 'A' },
    { date: '2024-01-05', value: 125, series: 'A' },
    { date: '2024-01-01', value: 80, series: 'B' },
    { date: '2024-01-02', value: 90, series: 'B' },
    { date: '2024-01-03', value: 85, series: 'B' },
    { date: '2024-01-04', value: 95, series: 'B' },
    { date: '2024-01-05', value: 100, series: 'B' }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'sparkline',
    config: {
      xField: 'date',
      yField: 'value',
      colorField: 'series',
      showArea: false,
      showEndpoint: true,
      strokeWidth: 1.5,
      height: 30,
      title: 'Test Sparklines'
    },
    data: sparkData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  // Sparklines with colorField should have faceting
  assert(data.facet || data.layer, 'Should have faceting or layers');
}

async function testErrorBarsChart() {
  const errorBarsData = [
    { category: 'A', value: 100 },
    { category: 'A', value: 110 },
    { category: 'A', value: 105 },
    { category: 'A', value: 95 },
    { category: 'A', value: 108 },
    { category: 'B', value: 150 },
    { category: 'B', value: 155 },
    { category: 'B', value: 145 },
    { category: 'B', value: 160 },
    { category: 'B', value: 152 },
    { category: 'C', value: 200 },
    { category: 'C', value: 210 },
    { category: 'C', value: 190 },
    { category: 'C', value: 205 },
    { category: 'C', value: 195 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'error_bars',
    config: {
      categoryField: 'category',
      valueField: 'value',
      errorType: 'stdev',
      centerMark: 'mean',
      showPoints: true,
      orientation: 'vertical',
      title: 'Test Error Bars'
    },
    data: errorBarsData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  assert(data.layer, 'Should have layers');
  assert(data.layer.some(l => l.mark?.type === 'errorbar'), 'Should have errorbar mark');
  assert(data.layer.some(l => l.mark?.type === 'point'), 'Should have center point mark');
}

async function testHorizonChart() {
  const horizonData = [
    { date: '2024-01-01', value: 10, series: 'Temperature' },
    { date: '2024-01-02', value: 25, series: 'Temperature' },
    { date: '2024-01-03', value: -5, series: 'Temperature' },
    { date: '2024-01-04', value: 15, series: 'Temperature' },
    { date: '2024-01-05', value: -10, series: 'Temperature' },
    { date: '2024-01-06', value: 30, series: 'Temperature' },
    { date: '2024-01-07', value: 20, series: 'Temperature' }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'horizon',
    config: {
      xField: 'date',
      yField: 'value',
      colorField: 'series',
      bands: 3,
      positiveColor: '#4c78a8',
      negativeColor: '#e45756',
      bandHeight: 40,
      title: 'Test Horizon Chart'
    },
    data: horizonData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  // Horizon chart should have layers for bands or faceting for series
  assert(data.layer || data.facet, 'Should have layers or faceting');
  assert(data.transform, 'Should have transforms for band calculations');
}

async function testStreamgraphChart() {
  const streamData = [
    { date: '2024-01', value: 100, series: 'Product A' },
    { date: '2024-02', value: 120, series: 'Product A' },
    { date: '2024-03', value: 140, series: 'Product A' },
    { date: '2024-04', value: 130, series: 'Product A' },
    { date: '2024-01', value: 80, series: 'Product B' },
    { date: '2024-02', value: 90, series: 'Product B' },
    { date: '2024-03', value: 100, series: 'Product B' },
    { date: '2024-04', value: 110, series: 'Product B' },
    { date: '2024-01', value: 60, series: 'Product C' },
    { date: '2024-02', value: 70, series: 'Product C' },
    { date: '2024-03', value: 65, series: 'Product C' },
    { date: '2024-04', value: 75, series: 'Product C' }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'streamgraph',
    config: {
      xField: 'date',
      yField: 'value',
      colorField: 'series',
      interpolate: 'basis',
      offset: 'silhouette',
      title: 'Test Streamgraph'
    },
    data: streamData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  assert(data.mark?.type === 'area', 'Should use area mark');
  assert(data.encoding?.y?.stack, 'Should have stack encoding');
  assert(data.encoding?.color, 'Should have color encoding');
}

async function testDensityPlotChart() {
  // Generate sample data for density plot
  const densityData = [];
  for (let i = 0; i < 100; i++) {
    densityData.push({ 
      value: 50 + Math.random() * 30, 
      group: i < 50 ? 'Group A' : 'Group B' 
    });
  }
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'density',
    config: {
      valueField: 'value',
      groupField: 'group',
      bandwidth: 5,
      showRug: true,
      filled: true,
      title: 'Test Density Plot'
    },
    data: densityData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  assert(data.layer, 'Should have layers');
  // Check for density transform
  assert(data.layer.some(l => l.transform?.some(t => t.density)), 'Should have density transform');
}

async function testMarimekkoChart() {
  const marimekkoData = [
    { category: 'North', segment: 'Consumer', value: 5000 },
    { category: 'North', segment: 'Corporate', value: 3000 },
    { category: 'North', segment: 'Government', value: 2000 },
    { category: 'South', segment: 'Consumer', value: 4000 },
    { category: 'South', segment: 'Corporate', value: 4500 },
    { category: 'South', segment: 'Government', value: 1500 },
    { category: 'East', segment: 'Consumer', value: 6000 },
    { category: 'East', segment: 'Corporate', value: 2000 },
    { category: 'East', segment: 'Government', value: 3000 },
    { category: 'West', segment: 'Consumer', value: 3500 },
    { category: 'West', segment: 'Corporate', value: 3500 },
    { category: 'West', segment: 'Government', value: 3000 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'marimekko',
    config: {
      xField: 'category',
      yField: 'value',
      colorField: 'segment',
      showLabels: true,
      showLegend: true,
      title: 'Test Marimekko Chart'
    },
    data: marimekkoData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  assert(data.layer, 'Should have layers');
  assert(data.layer.some(l => l.mark?.type === 'rect'), 'Should have rect marks');
  // Check for variable width encoding
  assert(data.layer.some(l => l.encoding?.x2), 'Should have x2 encoding for variable width');
}

async function testCirclePackingChart() {
  const circlePackingData = [
    { category: 'Electronics', value: 5000, parent: 'Technology' },
    { category: 'Software', value: 3500, parent: 'Technology' },
    { category: 'Hardware', value: 2000, parent: 'Technology' },
    { category: 'Shirts', value: 3000, parent: 'Clothing' },
    { category: 'Pants', value: 2500, parent: 'Clothing' },
    { category: 'Accessories', value: 1500, parent: 'Clothing' },
    { category: 'Vegetables', value: 2000, parent: 'Food' },
    { category: 'Fruits', value: 1800, parent: 'Food' },
    { category: 'Dairy', value: 1200, parent: 'Food' }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'circle_packing',
    config: {
      categoryField: 'category',
      valueField: 'value',
      parentField: 'parent',
      showLabels: true,
      showLegend: true,
      title: 'Test Circle Packing'
    },
    data: circlePackingData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  // Circle packing uses full Vega with pack transform
  assert(data.$schema.includes('vega/v5'), 'Should use full Vega schema');
  assert(data.data, 'Should have data array');
  assert(data.marks, 'Should have marks array');
  assert(data.marks.some(m => m.type === 'symbol'), 'Should have symbol marks for circles');
}

async function testViolinChart() {
  const violinData = [
    { species: 'setosa', sepal_length: 5.1 },
    { species: 'setosa', sepal_length: 4.9 },
    { species: 'setosa', sepal_length: 4.7 },
    { species: 'setosa', sepal_length: 5.0 },
    { species: 'setosa', sepal_length: 5.4 },
    { species: 'versicolor', sepal_length: 7.0 },
    { species: 'versicolor', sepal_length: 6.4 },
    { species: 'versicolor', sepal_length: 6.9 },
    { species: 'versicolor', sepal_length: 5.5 },
    { species: 'versicolor', sepal_length: 6.5 },
    { species: 'virginica', sepal_length: 6.3 },
    { species: 'virginica', sepal_length: 5.8 },
    { species: 'virginica', sepal_length: 7.1 },
    { species: 'virginica', sepal_length: 6.3 },
    { species: 'virginica', sepal_length: 6.5 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'violin',
    config: {
      categoryField: 'species',
      valueField: 'sepal_length',
      showBoxplot: true,
      showMedian: true,
      title: 'Test Violin Plot'
    },
    data: violinData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  assert(data.$schema.includes('vega/v5'), 'Should use full Vega schema');
  assert(data.data, 'Should have data array');
  // Violin plots should have density and stats data sources
  const dataNames = data.data.map(d => d.name);
  assert(dataNames.includes('source'), 'Should have source data');
  assert(dataNames.includes('density'), 'Should have density data for KDE');
  assert(dataNames.includes('stats'), 'Should have stats data for boxplot overlay');
}

async function testChordChart() {
  const chordData = [
    { from: 'North America', to: 'Europe', value: 45 },
    { from: 'North America', to: 'Asia', value: 62 },
    { from: 'Europe', to: 'North America', value: 38 },
    { from: 'Europe', to: 'Asia', value: 55 },
    { from: 'Asia', to: 'North America', value: 78 },
    { from: 'Asia', to: 'Europe', value: 42 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'chord',
    config: {
      sourceField: 'from',
      targetField: 'to',
      valueField: 'value',
      showLabels: true,
      title: 'Test Chord Diagram'
    },
    data: chordData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  assert(data.$schema.includes('vega/v5'), 'Should use full Vega schema');
  assert(data.data, 'Should have data array');
  // Chord diagrams should have arcs and chords data
  const dataNames = data.data.map(d => d.name);
  assert(dataNames.includes('arcs'), 'Should have arcs data');
  assert(dataNames.includes('chords'), 'Should have chords data');
  assert(data.marks, 'Should have marks array');
  // Should have arc marks for outer ring
  assert(data.marks.some(m => m.type === 'arc'), 'Should have arc marks');
  // Should have path marks for chords
  assert(data.marks.some(m => m.type === 'path'), 'Should have path marks for chords');
}

async function testParetoChart() {
  const paretoData = [
    { defect_type: 'Scratches', count: 45 },
    { defect_type: 'Dents', count: 32 },
    { defect_type: 'Cracks', count: 28 },
    { defect_type: 'Misalignment', count: 18 },
    { defect_type: 'Color Mismatch', count: 12 },
    { defect_type: 'Missing Parts', count: 8 },
    { defect_type: 'Other', count: 5 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'pareto',
    config: {
      categoryField: 'defect_type',
      valueField: 'count',
      show80Line: true,
      showLine: true,
      showPoints: true,
      title: 'Test Pareto Chart'
    },
    data: paretoData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
  assert(data.$schema.includes('vega/v5'), 'Should use full Vega schema');
  assert(data.data, 'Should have data array');
  // Pareto should have source data with cumulative calculations
  const sourceData = data.data.find(d => d.name === 'source');
  assert(sourceData, 'Should have source data');
  assert(sourceData.values[0]._cumulativePercent !== undefined, 'Should have cumulative percent calculated');
  // Should have dual y-axis scales
  const scaleNames = data.scales.map(s => s.name);
  assert(scaleNames.includes('yscale'), 'Should have yscale for values');
  assert(scaleNames.includes('percentScale'), 'Should have percentScale for cumulative %');
  assert(data.marks, 'Should have marks array');
  // Should have bar marks for values
  assert(data.marks.some(m => m.type === 'rect'), 'Should have rect marks for bars');
  // Should have line mark for cumulative
  assert(data.marks.some(m => m.type === 'line'), 'Should have line mark for cumulative');
}

async function testBoxplotVegaChart() {
  const boxplotData = [
    { dept: 'A', salary: 50000 },
    { dept: 'A', salary: 55000 },
    { dept: 'A', salary: 60000 },
    { dept: 'A', salary: 52000 },
    { dept: 'A', salary: 58000 },
    { dept: 'B', salary: 45000 },
    { dept: 'B', salary: 48000 },
    { dept: 'B', salary: 52000 },
    { dept: 'B', salary: 47000 },
    { dept: 'B', salary: 50000 }
  ];
  
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'boxplot',
    config: {
      categoryField: 'dept',
      valueField: 'salary',
      title: 'Test Boxplot'
    },
    data: boxplotData
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Missing $schema');
}

// ========================================
// KIBANA SPEC TESTS
// ========================================

async function testKibanaSpecGeneration() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'bar',
    config: {
      xField: 'location',
      yField: 'avg_salary',
      title: 'Test Kibana Spec'
    },
    elasticConfig: {
      index: 'test_index',
      timeField: '@timestamp',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'location', options: { size: 10 } },
        metrics: [{ type: 'avg', field: 'salary' }]
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // Check spec structure - same format as preview but with url data source
  assert(data.$schema, 'Should have $schema');
  assert(data.$schema.includes('vega-lite/v5'), 'Should use Vega-Lite v5 schema');
  assert(data.data, 'Should have data configuration');
  assert(data.data.url, 'Should have data.url for Elasticsearch query');
  // Note: %context% is only added for time-based aggregations (date_histogram)
  // For terms aggregations, context is not applied to avoid filtering out data
  assert(data.data.url.index === 'test_index', 'Should have correct index');
  assert(data.data.url.body, 'Should have query body');
  assert(data.data.url.body.aggs, 'Should have aggregations in body');
  assert(data.data.url.body.aggs.primary, 'Should have primary aggregation');
  assert(data.data.format, 'Should have format property');
  assert(data.data.format.property === 'aggregations.primary.buckets', 'Format property should match aggregation path');
  assert(data.mark, 'Should have mark');
  assert(data.encoding, 'Should have encoding');
}

async function testKibanaPieChartEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'pie',
    config: {
      categoryField: 'category',
      valueField: 'count',
      showLegend: true,
      title: 'Test Kibana Pie'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category', options: { size: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // Pie charts should use theta encoding, not x/y
  assert(data.mark.type === 'arc', 'Pie chart should use arc mark');
  assert(data.encoding.theta, 'Pie chart should have theta encoding');
  assert(data.encoding.color, 'Pie chart should have color encoding');
  assert(!data.encoding.x, 'Pie chart should NOT have x encoding');
  assert(!data.encoding.y, 'Pie chart should NOT have y encoding');
}

async function testKibanaRadialChartEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'radial',
    config: {
      categoryField: 'category',
      valueField: 'value',
      showLegend: true,
      title: 'Test Kibana Radial'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category', options: { size: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // Radial charts should use theta and radius encoding
  assert(data.mark.type === 'arc', 'Radial chart should use arc mark');
  assert(data.encoding.theta, 'Radial chart should have theta encoding');
  assert(data.encoding.radius, 'Radial chart should have radius encoding');
  assert(data.encoding.color, 'Radial chart should have color encoding');
}

async function testKibanaHeatmapEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'heatmap',
    config: {
      xField: 'category_x',
      yField: 'category_y',
      valueField: 'value',
      colorScheme: 'viridis',
      title: 'Test Kibana Heatmap'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category_x', options: { size: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // Heatmaps should use rect mark with color encoding
  assert(data.mark.type === 'rect', 'Heatmap should use rect mark');
  assert(data.encoding.x, 'Heatmap should have x encoding');
  assert(data.encoding.y, 'Heatmap should have y encoding');
  assert(data.encoding.color, 'Heatmap should have color encoding');
  assert(data.encoding.color.type === 'quantitative', 'Heatmap color should be quantitative');
}

async function testKibanaScatterEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'scatter',
    config: {
      xField: 'x_val',
      yField: 'y_val',
      colorField: 'group',
      showLegend: true,
      title: 'Test Kibana Scatter'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'group', options: { size: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // Scatter should use circle mark with x, y, and optional color
  assert(data.mark.type === 'circle', 'Scatter chart should use circle mark');
  assert(data.encoding.x, 'Scatter should have x encoding');
  assert(data.encoding.y, 'Scatter should have y encoding');
  assert(data.encoding.x.type === 'quantitative', 'Scatter x should be quantitative');
  assert(data.encoding.y.type === 'quantitative', 'Scatter y should be quantitative');
}

async function testKibanaBubbleEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'bubble',
    config: {
      xField: 'income',
      yField: 'health',
      sizeField: 'population',
      colorField: 'region',
      showLegend: true,
      title: 'Test Kibana Bubble'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'region', options: { size: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // Bubble should have size encoding
  assert(data.mark.type === 'circle', 'Bubble chart should use circle mark');
  assert(data.encoding.x, 'Bubble should have x encoding');
  assert(data.encoding.y, 'Bubble should have y encoding');
  assert(data.encoding.size, 'Bubble should have size encoding');
  
  // Full encoding details (like working spec)
  assert(data.encoding.x.scale, 'X should have scale');
  assert(data.encoding.x.scale.type === 'linear', 'X scale should be linear');
  assert(data.encoding.y.scale, 'Y should have scale');
  assert(data.encoding.y.axis.minExtent, 'Y axis should have minExtent');
  assert(data.encoding.size.scale.range, 'Size should have scale range');
  assert(data.encoding.opacity, 'Should have opacity encoding');
  assert(data.encoding.tooltip, 'Should have tooltip encoding');
  assert(Array.isArray(data.encoding.tooltip), 'Tooltip should be array');
  assert(data.encoding.color, 'Should have color encoding');
  assert(data.encoding.color.scale, 'Color should have scale');
  
  // Config with styling
  assert(data.config, 'Should have config');
  assert(data.config.view, 'Config should have view');
  assert(data.config.axis, 'Config should have axis styling');
  assert(data.config.legend, 'Config should have legend styling');
  
  // Interactive params for bubble
  assert(data.params, 'Bubble should have params');
  assert(Array.isArray(data.params), 'Params should be array');
  assert(data.params[0].name === 'view', 'Should have view param');
  assert(data.params[0].select === 'interval', 'View should be interval selection');
  assert(data.params[0].bind === 'scales', 'View should bind to scales');
}

async function testKibanaDesignOptions() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'bar',
    config: {
      xField: 'category',
      yField: 'value',
      title: 'Test Design Options',
      colorScheme: 'tableau20',
      showLegend: false,
      strokeColor: '#333333',
      strokeWidth: 2,
      cornerRadius: 4,
      backgroundColor: '#f5f5f5',
      legendPosition: 'bottom'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category', options: { size: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // Check design options are applied
  assert(data.mark, 'Should have mark');
  assert(data.mark.tooltip === true, 'Mark should have tooltip');
  assert(data.config, 'Should have config');
  assert(data.config.legend, 'Should have legend config');
  assert(data.config.background === '#f5f5f5', 'Should have background color');
}

async function testKibanaLayeredChart() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'rolling_average',
    config: {
      xField: 'date',
      yField: 'value',
      windowSize: 7,
      lineColor: '#ff0000',
      title: 'Test Rolling Average'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'date', options: {} },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // Rolling average is a layered chart
  assert(data.layer, 'Rolling average should have layer');
  assert(Array.isArray(data.layer), 'Layer should be an array');
  assert(data.layer.length === 2, 'Rolling average should have 2 layers');
  assert(data.layer[0].mark.type === 'point', 'First layer should be points');
  assert(data.layer[1].mark.type === 'line', 'Second layer should be line');
}

async function testKibanaWaterfallEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'waterfall',
    config: {
      labelField: 'label',
      valueField: 'amount',
      positiveColor: '#00FF00',
      negativeColor: '#FF0000',
      title: 'Test Kibana Waterfall'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'label', options: { size: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // Waterfall should be a layered spec
  assert(data.layer, 'Waterfall should have layer property');
  assert(data.layer.length >= 3, 'Waterfall should have at least 3 layers (bars, labels)');
  
  // First layer should be the main bars
  const barLayer = data.layer[0];
  assert(barLayer.mark.type === 'bar', 'First layer should use bar mark');
  assert(barLayer.encoding.y, 'Bar layer should have y encoding');
  assert(barLayer.encoding.y2, 'Bar layer should have y2 encoding');
  
  // Waterfall should have transforms to calculate start, end, center, etc.
  assert(data.transform && data.transform.length > 0, 'Waterfall should have transforms');
  const transformFields = data.transform.map(t => t.as || (t.window && t.window[0]?.as)).filter(Boolean);
  assert(transformFields.includes('start'), 'Should have start field transform');
  assert(transformFields.includes('end'), 'Should have end field transform');
  assert(transformFields.includes('center'), 'Should have center field transform');
  assert(transformFields.includes('text_amount'), 'Should have text_amount field transform');
}

async function testKibanaDonutEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'donut',
    config: {
      categoryField: 'category',
      valueField: 'count',
      innerRadius: 60,
      showLegend: true,
      title: 'Test Kibana Donut'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category', options: { size: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // Donut should use arc mark with innerRadius and outerRadius
  assert(data.mark.type === 'arc', 'Donut should use arc mark');
  assert(data.mark.innerRadius > 0, 'Donut should have innerRadius');
  assert(data.mark.outerRadius > 0, 'Donut should have outerRadius');
  assert(data.encoding.theta, 'Donut should have theta encoding');
  assert(data.encoding.color, 'Donut should have color encoding');
}

async function testKibanaDonutWithLabels() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'donut',
    config: {
      categoryField: 'category',
      valueField: 'count',
      innerRadius: 60,
      showLabels: true,
      showLegend: true,
      title: 'Test Kibana Donut with Labels'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category', options: { size: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // Donut with labels should be a layered spec
  assert(data.layer, 'Donut with labels should have layer');
  assert(Array.isArray(data.layer), 'Layer should be an array');
  assert(data.layer.length === 2, 'Should have 2 layers (arc + text)');
  assert(data.layer[0].mark.type === 'arc', 'First layer should be arc');
  assert(data.layer[1].mark.type === 'text', 'Second layer should be text');
}

async function testKibanaLineEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'line',
    config: {
      xField: 'date',
      yField: 'value',
      showPoints: true,
      interpolate: 'monotone',
      strokeColor: '#2196F3',
      strokeWidth: 3,
      title: 'Test Kibana Line'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'date', options: {} },
        metrics: [{ type: 'avg', field: 'value' }]
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // Line chart specific checks
  assert(data.mark.type === 'line', 'Line chart should use line mark');
  assert(data.mark.point === true, 'Line should show points when configured');
  assert(data.mark.interpolate === 'monotone', 'Should have interpolation');
  assert(data.encoding.x, 'Line should have x encoding');
  assert(data.encoding.y, 'Line should have y encoding');
  // Time-based should add context
  assert(data.data.url['%context%'] === true, 'Time-based should have context');
  assert(data.data.url['%timefield%'], 'Time-based should have timefield');
}

async function testKibanaAreaEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'area',
    config: {
      xField: 'date',
      yField: 'value',
      showLine: true,
      interpolate: 'step',
      opacity: 0.5,
      title: 'Test Kibana Area'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'date', options: {} },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // Area chart specific checks
  assert(data.mark.type === 'area', 'Area chart should use area mark');
  assert(data.mark.line === true, 'Area should show line when configured');
  assert(data.mark.interpolate === 'step', 'Should have interpolation');
  assert(data.encoding.x, 'Area should have x encoding');
  assert(data.encoding.y, 'Area should have y encoding');
}

async function testKibanaBoxplotEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'boxplot',
    config: {
      categoryField: 'group',
      valueField: 'value',
      title: 'Test Kibana Boxplot'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'group', options: { size: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // Boxplot now uses full Vega spec (not Vega-Lite) with percentiles aggregation
  assert(data.$schema.includes('vega/v5'), 'Boxplot should use full Vega schema');
  assert(data.data, 'Boxplot should have data section');
  assert(data.scales, 'Boxplot should have scales');
  assert(data.marks, 'Boxplot should have marks');
  assert(data.marks.length >= 3, 'Boxplot should have whisker, box, and median marks');
  
  // Check that ES query uses percentiles aggregation
  const esQuery = data.data[0].url.body;
  assert(esQuery.aggs.categories, 'Should have categories aggregation');
  assert(esQuery.aggs.categories.aggs.stats.percentiles, 'Should use percentiles sub-aggregation');
}

async function testKibanaDualAxisEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'dual_axis',
    config: {
      xField: 'date',
      yField1: 'primary_value',
      yField2: 'secondary_value',
      y1Color: '#2196F3',
      y2Color: '#FF5722',
      title: 'Test Kibana Dual Axis'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'date', options: {} },
        metrics: [
          { type: 'avg', field: 'primary_value', alias: 'metric_0' },
          { type: 'avg', field: 'secondary_value', alias: 'metric_1' }
        ]
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // Dual axis is a layered chart with independent scales
  assert(data.layer, 'Dual axis should have layers');
  assert(data.layer.length === 2, 'Dual axis should have 2 layers');
  assert(data.resolve, 'Should have resolve');
  assert(data.resolve.scale, 'Should have scale resolve');
  assert(data.resolve.scale.y === 'independent', 'Y scales should be independent');
}

// ========================================
// MAIN TEST RUNNER
// ========================================

async function runAllTests() {
  console.log('\n🧪 Running Chart Types Test Suite\n');
  console.log('=' .repeat(50));
  
  // Vega Spec Generator Tests - Basic Charts
  console.log('\n📊 VEGA SPEC GENERATOR TESTS - BASIC\n');
  await runTest('Bar Chart Generation', testBarChart);
  await runTest('Bar Chart Validation', testBarChartValidation);
  await runTest('Line Chart Generation', testLineChart);
  await runTest('Area Chart Generation', testAreaChart);
  await runTest('Pie Chart Generation', testPieChart);
  await runTest('Donut Chart Generation', testDonutChart);
  await runTest('Scatter Chart Generation', testScatterChart);
  await runTest('Heatmap Chart Generation', testHeatmapChart);
  await runTest('Histogram Chart Generation', testHistogramChart);
  await runTest('Treemap Chart Generation', testTreemapChart);
  await runTest('Gauge Chart Generation', testGaugeChart);
  await runTest('Metric Chart Generation', testMetricChart);
  await runTest('Boxplot Chart Generation', testBoxplotVegaChart);
  
  // Vega Spec Generator Tests - Advanced Charts
  console.log('\n📊 VEGA SPEC GENERATOR TESTS - ADVANCED\n');
  await runTest('Word Cloud Chart Generation', testWordcloudChart);
  await runTest('Sankey Diagram Generation', testSankeyChart);
  await runTest('Radial Bar Chart Generation', testRadialChart);
  await runTest('Waterfall Chart Generation', testWaterfallChart);
  await runTest('Rolling Average Chart Generation', testRollingAverageChart);
  await runTest('Ternary Chart Generation', testTernaryChart);
  await runTest('Comet Chart Generation', testCometChart);
  await runTest('Heat Lane Chart Generation', testHeatlaneChart);
  await runTest('2D Histogram Heatmap Generation', testBinnedHeatmapChart);
  await runTest('Bubble Plot Generation', testBubbleChart);
  await runTest('Population Pyramid Generation', testPopulationPyramidChart);
  await runTest('Lasagna Plot Generation', testLasagnaChart);
  await runTest('Dual-Axis Chart Generation', testDualAxisChart);
  await runTest('Trellis Area Chart Generation', testTrellisAreaChart);
  await runTest('Bullet Chart Generation', testBulletChart);
  await runTest('Funnel Chart Generation', testFunnelChart);
  await runTest('Sparkline Chart Generation', testSparklineChart);
  await runTest('Error Bars Chart Generation', testErrorBarsChart);
  await runTest('Horizon Chart Generation', testHorizonChart);
  await runTest('Circle Packing Chart Generation', testCirclePackingChart);
  await runTest('Streamgraph Chart Generation', testStreamgraphChart);
  await runTest('Density Plot Chart Generation', testDensityPlotChart);
  await runTest('Marimekko Chart Generation', testMarimekkoChart);
  await runTest('Violin Plot Chart Generation', testViolinChart);
  await runTest('Chord Diagram Generation', testChordChart);
  await runTest('Pareto Chart Generation', testParetoChart);
  
  // Vega-Lite Generator Tests
  console.log('\n📈 VEGA-LITE GENERATOR TESTS\n');
  await runTest('Vega-Lite Bar Chart', testVegaLiteBarChart);
  await runTest('Vega-Lite Line Chart', testVegaLiteLineChart);
  await runTest('Vega-Lite Area Chart', testVegaLiteAreaChart);
  await runTest('Vega-Lite Pie Chart', testVegaLitePieChart);
  await runTest('Vega-Lite Scatter Chart', testVegaLiteScatterChart);
  await runTest('Vega-Lite Heatmap Chart', testVegaLiteHeatmapChart);
  await runTest('Vega-Lite Histogram Chart', testVegaLiteHistogramChart);
  await runTest('Vega-Lite Boxplot Chart', testVegaLiteBoxplotChart);
  
  // Aggregation Tests
  console.log('\n📉 AGGREGATION DATA TESTS\n');
  await runTest('From Aggregation (Count)', testFromAggregation);
  await runTest('From Aggregation (Metric)', testFromAggregationWithMetric);
  
  // Validation Tests
  console.log('\n🔍 VALIDATION TESTS\n');
  await runTest('Missing Data Validation', testMissingData);
  await runTest('Invalid Chart Type Validation', testInvalidChartType);
  await runTest('Missing Required Fields Validation', testMissingRequiredFields);
  await runTest('Field Not In Data Validation', testFieldNotInData);
  
  // Temporal Sorting Tests
  console.log('\n🕐 TEMPORAL SORTING TESTS\n');
  await runTest('Month Names Sorting (Line)', testTemporalSortingMonthNames);
  await runTest('ISO Dates Sorting (Line)', testTemporalSortingISODates);
  await runTest('Month Names Sorting (Bar)', testTemporalSortingBarChart);
  await runTest('Month Names Sorting (Area)', testTemporalSortingAreaChart);
  
  // Color Config Tests
  console.log('\n🎨 COLOR CONFIG TESTS\n');
  await runTest('Color Scheme Application', testColorScheme);
  await runTest('Custom Colors Application', testCustomColors);
  await runTest('Opacity Application', testOpacity);
  
  // Kibana Tests
  console.log('\n🔌 KIBANA SPEC TESTS\n');
  await runTest('Kibana Spec Generation', testKibanaSpecGeneration);
  await runTest('Kibana Pie Chart Encoding', testKibanaPieChartEncoding);
  await runTest('Kibana Radial Chart Encoding', testKibanaRadialChartEncoding);
  await runTest('Kibana Heatmap Encoding', testKibanaHeatmapEncoding);
  await runTest('Kibana Scatter Encoding', testKibanaScatterEncoding);
  await runTest('Kibana Bubble Encoding', testKibanaBubbleEncoding);
  await runTest('Kibana Design Options', testKibanaDesignOptions);
  await runTest('Kibana Layered Chart', testKibanaLayeredChart);
  await runTest('Kibana Waterfall Encoding', testKibanaWaterfallEncoding);
  await runTest('Kibana Donut Encoding', testKibanaDonutEncoding);
  await runTest('Kibana Donut with Labels', testKibanaDonutWithLabels);
  await runTest('Kibana Line Encoding', testKibanaLineEncoding);
  await runTest('Kibana Area Encoding', testKibanaAreaEncoding);
  await runTest('Kibana Boxplot Encoding', testKibanaBoxplotEncoding);
  await runTest('Kibana Dual Axis Encoding', testKibanaDualAxisEncoding);
  await runTest('Kibana Radial Full Encoding', testKibanaRadialEncoding);
  await runTest('Kibana Gauge Encoding', testKibanaGaugeEncoding);
  await runTest('Kibana Population Pyramid', testKibanaPopulationPyramidEncoding);
  await runTest('Kibana Comet Encoding', testKibanaCometEncoding);
  await runTest('Kibana Heatlane Encoding', testKibanaHeatlaneEncoding);
  await runTest('Kibana Trellis Area Encoding', testKibanaTrellisAreaEncoding);
  await runTest('Kibana Bullet Encoding', testKibanaBulletEncoding);
  await runTest('Kibana Sankey Encoding', testKibanaSankeyEncoding);
  await runTest('Kibana Funnel Encoding', testKibanaFunnelEncoding);
  await runTest('Kibana Sparkline Encoding', testKibanaSparklineEncoding);
  await runTest('Kibana Error Bars Encoding', testKibanaErrorBarsEncoding);
  await runTest('Kibana Horizon Encoding', testKibanaHorizonEncoding);
  await runTest('Kibana Circle Packing Encoding', testKibanaCirclePackingEncoding);
  await runTest('Kibana Streamgraph Encoding', testKibanaStreamgraphEncoding);
  await runTest('Kibana Density Encoding', testKibanaDensityEncoding);
  await runTest('Kibana Marimekko Encoding', testKibanaMarimekkoEncoding);
  await runTest('Kibana Violin Encoding', testKibanaViolinEncoding);
  await runTest('Kibana Chord Encoding', testKibanaChordEncoding);
  await runTest('Kibana Pareto Encoding', testKibanaParetoEncoding);
  await runTest('Kibana Field Name Consistency', testKibanaFieldNameConsistency);
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log(`\n📋 TEST RESULTS: ${results.passed} passed, ${results.failed} failed\n`);
  
  if (results.errors.length > 0) {
    console.log('❌ Failed Tests:\n');
    results.errors.forEach(({ name, error }) => {
      console.log(`  • ${name}: ${error}`);
    });
    console.log('');
  }
  
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});


async function testKibanaRadialEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'radial',
    config: {
      categoryField: 'category',
      valueField: 'value',
      innerRadius: 40,
      showLegend: true,
      title: 'Test Kibana Radial'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category', options: { size: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.mark.type === 'arc', 'Radial should use arc mark');
  assert(data.mark.outerRadius > 0, 'Radial should have outerRadius');
  assert(data.encoding.theta, 'Radial should have theta encoding');
  assert(data.encoding.radius, 'Radial should have radius encoding');
  assert(data.encoding.tooltip, 'Radial should have tooltip');
}

async function testKibanaGaugeEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'gauge',
    config: {
      valueField: 'value',
      maxValue: 100,
      innerRadius: 60,
      title: 'Test Kibana Gauge'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'status', options: { size: 2 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.mark.type === 'arc', 'Gauge should use arc mark');
  assert(data.mark.outerRadius > 0, 'Gauge should have outerRadius');
  assert(data.encoding.theta, 'Gauge should have theta encoding');
  assert(data.encoding.tooltip, 'Gauge should have tooltip');
}

async function testKibanaPopulationPyramidEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'population_pyramid',
    config: {
      categoryField: 'age_group',
      valueField: 'population',
      groupField: 'gender',
      leftColor: '#3498db',
      rightColor: '#e74c3c',
      title: 'Test Population Pyramid'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'age_group', options: { size: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.mark.type === 'bar', 'Population pyramid should use bar mark');
  assert(data.encoding.y, 'Should have y encoding');
  assert(data.encoding.x, 'Should have x encoding');
  assert(data.encoding.color, 'Should have color encoding');
  assert(data.encoding.tooltip, 'Should have tooltip');
}

async function testKibanaCometEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'comet',
    config: {
      categoryField: 'product',
      timeField: 'year',
      valueField: 'sales',
      title: 'Test Comet Chart'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'product', options: { size: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.mark.type === 'trail', 'Comet should use trail mark');
  assert(data.encoding.x, 'Should have x encoding');
  assert(data.encoding.y, 'Should have y encoding');
  assert(data.encoding.size, 'Should have size encoding');
  assert(data.encoding.tooltip, 'Should have tooltip');
}

async function testKibanaHeatlaneEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'heatlane',
    config: {
      xField: 'category',
      valueField: 'value',
      colorScheme: 'viridis',
      title: 'Test Heatlane'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category', options: { size: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.mark.type === 'bar', 'Heatlane should use bar mark');
  assert(data.encoding.x, 'Should have x encoding');
  assert(data.encoding.y, 'Should have y encoding');
  assert(data.encoding.color, 'Should have color encoding');
  assert(data.encoding.tooltip, 'Should have tooltip');
}

async function testKibanaTrellisAreaEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'trellis_area',
    config: {
      xField: 'date',
      yField: 'value',
      facetField: 'category',
      title: 'Test Trellis Area'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'date', options: {} },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  // Trellis area might have encoding at top level or in spec (for faceted charts)
  const encoding = data.encoding || (data.spec && data.spec.encoding);
  assert(encoding, 'Should have encoding');
  assert(data.mark?.type === 'area' || (data.spec && data.spec.mark?.type === 'area'), 'Should use area mark');
}

async function testKibanaBulletEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'bullet',
    config: {
      titleField: 'metric',
      measuresField: 'value',
      rangesField: 'range',
      title: 'Test Bullet Chart'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'metric', options: { size: 5 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.mark.type === 'bar', 'Bullet should use bar mark');
  assert(data.encoding.x, 'Should have x encoding');
  assert(data.encoding.y, 'Should have y encoding');
  assert(data.encoding.tooltip, 'Should have tooltip');
}

async function testKibanaSankeyEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'sankey',
    config: {
      sourceField: 'source',
      targetField: 'target',
      valueField: '_count',
      title: 'Test Sankey Diagram'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { 
          type: 'multi_terms', 
          field: 'source', 
          options: { fields: ['source', 'target'], size: 25 } 
        },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  // Sankey should return full Vega spec (not Vega-Lite)
  assert(data.$schema.includes('vega/v5'), 'Sankey should use full Vega schema, not Vega-Lite');
  assert(data.data && Array.isArray(data.data), 'Should have data array');
  assert(data.marks && Array.isArray(data.marks), 'Should have marks array');
  assert(data.scales && Array.isArray(data.scales), 'Should have scales array');
  // Check for node and link data sets
  const dataNames = data.data.map(d => d.name);
  assert(dataNames.includes('rawData') || dataNames.includes('nodes') || dataNames.includes('links'), 
    'Should have rawData, nodes, or links data');
}

async function testKibanaFunnelEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'funnel',
    config: {
      stageField: 'stage',
      valueField: 'value',
      showLabels: true,
      showPercentage: true,
      title: 'Test Kibana Funnel'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'stage', options: { size: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  // Funnel now uses full Vega with path marks for trapezoid shapes
  assert(data.$schema, 'Should have schema');
  assert(data.marks, 'Should have marks array');
}

async function testKibanaSparklineEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'sparkline',
    config: {
      xField: 'date',
      yField: 'value',
      showArea: false,
      showEndpoint: true,
      height: 30,
      title: 'Test Kibana Sparkline'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'date', options: { interval: 'day' } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Should have schema');
  assert(data.data, 'Should have data configuration');
}

async function testKibanaErrorBarsEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'error_bars',
    config: {
      categoryField: 'category',
      valueField: 'value',
      errorType: 'stdev',
      centerMark: 'mean',
      showPoints: false,
      title: 'Test Kibana Error Bars'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category', options: { size: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Should have schema');
  assert(data.data, 'Should have data configuration');
}

async function testKibanaHorizonEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'horizon',
    config: {
      xField: 'date',
      yField: 'value',
      bands: 3,
      positiveColor: '#4c78a8',
      negativeColor: '#e45756',
      title: 'Test Kibana Horizon'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'date', options: { interval: 'day' } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Should have schema');
  assert(data.data, 'Should have data configuration');
}

async function testKibanaStreamgraphEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'streamgraph',
    config: {
      xField: 'date',
      yField: 'value',
      colorField: 'series',
      interpolate: 'basis',
      offset: 'silhouette',
      title: 'Test Kibana Streamgraph'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'date', options: { interval: 'month' } },
        metrics: [],
        splitBy: { type: 'terms', field: 'series', options: { size: 10 } }
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  // Verify valid Vega-Lite spec is generated for Kibana
  assert(data.$schema, 'Should have schema');
  assert(data.data, 'Should have data configuration');
  assert(data.data.url, 'Should have Elasticsearch URL config');
  assert(data.encoding, 'Should have encoding');
}

async function testKibanaDensityEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'density',
    config: {
      valueField: 'value',
      bandwidth: 5,
      title: 'Test Kibana Density'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'histogram', field: 'value', options: { interval: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  // Verify valid Vega-Lite spec is generated for Kibana
  assert(data.$schema, 'Should have schema');
  assert(data.data, 'Should have data configuration');
  assert(data.data.url, 'Should have Elasticsearch URL config');
  assert(data.encoding, 'Should have encoding');
}

async function testKibanaMarimekkoEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'marimekko',
    config: {
      xField: 'category',
      yField: 'value',
      colorField: 'segment',
      showLabels: true,
      title: 'Test Kibana Marimekko'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category', options: { size: 10 } },
        metrics: [],
        splitBy: { type: 'terms', field: 'segment', options: { size: 10 } }
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  // Verify valid Vega-Lite spec is generated for Kibana
  assert(data.$schema, 'Should have schema');
  assert(data.data, 'Should have data configuration');
  assert(data.data.url, 'Should have Elasticsearch URL config');
  assert(data.encoding, 'Should have encoding');
}

async function testKibanaCirclePackingEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'circle_packing',
    config: {
      categoryField: 'category',
      valueField: 'value',
      showLabels: true,
      showLegend: true,
      title: 'Test Kibana Circle Packing'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category', options: { size: 20 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  // Circle packing uses full Vega with pack transform
  assert(data.$schema.includes('vega/v5'), 'Circle packing should use full Vega schema');
  assert(data.data && Array.isArray(data.data), 'Should have data array');
  assert(data.marks && Array.isArray(data.marks), 'Should have marks array');
  assert(data.marks.some(m => m.type === 'symbol'), 'Should have symbol marks for circles');
}

async function testKibanaViolinEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'violin',
    config: {
      categoryField: 'department',
      valueField: 'salary',
      showBoxplot: true,
      showMedian: true,
      title: 'Test Kibana Violin'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'department', options: { size: 10 } },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Should have schema');
  // Violin uses full Vega for Kibana with percentile aggregation
  assert(data.$schema.includes('vega/v5'), 'Should use full Vega schema');
  assert(data.data, 'Should have data configuration');
}

async function testKibanaChordEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'chord',
    config: {
      sourceField: 'source_region',
      targetField: 'target_region',
      valueField: 'trade_value',
      showLabels: true,
      title: 'Test Kibana Chord'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { 
          type: 'multi_terms', 
          field: 'source_region', 
          options: { fields: ['source_region', 'target_region'], size: 50 } 
        },
        metrics: []
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Should have schema');
  // Chord uses full Vega for Kibana
  assert(data.$schema.includes('vega/v5'), 'Should use full Vega schema');
  assert(data.data, 'Should have data configuration');
}

async function testKibanaParetoEncoding() {
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'pareto',
    config: {
      categoryField: 'defect_type',
      valueField: 'count',
      show80Line: true,
      showLine: true,
      title: 'Test Kibana Pareto'
    },
    elasticConfig: {
      index: 'test_index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'defect_type', options: { size: 20 } },
        metrics: [{ type: 'count' }]
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  assert(data.$schema, 'Should have schema');
  // Pareto returns Vega-Lite layered spec for Kibana
  assert(data.$schema.includes('vega-lite'), 'Should use Vega-Lite schema');
  assert(data.data, 'Should have data configuration');
  assert(data.layer, 'Pareto should have layers');
  assert(data.layer.length >= 2, 'Should have at least 2 layers (bars + line)');
  assert(data.transform, 'Should have transforms for cumulative calculations');
  assert(data.resolve?.scale?.y === 'independent', 'Y scales should be independent');
}

async function testKibanaFieldNameConsistency() {
  // Test that transforms create field names that match what encodings use
  const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
    type: 'bubble',
    config: {
      xField: 'total_unique_products',
      yField: 'taxful_total_price',
      sizeField: 'taxless_total_price',
      colorField: 'customer_gender',
      showLegend: true,
      title: 'Test Field Consistency'
    },
    elasticConfig: {
      index: 'kibana_sample_data_ecommerce',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'customer_gender', options: { size: 100 } },
        metrics: [
          { type: 'avg', field: 'total_unique_products', alias: 'metric_0' },
          { type: 'avg', field: 'taxful_total_price', alias: 'metric_1' }
        ]
      }
    }
  });
  
  assert.strictEqual(status, 200, `Expected 200, got ${status}`);
  
  // Check transforms exist
  assert(data.transform, 'Should have transforms');
  assert(Array.isArray(data.transform), 'Transforms should be array');
  
  // Get all field names created by transforms
  const transformedFields = data.transform.map(t => t.as);
  
  // Check that standard fields are transformed
  assert(transformedFields.includes('_count'), 'Should transform doc_count to _count');
  assert(transformedFields.includes('customer_gender'), 'Should transform key to bucket field name');
  
  // Check metric transforms exist with proper naming (avg_fieldname format)
  assert(
    transformedFields.some(f => f.includes('avg_total_unique_products')),
    'Should have metric transform for avg_total_unique_products'
  );
  assert(
    transformedFields.some(f => f.includes('avg_taxful_total_price')),
    'Should have metric transform for avg_taxful_total_price'
  );
  
  // Check that encoding x field references a transformed field
  const encoding = data.encoding;
  if (encoding.x && encoding.x.field) {
    assert(
      transformedFields.includes(encoding.x.field),
      `X field "${encoding.x.field}" should be in transforms`
    );
  }
  
  // Check that encoding y field references a transformed field
  if (encoding.y && encoding.y.field) {
    assert(
      transformedFields.includes(encoding.y.field),
      `Y field "${encoding.y.field}" should be in transforms`
    );
  }
  
  // Check color field references the bucket field
  if (encoding.color && encoding.color.field) {
    assert(
      transformedFields.includes(encoding.color.field),
      `Color field "${encoding.color.field}" should be in transforms`
    );
  }
  
  // Check size field references _count
  if (encoding.size && encoding.size.field) {
    assert(
      encoding.size.field === '_count',
      `Size field should be _count, got ${encoding.size.field}`
    );
  }
}
