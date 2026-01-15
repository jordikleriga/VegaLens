#!/usr/bin/env node
/**
 * Tier 1 Test Runner - Schema Validation
 *
 * Validates all chart types against JSON schema and Vega-Lite compilation.
 * This is the fastest tier - runs in ~2 seconds.
 */

import { chartRegistry } from '../../src/services/vega/index.js';
import { SchemaValidator } from './SchemaValidator.js';
import { KibanaSpecAssertions } from './KibanaSpecAssertions.js';

// Test configurations for ALL 40 chart types
// Using kibana_sample_data_ecommerce fields:
// - category.keyword, manufacturer.keyword (text with keyword)
// - customer_gender, day_of_week, currency (keyword)
// - taxful_total_price, taxless_total_price, total_quantity, total_unique_products (numeric)
// - order_date, customer_birth_date (date)
const TEST_CONFIGS = {
  // ═══════════════════════════════════════════════════════════
  // TREND CHARTS
  // ═══════════════════════════════════════════════════════════
  bar: {
    config: { xField: 'category', yField: 'taxful_total_price', title: 'Bar Chart' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 10 } },
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  },
  line: {
    config: { xField: 'date', yField: 'taxful_total_price', title: 'Line Chart' },
    elasticConfig: {
      index: 'test-index',
      timeField: 'order_date',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'order_date', options: { interval: 'day' } },
        metrics: [{ type: 'avg', field: 'taxful_total_price' }]
      }
    }
  },
  area: {
    config: { xField: 'date', yField: 'taxful_total_price', title: 'Area Chart' },
    elasticConfig: {
      index: 'test-index',
      timeField: 'order_date',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'order_date', options: { interval: 'day' } },
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  },
  rolling_average: {
    config: { xField: 'date', yField: 'taxful_total_price', window: 7, title: 'Rolling Average' },
    elasticConfig: {
      index: 'test-index',
      timeField: 'order_date',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'order_date', options: { interval: 'day' } },
        metrics: [{ type: 'avg', field: 'taxful_total_price' }]
      }
    }
  },
  sparkline: {
    config: { xField: 'date', yField: 'taxful_total_price', title: 'Sparkline' },
    elasticConfig: {
      index: 'test-index',
      timeField: 'order_date',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'order_date', options: { interval: 'day' } },
        metrics: [{ type: 'avg', field: 'taxful_total_price' }]
      }
    }
  },
  horizon: {
    config: { xField: 'date', yField: 'taxful_total_price', bands: 3, title: 'Horizon Chart' },
    elasticConfig: {
      index: 'test-index',
      timeField: 'order_date',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'order_date', options: { interval: 'day' } },
        metrics: [{ type: 'avg', field: 'taxful_total_price' }]
      }
    }
  },
  streamgraph: {
    config: { xField: 'date', yField: 'taxful_total_price', colorField: 'category.keyword', title: 'Streamgraph' },
    elasticConfig: {
      index: 'test-index',
      timeField: 'order_date',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'order_date', options: { interval: 'day' } },
        splitBy: { field: 'category.keyword', options: { size: 5 } },
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  },
  lasagna: {
    config: { xField: 'date', yField: 'category.keyword', valueField: 'taxful_total_price', title: 'Lasagna Plot' },
    elasticConfig: {
      index: 'test-index',
      timeField: 'order_date',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'order_date', options: { interval: 'day' } },
        splitBy: { field: 'category.keyword', options: { size: 5 } },
        metrics: [{ type: 'avg', field: 'taxful_total_price' }]
      }
    }
  },
  dual_axis: {
    config: { xField: 'date', yField1: 'taxful_total_price', yField2: 'total_quantity', title: 'Dual Axis' },
    elasticConfig: {
      index: 'test-index',
      timeField: 'order_date',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'order_date', options: { interval: 'day' } },
        metrics: [{ type: 'avg', field: 'taxful_total_price' }, { type: 'sum', field: 'total_quantity' }]
      }
    }
  },
  trellis_area: {
    config: { xField: 'date', yField: 'taxful_total_price', facetField: 'category.keyword', title: 'Trellis Area' },
    elasticConfig: {
      index: 'test-index',
      timeField: 'order_date',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'order_date', options: { interval: 'day' } },
        splitBy: { field: 'category.keyword', options: { size: 4 } },
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  },

  // ═══════════════════════════════════════════════════════════
  // COMPOSITION CHARTS
  // ═══════════════════════════════════════════════════════════
  pie: {
    config: { categoryField: 'category', valueField: 'taxful_total_price', title: 'Pie Chart' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 8 } },
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  },
  donut: {
    config: { categoryField: 'category', valueField: 'taxful_total_price', title: 'Donut Chart' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 8 } },
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  },
  marimekko: {
    config: { xField: 'category', yField: 'taxful_total_price', colorField: 'manufacturer', title: 'Marimekko' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 10 } },
        splitBy: { field: 'manufacturer.keyword', options: { size: 5 } },
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  },

  // ═══════════════════════════════════════════════════════════
  // POINT-BASED CHARTS
  // ═══════════════════════════════════════════════════════════
  scatter: {
    config: { xField: 'taxful_total_price', yField: 'total_quantity', title: 'Scatter Plot' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 50 } },
        metrics: [
          { type: 'avg', field: 'taxful_total_price' },
          { type: 'avg', field: 'total_quantity' }
        ]
      }
    }
  },
  // Note: bubble chart type removed - use scatter with size field instead

  // ═══════════════════════════════════════════════════════════
  // HEATMAP/GRID CHARTS
  // ═══════════════════════════════════════════════════════════
  heatmap: {
    config: { xField: 'category', yField: 'day_of_week', valueField: 'taxful_total_price', title: 'Heatmap' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        // Heatmap uses bucketAggs array format (xBucket, yBucket)
        bucketAggs: [
          { type: 'terms', field: 'category.keyword', options: { size: 10 } },
          { type: 'terms', field: 'day_of_week', options: { size: 7 } }  // day_of_week is already keyword type
        ],
        metrics: [{ type: 'avg', field: 'taxful_total_price' }]
      }
    }
  },
  binned_heatmap: {
    config: { xField: 'taxful_total_price', yField: 'total_quantity', title: 'Binned Heatmap' },
    elasticConfig: {
      index: 'test-index',
      sampleSize: 100,
      aggregation: {
        bucketAgg: { type: 'histogram', field: 'taxful_total_price', options: { interval: 10 } },
        metrics: []
      }
    }
  },
  heatlane: {
    config: { xField: 'date', yField: 'category', valueField: 'taxful_total_price', title: 'Heatlane' },
    elasticConfig: {
      index: 'test-index',
      timeField: 'order_date',
      aggregation: {
        bucketAgg: { type: 'date_histogram', field: 'order_date', options: { interval: 'day' } },
        splitBy: { field: 'category.keyword', options: { size: 6 } },
        metrics: [{ type: 'avg', field: 'taxful_total_price' }]
      }
    }
  },

  // ═══════════════════════════════════════════════════════════
  // DISTRIBUTION CHARTS
  // ═══════════════════════════════════════════════════════════
  histogram: {
    config: { valueField: 'taxful_total_price', bins: 20, title: 'Histogram' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'histogram', field: 'taxful_total_price', options: { interval: 10 } },
        metrics: []
      }
    }
  },
  boxplot: {
    config: { categoryField: 'category', valueField: 'taxful_total_price', title: 'Box Plot' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 10 } },
        metrics: [{ type: 'percentiles', field: 'taxful_total_price' }]
      }
    }
  },
  density: {
    config: { valueField: 'taxful_total_price', title: 'Density Plot' },
    elasticConfig: {
      index: 'test-index',
      sampleSize: 100,
      aggregation: {
        bucketAgg: { type: 'histogram', field: 'taxful_total_price', options: { interval: 5 } },
        metrics: [{ type: 'avg', field: 'taxful_total_price' }]
      }
    }
  },
  error_bars: {
    config: { xField: 'category', yField: 'taxful_total_price', title: 'Error Bars' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 10 } },
        metrics: [{ type: 'avg', field: 'taxful_total_price' }, { type: 'std_deviation', field: 'taxful_total_price' }]
      }
    }
  },
  violin: {
    config: { categoryField: 'category', valueField: 'taxful_total_price', title: 'Violin Plot' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 10 } },
        metrics: [{ type: 'percentiles', field: 'taxful_total_price' }]
      }
    }
  },

  // ═══════════════════════════════════════════════════════════
  // HIERARCHICAL CHARTS
  // ═══════════════════════════════════════════════════════════
  treemap: {
    config: { categoryField: 'category', valueField: 'taxful_total_price', title: 'Treemap' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 20 } },
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  },
  circle_packing: {
    config: { categoryField: 'category', valueField: 'taxful_total_price', title: 'Circle Packing' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 20 } },
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  },

  // ═══════════════════════════════════════════════════════════
  // GAUGE/RADIAL CHARTS
  // ═══════════════════════════════════════════════════════════
  radial: {
    config: { categoryField: 'category', valueField: 'taxful_total_price', title: 'Radial' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 8 } },
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  },
  radar: {
    config: { keyField: 'category', valueField: 'taxful_total_price', title: 'Radar Chart' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 8 } },
        metrics: [{ type: 'avg', field: 'taxful_total_price' }]
      }
    }
  },
  bullet: {
    config: { titleField: 'category', measuresField: 'taxful_total_price', rangesField: 'total_quantity', title: 'Bullet Chart' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 10 } },
        metrics: [{ type: 'avg', field: 'taxful_total_price' }, { type: 'max', field: 'taxful_total_price' }]
      }
    }
  },

  // ═══════════════════════════════════════════════════════════
  // FLOW/PROCESS CHARTS
  // ═══════════════════════════════════════════════════════════
  sankey: {
    // Sankey needs source->target flow data. Using category->manufacturer as proxy
    // Note: Sankey uses multi_terms aggregation directly with sourceField/targetField from config
    config: { sourceField: 'category.keyword', targetField: 'manufacturer.keyword', valueField: 'taxful_total_price', title: 'Sankey' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 10 } },
        splitBy: { field: 'manufacturer.keyword', options: { size: 5 } },
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  },
  waterfall: {
    config: { categoryField: 'category', valueField: 'taxful_total_price', title: 'Waterfall' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 10 } },
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  },
  funnel: {
    // Using day_of_week as stages for funnel demo
    config: { stageField: 'day_of_week', valueField: 'taxful_total_price', title: 'Funnel' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'day_of_week', options: { size: 7 } },
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  },
  chord: {
    // Chord needs source->target relationship. Using category->manufacturer
    // Note: ChordGenerator uses multi_terms aggregation with bucketAggs array
    config: { sourceField: 'category', targetField: 'manufacturer', valueField: 'taxful_total_price', title: 'Chord Diagram' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        // Chord needs bucketAggs array for multi_terms (source, target fields)
        bucketAggs: [
          { type: 'terms', field: 'category.keyword', options: { size: 10 } },
          { type: 'terms', field: 'manufacturer.keyword', options: { size: 5 } }
        ],
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  },

  // ═══════════════════════════════════════════════════════════
  // TEXT-BASED CHARTS
  // ═══════════════════════════════════════════════════════════
  wordcloud: {
    config: { textField: 'manufacturer', sizeField: 'taxful_total_price', title: 'Word Cloud' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'manufacturer.keyword', options: { size: 100 } },
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  },

  // ═══════════════════════════════════════════════════════════
  // SPECIALTY CHARTS
  // ═══════════════════════════════════════════════════════════
  ternary: {
    // Ternary needs 3 components that sum to 100%. Using price breakdown as proxy
    config: {
      labelField: 'category',
      topField: 'taxful_total_price',
      leftField: 'taxless_total_price',
      rightField: 'total_quantity',
      topLabel: 'Taxful Price',
      leftLabel: 'Taxless Price',
      rightLabel: 'Quantity',
      title: 'Ternary Plot'
    },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 30 } },
        metrics: [
          { type: 'avg', field: 'taxful_total_price' },
          { type: 'avg', field: 'taxless_total_price' },
          { type: 'avg', field: 'total_quantity' }
        ]
      }
    }
  },
  comet: {
    // Comet shows change over time by category
    config: { categoryField: 'category.keyword', timeField: 'day_of_week', valueField: 'taxful_total_price', title: 'Comet Chart' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 20 } },
        splitBy: { field: 'day_of_week', options: { size: 7 } },
        metrics: [{ type: 'avg', field: 'taxful_total_price' }]
      }
    }
  },
  population_pyramid: {
    // Using customer_gender and day_of_week as proxy for population pyramid
    config: { categoryField: 'day_of_week', valueField: 'taxful_total_price', groupField: 'customer_gender', leftGroup: 'FEMALE', rightGroup: 'MALE', title: 'Population Pyramid' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'day_of_week', options: { size: 7 } },
        splitBy: { field: 'customer_gender', options: { size: 2 } },
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  },
  pareto: {
    config: { categoryField: 'category', valueField: 'taxful_total_price', title: 'Pareto Chart' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 20 } },
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  }
};

