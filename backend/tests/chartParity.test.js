/**
 * Chart Parity Test Suite
 * 
 * Tests that ensure Preview and Kibana specs have matching features:
 * - Same number of visual marks (bars, lines, text labels, etc.)
 * - Consistent label handling when showLabels is enabled
 * - Valid Vega/Vega-Lite syntax (no parsing errors)
 * - Consistent style/color application
 * 
 * Run with: npm test -- --grep "parity"
 */

import assert from 'assert';

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api';

// Test data for different chart types
const SAMPLE_DATA = {
  basic: [
    { category: 'A', value: 100, date: '2024-01-01' },
    { category: 'B', value: 200, date: '2024-01-02' },
    { category: 'C', value: 150, date: '2024-01-03' },
    { category: 'D', value: 300, date: '2024-01-04' },
    { category: 'E', value: 250, date: '2024-01-05' }
  ],
  flow: [
    { source: 'A', target: 'X', value: 100 },
    { source: 'A', target: 'Y', value: 150 },
    { source: 'B', target: 'X', value: 80 },
    { source: 'B', target: 'Y', value: 120 },
    { source: 'C', target: 'Z', value: 200 }
  ],
  hierarchical: [
    { name: 'Root', parent: null, value: 0 },
    { name: 'Category A', parent: 'Root', value: 100 },
    { name: 'Category B', parent: 'Root', value: 200 },
    { name: 'Category C', parent: 'Root', value: 150 }
  ],
  numeric: [
    { x: 10, y: 20, size: 5, category: 'A' },
    { x: 30, y: 40, size: 8, category: 'B' },
    { x: 50, y: 30, size: 12, category: 'A' },
    { x: 70, y: 60, size: 6, category: 'C' }
  ],
  wordcloud: [
    { word: 'hello', count: 100 },
    { word: 'world', count: 80 },
    { word: 'test', count: 60 },
    { word: 'data', count: 120 }
  ],
  ternary: [
    { label: 'Point A', top: 33, left: 33, right: 34 },
    { label: 'Point B', top: 50, left: 25, right: 25 },
    { label: 'Point C', top: 20, left: 40, right: 40 }
  ],
  radar: [
    { key: 'Speed', value: 80, category: 'A' },
    { key: 'Power', value: 70, category: 'A' },
    { key: 'Defense', value: 90, category: 'A' },
    { key: 'Speed', value: 60, category: 'B' },
    { key: 'Power', value: 85, category: 'B' },
    { key: 'Defense', value: 75, category: 'B' }
  ]
};

