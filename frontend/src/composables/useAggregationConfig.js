/**
 * Aggregation Configuration Composable
 *
 * Provides utilities for building Elasticsearch aggregation configurations.
 * Handles default options, interval types, and proper configuration for
 * different aggregation types (terms, date_histogram, histogram).
 *
 * @returns {Object} Aggregation configuration utilities
 */
export function useAggregationConfig() {

  /**
   * Get default options for an aggregation type
   * @param {string} type - Aggregation type (terms, date_histogram, histogram)
   * @returns {Object} Default options object
   */
  function getDefaultOptions(type) {
    switch (type) {
      case 'terms':
        return { size: 25, order: 'desc' }
      case 'date_histogram':
        return {
          interval: 'day',
          intervalType: 'calendar',
          format: "yyyy-MM-dd'T'HH:mm:ss",
          minDocCount: 0,
          timeZone: 'UTC'
        }
      case 'histogram':
        return { interval: 10, minDocCount: 0 }
      default:
        return {}
    }
  }

  /**
   * Determine if an interval is calendar or fixed type
   * @param {string} interval - Interval value
   * @returns {string} 'calendar' or 'fixed'
   */
  function getIntervalType(interval) {
    const calendarIntervals = ['minute', 'hour', 'day', 'week', 'month', 'quarter', 'year']
    if (calendarIntervals.includes(interval)) {
      return 'calendar'
    }
    // Fixed intervals are like: 1s, 5s, 1m, 5m, 1h, etc.
    if (/^\d+[smhd]$/.test(interval)) {
      return 'fixed'
    }
    return 'calendar' // default
  }

  /**
   * Build properly configured bucket aggregation options
   * Ensures date_histogram, histogram, and terms all have correct options
   * Includes Kibana-style ordering options (orderBy, orderDirection, orderMetric)
   *
   * @param {Object} bucketState - Current bucket axis state
   * @param {number} defaultSize - Default size for terms aggregations
   * @returns {Object|null} Aggregation configuration object
   */
  function buildBucketAggConfig(bucketState, defaultSize = 25) {
    if (!bucketState?.field) return null

    const aggType = bucketState.aggregation || 'terms'
    let options = { ...(bucketState.options || {}) }

    // Apply proper defaults based on aggregation type
    if (aggType === 'date_histogram') {
      // Ensure all date_histogram required options are set
      if (!options.interval) {
        options.interval = 'day'
      }
      options.intervalType = getIntervalType(options.interval)
      if (!options.format) {
        options.format = "yyyy-MM-dd'T'HH:mm:ss"
      }
      if (options.minDocCount === undefined) {
        options.minDocCount = 0
      }
      if (!options.timeZone) {
        options.timeZone = 'UTC'
      }
    } else if (aggType === 'histogram') {
      // Histogram needs interval
      if (!options.interval) {
        options.interval = 10
      }
      if (options.minDocCount === undefined) {
        options.minDocCount = 0
      }
    } else {
      // terms, multi_terms - ensure size is set
      if (!options.size) {
        options.size = defaultSize
      }
    }

    // Build the config with order options for Kibana-style ranking
    const config = {
      type: aggType,
      field: bucketState.field,
      options,
      // Order configuration
      orderBy: options.orderBy || '_count',
      orderDirection: options.orderDirection || 'desc'
    }

    // If ordering by custom metric, include the metric config
    if (options.orderBy === 'custom_metric') {
      if (options.orderMetricType && options.orderMetricField) {
        config.orderMetric = {
          type: options.orderMetricType,
          field: options.orderMetricField
        }
      }
      // Also pass through the individual options for backend compatibility
      config.options.orderMetricType = options.orderMetricType
      config.options.orderMetricField = options.orderMetricField
    }

    // Debug: log the built config with ordering
    if (config.orderBy !== '_count' || config.orderDirection !== 'desc') {
      console.log('[useAggregationConfig] Bucket config with ordering:', {
        field: config.field,
        orderBy: config.orderBy,
        orderDirection: config.orderDirection,
        orderMetric: config.orderMetric
      })
    }

    return config
  }

  return {
    getDefaultOptions,
    getIntervalType,
    buildBucketAggConfig
  }
}