async function runTier1Tests(options = {}) {
  const { verbose = false, chartTypes = null } = options;

  console.log('\n====================================================');
  console.log('  TIER 1: SCHEMA VALIDATION');
  console.log('====================================================\n');

  const schemaValidator = new SchemaValidator();
  const kibanaAssertions = new KibanaSpecAssertions();

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    details: []
  };

  // Get chart types to test
  const availableTypes = chartRegistry.getTypes();
  const typesToTest = chartTypes
    ? chartTypes.filter(t => availableTypes.includes(t))
    : Object.keys(TEST_CONFIGS);

  console.log(`Testing ${typesToTest.length} chart types...\n`);

  const startTime = Date.now();

  for (const chartType of typesToTest) {
    const testConfig = TEST_CONFIGS[chartType];

    if (!testConfig) {
      if (verbose) {
        console.log(`  [SKIP] ${chartType} - no test config`);
      }
      results.skipped++;
      continue;
    }

    results.total++;

    try {
      // Generate Kibana spec
      const spec = chartRegistry.generateForKibana(
        chartType,
        testConfig.config,
        testConfig.elasticConfig
      );

      // Run schema validation (quick mode - no remote fetch)
      const schemaResult = schemaValidator.validateQuick(spec);

      // Run Kibana-specific assertions
      const kibanaResult = kibanaAssertions.assertAll(spec);

      const passed = schemaResult.valid && kibanaResult.valid;

      if (passed) {
        results.passed++;
        if (verbose) {
          console.log(`  [PASS] ${chartType}`);
        }
      } else {
        results.failed++;
        console.log(`  [FAIL] ${chartType}`);

        if (schemaResult.errors.length > 0) {
          schemaResult.errors.forEach(err => {
            console.log(`         Schema: ${err.message}`);
          });
        }

        if (kibanaResult.failed > 0) {
          kibanaResult.details
            .filter(d => !d.passed)
            .forEach(d => {
              console.log(`         Kibana: ${d.name} - ${d.message}`);
            });
        }
      }

      results.details.push({
        chartType,
        passed,
        schemaResult,
        kibanaResult
      });

    } catch (error) {
      results.failed++;
      console.log(`  [ERROR] ${chartType}: ${error.message}`);

      results.details.push({
        chartType,
        passed: false,
        error: error.message
      });
    }
  }

  const duration = Date.now() - startTime;

  // Summary
  console.log('\n----------------------------------------------------');
  console.log(`  Results: ${results.passed}/${results.total} passed`);
  if (results.skipped > 0) {
    console.log(`  Skipped: ${results.skipped} (no test config)`);
  }
  console.log(`  Duration: ${duration}ms`);
  console.log('----------------------------------------------------\n');

  return {
    ...results,
    duration,
    success: results.failed === 0
  };
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const verbose = args.includes('-v') || args.includes('--verbose');
  const chartArg = args.find(a => a.startsWith('--chart='));
  const chartTypes = chartArg ? chartArg.split('=')[1].split(',') : null;

  runTier1Tests({ verbose, chartTypes }).then(results => {
    process.exit(results.success ? 0 : 1);
  });
}

export { runTier1Tests, TEST_CONFIGS };