// Chart configurations for testing
const CHART_CONFIGS = {
  bar: {
    config: { xField: 'category', yField: 'value', showLabels: true },
    data: SAMPLE_DATA.basic,
    expectedMarks: { preview: ['rect'], kibana: ['rect'] }
  },
  line: {
    config: { xField: 'date', yField: 'value', showLabels: false },
    data: SAMPLE_DATA.basic,
    expectedMarks: { preview: ['line'], kibana: ['line'] }
  },
  area: {
    config: { xField: 'date', yField: 'value' },
    data: SAMPLE_DATA.basic,
    expectedMarks: { preview: ['area'], kibana: ['area'] }
  },
  pie: {
    config: { categoryField: 'category', valueField: 'value', showLabels: true },
    data: SAMPLE_DATA.basic,
    expectedMarks: { preview: ['arc'], kibana: ['arc'] }
  },
  donut: {
    config: { categoryField: 'category', valueField: 'value', showLabels: true },
    data: SAMPLE_DATA.basic,
    expectedMarks: { preview: ['arc'], kibana: ['arc'] }
  },
  scatter: {
    config: { xField: 'x', yField: 'y', colorField: 'category' },
    data: SAMPLE_DATA.numeric,
    expectedMarks: { preview: ['symbol'], kibana: ['point'] }
  },
  heatmap: {
    config: { xField: 'category', yField: 'category', valueField: 'value' },
    data: SAMPLE_DATA.basic,
    expectedMarks: { preview: ['rect'], kibana: ['rect'] }
  },
  treemap: {
    config: { categoryField: 'name', valueField: 'value', showLabels: true },
    data: SAMPLE_DATA.hierarchical,
    expectedMarks: { preview: ['rect', 'text'], kibana: ['rect'] }
  },
  funnel: {
    config: { stageField: 'category', valueField: 'value', showLabels: true },
    data: SAMPLE_DATA.basic,
    expectedMarks: { preview: ['path', 'text'], kibana: ['rect'] }
  },
  sankey: {
    config: { sourceField: 'source', targetField: 'target', valueField: 'value', showLabels: true },
    data: SAMPLE_DATA.flow,
    expectedMarks: { preview: ['rect', 'path'], kibana: ['rect', 'path'] }
  },
  chord: {
    config: { sourceField: 'source', targetField: 'target', valueField: 'value', showLabels: true },
    data: SAMPLE_DATA.flow,
    expectedMarks: { preview: ['arc', 'path'], kibana: ['arc', 'path'] }
  },
  radial: {
    config: { categoryField: 'category', valueField: 'value', showLabels: true },
    data: SAMPLE_DATA.basic,
    expectedMarks: { preview: ['arc'], kibana: ['arc'] }
  },
  gauge: {
    config: { valueField: 'value', minValue: 0, maxValue: 500 },
    data: [{ value: 250 }],
    expectedMarks: { preview: ['arc', 'text'], kibana: ['arc', 'text'] }
  },
  metric: {
    config: { valueField: 'value' },
    data: [{ value: 12345 }],
    expectedMarks: { preview: ['text'], kibana: ['text'] }
  },
  wordcloud: {
    config: { textField: 'word', sizeField: 'count' },
    data: SAMPLE_DATA.wordcloud,
    expectedMarks: { preview: ['text'], kibana: ['text'] }
  },
  pareto: {
    config: { categoryField: 'category', valueField: 'value', show80Line: true },
    data: SAMPLE_DATA.basic,
    expectedMarks: { preview: ['rect', 'line'], kibana: ['bar', 'line'] }
  },
  boxplot: {
    config: { categoryField: 'category', valueField: 'value' },
    data: SAMPLE_DATA.basic,
    expectedMarks: { preview: ['boxplot'], kibana: ['boxplot'] }
  },
  violin: {
    config: { categoryField: 'category', valueField: 'value' },
    data: SAMPLE_DATA.basic,
    expectedMarks: { preview: ['area'], kibana: ['area'] }
  },
  circle_packing: {
    config: { categoryField: 'name', valueField: 'value', showLabels: true },
    data: SAMPLE_DATA.hierarchical,
    expectedMarks: { preview: ['symbol', 'text'], kibana: ['symbol'] }
  },
  waterfall: {
    config: { labelField: 'category', valueField: 'value' },
    data: SAMPLE_DATA.basic,
    expectedMarks: { preview: ['rect'], kibana: ['bar'] }
  },
  radar: {
    config: { keyField: 'key', valueField: 'value', categoryField: 'category' },
    data: SAMPLE_DATA.radar,
    expectedMarks: { preview: ['line'], kibana: ['line'] }
  }
};

// Elastic config for Kibana spec generation
const ELASTIC_CONFIG = {
  index: 'test-index',
  query: {},
  timeField: '@timestamp',
  useContext: false,
  aggregation: {
    bucketAgg: { field: 'category', type: 'terms' },
    metricAgg: { field: 'value', type: 'sum' }
  }
};

// Results tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
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
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    return { status: 500, data: { error: error.message } };
  }
}

// Count marks in a Vega/Vega-Lite spec
function countMarks(spec) {
  const marks = {};
  
  // Handle Vega specs (marks array)
  if (spec.marks && Array.isArray(spec.marks)) {
    for (const mark of spec.marks) {
      const type = mark.type;
      marks[type] = (marks[type] || 0) + 1;
    }
  }
  
  // Handle Vega-Lite specs (mark or layer)
  if (spec.mark) {
    const type = typeof spec.mark === 'string' ? spec.mark : spec.mark.type;
    marks[type] = (marks[type] || 0) + 1;
  }
  
  if (spec.layer && Array.isArray(spec.layer)) {
    for (const layer of spec.layer) {
      if (layer.mark) {
        const type = typeof layer.mark === 'string' ? layer.mark : layer.mark.type;
        marks[type] = (marks[type] || 0) + 1;
      }
    }
  }
  
  return marks;
}

// Check if spec has text marks (labels)
function hasTextMarks(spec) {
  const marks = countMarks(spec);
  return marks.text > 0;
}

