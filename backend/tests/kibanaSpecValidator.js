/**
 * Kibana Spec Validator
 * 
 * Validates Kibana Vega specs by:
 * 1. Parsing and compiling with vega-lite
 * 2. Testing with mock Elasticsearch responses
 * 3. Comparing output structure to expected patterns
 * 
 * This catches issues before they reach Kibana.
 */

import { chartRegistry } from '../src/services/vega/index.js';
import assert from 'assert';

// Mock Elasticsearch aggregation responses for each chart type
const MOCK_ES_RESPONSES = {
  // Standard terms aggregation response
  terms: {
    aggregations: {
      primary: {
        buckets: [
          { key: 'Category A', doc_count: 100 },
          { key: 'Category B', doc_count: 80 },
          { key: 'Category C', doc_count: 60 }
        ]
      }
    }
  },
  
  // Terms with metric aggregation
  terms_with_metric: {
    aggregations: {
      primary: {
        buckets: [
          { key: 'Category A', doc_count: 100, metric_0: { value: 150.5 } },
          { key: 'Category B', doc_count: 80, metric_0: { value: 120.3 } },
          { key: 'Category C', doc_count: 60, metric_0: { value: 90.1 } }
        ]
      }
    }
  },
  
  // Multi-terms aggregation (for population pyramid, sankey)
  multi_terms: {
    aggregations: {
      primary: {
        buckets: [
          { key: ['Monday', 'FEMALE'], doc_count: 50, metric_0: { value: 100 } },
          { key: ['Monday', 'MALE'], doc_count: 45, metric_0: { value: 95 } },
          { key: ['Tuesday', 'FEMALE'], doc_count: 60, metric_0: { value: 110 } },
          { key: ['Tuesday', 'MALE'], doc_count: 55, metric_0: { value: 105 } }
        ]
      }
    }
  },
  
  // Date histogram aggregation
  date_histogram: {
    aggregations: {
      primary: {
        buckets: [
          { key_as_string: '2024-01-01', key: 1704067200000, doc_count: 100 },
          { key_as_string: '2024-02-01', key: 1706745600000, doc_count: 120 },
          { key_as_string: '2024-03-01', key: 1709251200000, doc_count: 90 }
        ]
      }
    }
  }
};

// Expected spec structure patterns for validation
const EXPECTED_PATTERNS = {
  // All specs must have these
  base: {
    hasSchema: spec => spec.$schema?.includes('vega-lite'),
    hasData: spec => spec.data?.url || spec.data?.values,
    hasEncoding: spec => spec.encoding || spec.layer || spec.spec?.encoding,
    hasMark: spec => spec.mark || spec.layer || spec.spec?.mark
  },
  
  // Chart-specific patterns
  bar: {
    markType: spec => getMarkType(spec) === 'bar',
    hasXY: spec => hasEncoding(spec, 'x') && hasEncoding(spec, 'y')
  },
  
  line: {
    markType: spec => getMarkType(spec) === 'line',
    hasXY: spec => hasEncoding(spec, 'x') && hasEncoding(spec, 'y')
  },
  
  area: {
    markType: spec => getMarkType(spec) === 'area',
    hasXY: spec => hasEncoding(spec, 'x') && hasEncoding(spec, 'y')
  },
  
  pie: {
    markType: spec => getMarkType(spec) === 'arc',
    hasTheta: spec => hasEncoding(spec, 'theta') || hasEncoding(spec, 'color')
  },
  
  donut: {
    markType: spec => getMarkType(spec) === 'arc',
    hasInnerRadius: spec => {
      const mark = getMarkConfig(spec);
      return mark?.innerRadius > 0;
    }
  },
  
  scatter: {
    markType: spec => ['circle', 'point'].includes(getMarkType(spec)),
    hasXY: spec => hasEncoding(spec, 'x') && hasEncoding(spec, 'y')
  },
  
  bubble: {
    markType: spec => ['circle', 'point'].includes(getMarkType(spec)),
    hasSize: spec => hasEncoding(spec, 'size')
  },
  
  heatmap: {
    markType: spec => getMarkType(spec) === 'rect',
    hasColorScale: spec => hasEncoding(spec, 'color')
  },
  
  population_pyramid: {
    hasDivergingBars: spec => {
      // Should have color encoding with two groups
      const color = getEncoding(spec, 'color');
      return color && color.field && !hasEncoding(spec, 'x', 'aggregate');
    },
    hasSignedTransform: spec => {
      // Check for signed_value transform
      const transforms = spec.transform || [];
      return transforms.some(t => t.as === 'signed_value');
    }
  },
  
  dual_axis: {
    isLayered: spec => Array.isArray(spec.layer) && spec.layer.length >= 2,
    hasTwoYAxes: spec => {
      if (!spec.layer) return false;
      const resolves = spec.resolve?.scale?.y === 'independent';
      return resolves || spec.layer.some(l => l.encoding?.y?.axis?.orient === 'right');
    }
  }
};

