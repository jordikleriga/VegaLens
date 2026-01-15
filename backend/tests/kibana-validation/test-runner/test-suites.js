/**
 * Test Suites Configuration
 * Defines test cases for all chart types
 */

export const testSuites = [
  // ===== SIMPLE CHARTS (30s timeout, 6 concurrent) =====
  {
    chartType: 'bar',
    group: 'simple',
    timeout: 30000,
    variants: [
      {
        name: 'basic',
        config: { xField: 'category', yField: 'value' },
        elasticConfig: {
          index: 'test-categorical',
          aggregation: {
            bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 10 } },
            metrics: [{ type: 'avg', field: 'value' }]
          }
        }
      },
      {
        name: 'horizontal',
        config: { xField: 'category', yField: 'value', orientation: 'horizontal' },
        elasticConfig: {
          index: 'test-categorical',
          aggregation: {
            bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 10 } },
            metrics: [{ type: 'avg', field: 'value' }]
          }
        }
      }
    ]
  },
  {
    chartType: 'line',
    group: 'simple',
    timeout: 30000,
    variants: [
      {
        name: 'timeseries',
        config: { xField: '@timestamp', yField: 'value' },
        elasticConfig: {
          index: 'test-timeseries',
          aggregation: {
            bucketAgg: { type: 'date_histogram', field: '@timestamp', options: { interval: '1d' } },
            metrics: [{ type: 'avg', field: 'value' }]
          },
          useContext: true
        }
      }
    ]
  },
  {
    chartType: 'area',
    group: 'simple',
    timeout: 30000,
    variants: [
      {
        name: 'timeseries',
        config: { xField: '@timestamp', yField: 'value' },
        elasticConfig: {
          index: 'test-timeseries',
          aggregation: {
            bucketAgg: { type: 'date_histogram', field: '@timestamp', options: { interval: '1d' } },
            metrics: [{ type: 'sum', field: 'value' }]
          },
          useContext: true
        }
      }
    ]
  },
  {
    chartType: 'pie',
    group: 'simple',
    timeout: 30000,
    variants: [
      {
        name: 'basic',
        config: { categoryField: 'category', valueField: 'value' },
        elasticConfig: {
          index: 'test-categorical',
          aggregation: {
            bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 10 } },
            metrics: [{ type: 'sum', field: 'value' }]
          }
        }
      }
    ]
  },
  {
    chartType: 'donut',
    group: 'simple',
    timeout: 30000,
    variants: [
      {
        name: 'basic',
        config: { categoryField: 'category', valueField: 'value' },
        elasticConfig: {
          index: 'test-categorical',
          aggregation: {
            bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 10 } },
            metrics: [{ type: 'sum', field: 'value' }]
          }
        }
      }
    ]
  },
  {
    chartType: 'metric',
    group: 'simple',
    timeout: 30000,
    variants: [
      {
        name: 'single',
        config: { metric: 'sum', field: 'value', title: 'Total Value' },
        elasticConfig: {
          index: 'test-categorical',
          aggregation: {
            metrics: [{ type: 'sum', field: 'value' }]
          }
        }
      }
    ]
  },

  // ===== MEDIUM CHARTS (45s timeout, 4 concurrent) =====
  {
    chartType: 'scatter',
    group: 'medium',
    timeout: 45000,
    variants: [
      {
        name: 'basic',
        config: { xField: 'x', yField: 'y', colorField: 'category' },
        elasticConfig: {
          index: 'test-numeric',
          aggregation: {
            bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 100 } }
          }
        }
      }
    ]
  },
  {
    chartType: 'bubble',
    group: 'medium',
    timeout: 45000,
    variants: [
      {
        name: 'basic',
        config: { xField: 'x', yField: 'y', sizeField: 'size', colorField: 'category' },
        elasticConfig: {
          index: 'test-numeric',
          aggregation: {
            bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 100 } }
          }
        }
      }
    ]
  },
  {
    chartType: 'heatmap',
    group: 'medium',
    timeout: 45000,
    variants: [
      {
        name: 'basic',
        config: { xField: 'category', yField: 'subcategory', valueField: 'value' },
        elasticConfig: {
          index: 'test-categorical',
          aggregation: {
            bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 10 } },
            metrics: [{ type: 'avg', field: 'value' }]
          }
        }
      }
    ]
  },
  {
    chartType: 'histogram',
    group: 'medium',
    timeout: 45000,
    variants: [
      {
        name: 'basic',
        config: { field: 'value', bins: 20 },
        elasticConfig: {
          index: 'test-numeric',
          aggregation: {
            bucketAgg: { type: 'histogram', field: 'x', options: { interval: 5 } }
          }
        }
      }
    ]
  },
  {
    chartType: 'treemap',
    group: 'medium',
    timeout: 45000,
    variants: [
      {
        name: 'basic',
        config: { categoryField: 'category', valueField: 'value' },
        elasticConfig: {
          index: 'test-categorical',
          aggregation: {
            bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 20 } },
            metrics: [{ type: 'sum', field: 'value' }]
          }
        }
      }
    ]
  },

  // ===== COMPLEX CHARTS (60s timeout, 2 concurrent) =====
  {
    chartType: 'circle_packing',
    group: 'complex',
    timeout: 60000,
    variants: [
      {
        name: 'multi-level',
        config: { categoryField: 'subcategory', valueField: 'value', parentField: 'category' },
        elasticConfig: {
          index: 'test-categorical',
          aggregation: {
            bucketAggs: [
              { type: 'terms', field: 'category.keyword', options: { size: 10 } },
              { type: 'terms', field: 'subcategory.keyword', options: { size: 20 } }
            ],
            metrics: [{ type: 'sum', field: 'value' }]
          }
        }
      }
    ]
  },
  {
    chartType: 'sankey',
    group: 'complex',
    timeout: 60000,
    variants: [
      {
        name: 'basic',
        config: { sourceField: 'source', targetField: 'target', valueField: 'value' },
        elasticConfig: {
          index: 'test-flow',
          aggregation: {
            bucketAgg: { type: 'terms', field: 'source.keyword', options: { size: 50 } }
          }
        }
      }
    ]
  },
  {
    chartType: 'chord',
    group: 'complex',
    timeout: 60000,
    variants: [
      {
        name: 'basic',
        config: { sourceField: 'source', targetField: 'target', valueField: 'value' },
        elasticConfig: {
          index: 'test-flow',
          aggregation: {
            bucketAgg: { type: 'terms', field: 'source.keyword', options: { size: 50 } }
          }
        }
      }
    ]
  },
  {
    chartType: 'sunburst',
    group: 'complex',
    timeout: 60000,
    variants: [
      {
        name: 'hierarchy',
        config: { nameField: 'name', parentField: 'parent', valueField: 'value' },
        elasticConfig: {
          index: 'test-hierarchy',
          aggregation: {
            bucketAgg: { type: 'terms', field: 'parent.keyword', options: { size: 20 } },
            metrics: [{ type: 'sum', field: 'value' }]
          }
        }
      }
    ]
  },

  // ===== SPECIALIZED CHARTS (60s timeout, sequential) =====
  {
    chartType: 'dual_axis',
    group: 'specialized',
    timeout: 60000,
    variants: [
      {
        name: 'basic',
        config: {
          xField: '@timestamp',
          yLeftField: 'value',
          yRightField: 'metric'
        },
        elasticConfig: {
          index: 'test-timeseries',
          aggregation: {
            bucketAgg: { type: 'date_histogram', field: '@timestamp', options: { interval: '1d' } },
            metrics: [
              { type: 'avg', field: 'value' },
              { type: 'avg', field: 'metric' }
            ]
          },
          useContext: true
        }
      }
    ]
  },
  {
    chartType: 'waterfall',
    group: 'specialized',
    timeout: 60000,
    variants: [
      {
        name: 'basic',
        config: { categoryField: 'category', valueField: 'value' },
        elasticConfig: {
          index: 'test-categorical',
          aggregation: {
            bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 10 } },
            metrics: [{ type: 'sum', field: 'value' }]
          }
        }
      }
    ]
  },
  {
    chartType: 'bullet',
    group: 'specialized',
    timeout: 60000,
    variants: [
      {
        name: 'basic',
        config: {
          categoryField: 'category',
          valueField: 'value',
          targetValue: 100
        },
        elasticConfig: {
          index: 'test-categorical',
          aggregation: {
            bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 5 } },
            metrics: [{ type: 'avg', field: 'value' }]
          }
        }
      }
    ]
  },
  {
    chartType: 'streamgraph',
    group: 'specialized',
    timeout: 60000,
    variants: [
      {
        name: 'timeseries',
        config: { xField: '@timestamp', yField: 'value', colorField: 'category' },
        elasticConfig: {
          index: 'test-timeseries',
          aggregation: {
            bucketAgg: { type: 'date_histogram', field: '@timestamp', options: { interval: '1d' } },
            metrics: [{ type: 'sum', field: 'value' }]
          },
          useContext: true
        }
      }
    ]
  },
  {
    chartType: 'violin',
    group: 'specialized',
    timeout: 60000,
    variants: [
      {
        name: 'basic',
        config: { categoryField: 'category', valueField: 'value' },
        elasticConfig: {
          index: 'test-categorical',
          aggregation: {
            bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 10 } }
          }
        }
      }
    ]
  }
];

/**
 * Get test suites by group
 */
export function getTestSuitesByGroup(group) {
  return testSuites.filter(suite => suite.group === group);
}

/**
 * Get all chart types
 */
export function getAllChartTypes() {
  return testSuites.map(suite => suite.chartType);
}

/**
 * Get test suite for a specific chart type
 */
export function getTestSuite(chartType) {
  return testSuites.find(suite => suite.chartType === chartType);
}

/**
 * Get concurrency settings by group
 */
export function getConcurrencySettings() {
  return {
    simple: { concurrency: 6, timeout: 30000 },
    medium: { concurrency: 4, timeout: 45000 },
    complex: { concurrency: 2, timeout: 60000 },
    specialized: { concurrency: 1, timeout: 60000 }
  };
}

export default testSuites;