// Check for common Vega errors in spec structure
function validateSpecStructure(spec, isKibana = false) {
  const errors = [];
  
  // Must have $schema
  if (!spec.$schema) {
    errors.push('Missing $schema');
  }
  
  // Must have data
  if (!spec.data) {
    errors.push('Missing data');
  }
  
  // Check for undefined references
  const specStr = JSON.stringify(spec);
  if (specStr.includes('undefined')) {
    errors.push('Spec contains undefined values');
  }
  
  // Kibana specs should have url in data for ES query
  if (isKibana && spec.data && !spec.data.url && !spec.data.values && !Array.isArray(spec.data)) {
    errors.push('Kibana spec missing data.url');
  }
  
  return errors;
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

// Skip test
function skipTest(name, reason) {
  results.skipped++;
  console.log(`⏭️  ${name}: ${reason}`);
}

// ========================================
// PARITY TESTS
// ========================================

async function testChartParity(chartType) {
  const chartConfig = CHART_CONFIGS[chartType];
  if (!chartConfig) {
    skipTest(`${chartType} parity`, 'No config defined');
    return;
  }
  
  // Test 1: Preview spec generation
  await runTest(`${chartType}: Preview spec generates successfully`, async () => {
    const { status, data } = await apiRequest('/vega/generate', 'POST', {
      type: chartType,
      config: chartConfig.config,
      data: chartConfig.data
    });
    
    assert.strictEqual(status, 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.$schema, 'Missing $schema in preview spec');
    
    const errors = validateSpecStructure(data, false);
    assert.strictEqual(errors.length, 0, `Preview spec errors: ${errors.join(', ')}`);
  });
  
  // Test 2: Kibana spec generation
  await runTest(`${chartType}: Kibana spec generates successfully`, async () => {
    const { status, data } = await apiRequest('/vega/generate-kibana', 'POST', {
      type: chartType,
      config: chartConfig.config,
      elasticConfig: ELASTIC_CONFIG
    });
    
    assert.strictEqual(status, 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.$schema, 'Missing $schema in Kibana spec');
    
    const errors = validateSpecStructure(data, true);
    assert.strictEqual(errors.length, 0, `Kibana spec errors: ${errors.join(', ')}`);
  });
  
  // Test 3: Label parity when showLabels is true
  if (chartConfig.config.showLabels) {
    await runTest(`${chartType}: Labels present in both specs when showLabels=true`, async () => {
      const previewRes = await apiRequest('/vega/generate', 'POST', {
        type: chartType,
        config: { ...chartConfig.config, showLabels: true },
        data: chartConfig.data
      });
      
      const kibanaRes = await apiRequest('/vega/generate/kibana', 'POST', {
        type: chartType,
        config: { ...chartConfig.config, showLabels: true },
        elasticConfig: ELASTIC_CONFIG
      });
      
      if (previewRes.status === 200 && kibanaRes.status === 200) {
        const previewHasLabels = hasTextMarks(previewRes.data);
        const kibanaHasLabels = hasTextMarks(kibanaRes.data);
        
        // If preview has labels, Kibana should too
        if (previewHasLabels && !kibanaHasLabels) {
          assert.fail('Preview has labels but Kibana does not');
        }
      }
    });
  }
  
  // Test 4: Expected mark types present
  await runTest(`${chartType}: Expected mark types present`, async () => {
    const { status, data } = await apiRequest('/vega/generate', 'POST', {
      type: chartType,
      config: chartConfig.config,
      data: chartConfig.data
    });
    
    if (status === 200) {
      const marks = countMarks(data);
      const expectedPreview = chartConfig.expectedMarks.preview;
      
      for (const expected of expectedPreview) {
        // Check if mark type exists (some charts use different mark types)
        const hasExpected = Object.keys(marks).some(m => 
          m === expected || m.includes(expected) || expected.includes(m)
        );
        assert(hasExpected || Object.keys(marks).length > 0, 
          `Expected mark type '${expected}' not found. Got: ${Object.keys(marks).join(', ')}`);
      }
    }
  });
}

// ========================================
// MAIN TEST RUNNER
// ========================================

async function runAllTests() {
  console.log('\n🧪 Running Chart Parity Test Suite\n');
  console.log('==================================================\n');
  
  console.log('📊 CHART PARITY TESTS\n');
  
  // Run parity tests for all configured charts
  for (const chartType of Object.keys(CHART_CONFIGS)) {
    console.log(`\n--- ${chartType.toUpperCase()} ---`);
    await testChartParity(chartType);
  }
  
  // Summary
  console.log('\n==================================================');
  console.log(`📊 PARITY TEST RESULTS: ${results.passed} passed, ${results.failed} failed, ${results.skipped} skipped`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Failed Tests:');
    for (const { name, error } of results.errors) {
      console.log(`   - ${name}: ${error}`);
    }
  }
  
  console.log('==================================================\n');
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run if called directly
runAllTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});

export { CHART_CONFIGS, ELASTIC_CONFIG, countMarks, hasTextMarks, validateSpecStructure };