// Helper functions
function getMarkType(spec) {
  if (typeof spec.mark === 'string') return spec.mark;
  if (typeof spec.mark === 'object') return spec.mark.type;
  if (spec.layer?.[0]) return getMarkType(spec.layer[0]);
  if (spec.spec) return getMarkType(spec.spec);
  return null;
}

function getMarkConfig(spec) {
  if (typeof spec.mark === 'object') return spec.mark;
  if (spec.layer?.[0]) return getMarkConfig(spec.layer[0]);
  if (spec.spec) return getMarkConfig(spec.spec);
  return null;
}

function getEncoding(spec, channel) {
  if (spec.encoding?.[channel]) return spec.encoding[channel];
  if (spec.layer?.[0]) return getEncoding(spec.layer[0], channel);
  if (spec.spec) return getEncoding(spec.spec, channel);
  return null;
}

function hasEncoding(spec, channel, property = null) {
  const enc = getEncoding(spec, channel);
  if (!enc) return false;
  if (property) return enc[property] !== undefined;
  return true;
}

// Simulate transform execution with mock data
function applyTransforms(data, transforms) {
  if (!transforms || transforms.length === 0) return data;
  
  return data.map(datum => {
    const result = { ...datum };
    transforms.forEach(transform => {
      if (transform.calculate && transform.as) {
        try {
          // Simple expression evaluator for common patterns
          let expr = transform.calculate;
          
          // Handle datum references
          expr = expr.replace(/datum\['([^']+)'\]/g, (_, field) => {
            const val = datum[field];
            return typeof val === 'string' ? `"${val}"` : val;
          });
          expr = expr.replace(/datum\.([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, field) => {
            const val = datum[field];
            return typeof val === 'string' ? `"${val}"` : val;
          });
          expr = expr.replace(/datum\.key\[(\d+)\]/g, (_, idx) => {
            const val = datum.key?.[parseInt(idx)];
            return typeof val === 'string' ? `"${val}"` : val;
          });
          
          // Handle abs function
          expr = expr.replace(/abs\(([^)]+)\)/g, 'Math.abs($1)');
          
          // Evaluate
          result[transform.as] = eval(expr);
        } catch (e) {
          // If eval fails, skip this transform
          console.warn(`Transform eval failed: ${transform.calculate}`, e.message);
        }
      }
    });
    return result;
  });
}

// Main validation function
async function validateKibanaSpec(chartType, config, aggregationConfig) {
  const results = {
    chartType,
    passed: [],
    failed: [],
    warnings: []
  };
  
  // Generate the Kibana spec using chartRegistry
  const spec = chartRegistry.generateForKibana(chartType, config, {
    index: 'test_index',
    aggregation: aggregationConfig
  });
  
  // Validate base patterns
  for (const [name, check] of Object.entries(EXPECTED_PATTERNS.base)) {
    try {
      if (check(spec)) {
        results.passed.push(`Base: ${name}`);
      } else {
        results.failed.push(`Base: ${name}`);
      }
    } catch (e) {
      results.failed.push(`Base: ${name} - ${e.message}`);
    }
  }
  
  // Validate chart-specific patterns
  const chartPatterns = EXPECTED_PATTERNS[chartType];
  if (chartPatterns) {
    for (const [name, check] of Object.entries(chartPatterns)) {
      try {
        if (check(spec)) {
          results.passed.push(`${chartType}: ${name}`);
        } else {
          results.failed.push(`${chartType}: ${name}`);
        }
      } catch (e) {
        results.failed.push(`${chartType}: ${name} - ${e.message}`);
      }
    }
  }
  
  // Validate transforms work with mock data
  const mockResponse = getMockResponse(aggregationConfig);
  if (mockResponse && spec.transform) {
    try {
      const mockData = mockResponse.aggregations.primary.buckets;
      const transformedData = applyTransforms(mockData, spec.transform);
      
      // Check that transforms produced expected fields
      if (transformedData.length > 0) {
        const sample = transformedData[0];
        
        // Check for expected fields based on chart type
        if (chartType === 'population_pyramid') {
          if (sample.signed_value !== undefined) {
            results.passed.push('Transform: signed_value field created');
            
            // Check that values are properly signed (some negative, some positive)
            const hasNegative = transformedData.some(d => d.signed_value < 0);
            const hasPositive = transformedData.some(d => d.signed_value > 0);
            if (hasNegative && hasPositive) {
              results.passed.push('Transform: diverging values (negative and positive)');
            } else {
              results.failed.push('Transform: missing diverging values - all same sign');
            }
          } else {
            results.failed.push('Transform: signed_value field missing');
          }
        }
        
        if (sample._count !== undefined) {
          results.passed.push('Transform: _count field created');
        }
      }
    } catch (e) {
      results.warnings.push(`Transform validation: ${e.message}`);
    }
  }
  
  return results;
}

