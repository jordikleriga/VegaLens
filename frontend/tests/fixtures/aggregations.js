/**
 * Aggregation Response Fixtures
 *
 * Mock Elasticsearch aggregation responses for testing
 */

export const mockTermsAggregationResponse = {
  took: 5,
  timed_out: false,
  _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
  hits: { total: { value: 4675, relation: 'eq' }, max_score: null, hits: [] },
  aggregations: {
    primary: {
      doc_count_error_upper_bound: 0,
      sum_other_doc_count: 0,
      buckets: [
        { key: 'Electronics', doc_count: 150 },
        { key: 'Clothing', doc_count: 200 },
        { key: 'Accessories', doc_count: 175 }
      ]
    }
  }
}

export const mockTermsWithMetricResponse = {
  took: 8,
  timed_out: false,
  aggregations: {
    primary: {
      buckets: [
        { key: 'Electronics', doc_count: 150, avg_price: { value: 299.99 } },
        { key: 'Clothing', doc_count: 200, avg_price: { value: 49.99 } },
        { key: 'Accessories', doc_count: 175, avg_price: { value: 24.99 } }
      ]
    }
  }
}

export const mockDateHistogramResponse = {
  took: 6,
  timed_out: false,
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

export const mockMultiLevelBucketResponse = {
  took: 12,
  timed_out: false,
  aggregations: {
    level_0: {
      buckets: [
        {
          key: 'North',
          doc_count: 250,
          level_1: {
            buckets: [
              { key: 'Electronics', doc_count: 100 },
              { key: 'Clothing', doc_count: 150 }
            ]
          }
        },
        {
          key: 'South',
          doc_count: 225,
          level_1: {
            buckets: [
              { key: 'Electronics', doc_count: 50 },
              { key: 'Clothing', doc_count: 175 }
            ]
          }
        }
      ]
    }
  }
}

export const mockTransformedData = [
  { category: 'Electronics', _count: 150 },
  { category: 'Clothing', _count: 200 },
  { category: 'Accessories', _count: 175 }
]

export const mockTransformedDataWithMetrics = [
  { category: 'Electronics', _count: 150, avg_price: 299.99 },
  { category: 'Clothing', _count: 200, avg_price: 49.99 },
  { category: 'Accessories', _count: 175, avg_price: 24.99 }
]

export const mockMultiLevelTransformedData = [
  { _composite_key: 'North > Electronics', region: 'North', category: 'Electronics', _count: 100 },
  { _composite_key: 'North > Clothing', region: 'North', category: 'Clothing', _count: 150 },
  { _composite_key: 'South > Electronics', region: 'South', category: 'Electronics', _count: 50 },
  { _composite_key: 'South > Clothing', region: 'South', category: 'Clothing', _count: 175 }
]