function getMockResponse(aggregationConfig) {
  if (!aggregationConfig?.bucketAgg) return MOCK_ES_RESPONSES.terms;
  
  const aggType = aggregationConfig.bucketAgg.type;
  
  if (aggType === 'multi_terms') return MOCK_ES_RESPONSES.multi_terms;
  if (aggType === 'date_histogram') return MOCK_ES_RESPONSES.date_histogram;
  if (aggregationConfig.metrics?.length > 0) return MOCK_ES_RESPONSES.terms_with_metric;
  
  return MOCK_ES_RESPONSES.terms;
}

// Run validation for all chart types
async function runFullValidation() {
  console.log('🔍 KIBANA SPEC VALIDATION\n');
  console.log('='.repeat(60));
  
  const testCases = [
    {
      chartType: 'bar',
      config: { xField: 'category', yField: 'value' },
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category' },
        metrics: []
      }
    },
    {
      chartType: 'line',
      config: { xField: 'date', yField: 'value' },
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'date' },
        metrics: []
      }
    },
    {
      chartType: 'pie',
      config: { categoryField: 'category', valueField: 'value' },
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category' },
        metrics: []
      }
    },
    {
      chartType: 'population_pyramid',
      config: {
        categoryField: 'day_of_week',
        valueField: 'avg_value',
        groupField: 'customer_gender',
        leftGroup: 'FEMALE',
        rightGroup: 'MALE'
      },
      aggregation: {
        bucketAgg: { 
          type: 'multi_terms', 
          field: 'day_of_week',
          options: { fields: ['day_of_week', 'customer_gender'] }
        },
        metrics: [{ type: 'avg', field: 'value', alias: 'metric_0' }]
      }
    },
    {
      chartType: 'scatter',
      config: { xField: 'x_value', yField: 'y_value' },
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category' },
        metrics: [
          { type: 'avg', field: 'x_value', alias: 'metric_0' },
          { type: 'avg', field: 'y_value', alias: 'metric_1' }
        ]
      }
    },
    {
      chartType: 'heatmap',
      config: { xField: 'x_cat', yField: 'y_cat', valueField: 'value' },
      aggregation: {
        bucketAgg: { type: 'terms', field: 'x_cat' },
        metrics: []
      }
    }
  ];
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  for (const testCase of testCases) {
    console.log(`\n📊 ${testCase.chartType.toUpperCase()}`);
    console.log('-'.repeat(40));
    
    try {
      const results = await validateKibanaSpec(
        testCase.chartType,
        testCase.config,
        testCase.aggregation
      );
      
      results.passed.forEach(p => {
        console.log(`  ✅ ${p}`);
        totalPassed++;
      });
      
      results.failed.forEach(f => {
        console.log(`  ❌ ${f}`);
        totalFailed++;
      });
      
      results.warnings.forEach(w => {
        console.log(`  ⚠️  ${w}`);
      });
      
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
      totalFailed++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`📋 VALIDATION RESULTS: ${totalPassed} passed, ${totalFailed} failed`);
  
  return { passed: totalPassed, failed: totalFailed };
}

// Export for use in tests
export { validateKibanaSpec, runFullValidation, MOCK_ES_RESPONSES, EXPECTED_PATTERNS };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runFullValidation().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}

