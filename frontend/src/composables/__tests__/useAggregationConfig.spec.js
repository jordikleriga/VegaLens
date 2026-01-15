import { describe, it, expect } from 'vitest'
import { useAggregationConfig } from '../useAggregationConfig'

describe('useAggregationConfig', () => {
  describe('getDefaultOptions', () => {
    it('should return default options for terms aggregation', () => {
      const { getDefaultOptions } = useAggregationConfig()

      const options = getDefaultOptions('terms')

      expect(options).toEqual({
        size: 25,
        order: 'desc'
      })
    })

    it('should return default options for date_histogram', () => {
      const { getDefaultOptions } = useAggregationConfig()

      const options = getDefaultOptions('date_histogram')

      expect(options).toEqual({
        interval: 'day',
        intervalType: 'calendar',
        format: "yyyy-MM-dd'T'HH:mm:ss",
        minDocCount: 0,
        timeZone: 'UTC'
      })
    })

    it('should return default options for histogram', () => {
      const { getDefaultOptions } = useAggregationConfig()

      const options = getDefaultOptions('histogram')

      expect(options).toEqual({
        interval: 10,
        minDocCount: 0
      })
    })

    it('should return empty object for unknown type', () => {
      const { getDefaultOptions } = useAggregationConfig()

      const options = getDefaultOptions('unknown_type')

      expect(options).toEqual({})
    })

    it('should return empty object when no type provided', () => {
      const { getDefaultOptions } = useAggregationConfig()

      const options = getDefaultOptions()

      expect(options).toEqual({})
    })
  })

  describe('getIntervalType', () => {
    it('should identify calendar intervals', () => {
      const { getIntervalType } = useAggregationConfig()

      expect(getIntervalType('minute')).toBe('calendar')
      expect(getIntervalType('hour')).toBe('calendar')
      expect(getIntervalType('day')).toBe('calendar')
      expect(getIntervalType('week')).toBe('calendar')
      expect(getIntervalType('month')).toBe('calendar')
      expect(getIntervalType('quarter')).toBe('calendar')
      expect(getIntervalType('year')).toBe('calendar')
    })

    it('should identify fixed intervals with seconds', () => {
      const { getIntervalType } = useAggregationConfig()

      expect(getIntervalType('1s')).toBe('fixed')
      expect(getIntervalType('5s')).toBe('fixed')
      expect(getIntervalType('30s')).toBe('fixed')
    })

    it('should identify fixed intervals with minutes', () => {
      const { getIntervalType } = useAggregationConfig()

      expect(getIntervalType('1m')).toBe('fixed')
      expect(getIntervalType('5m')).toBe('fixed')
      expect(getIntervalType('15m')).toBe('fixed')
    })

    it('should identify fixed intervals with hours', () => {
      const { getIntervalType } = useAggregationConfig()

      expect(getIntervalType('1h')).toBe('fixed')
      expect(getIntervalType('6h')).toBe('fixed')
      expect(getIntervalType('12h')).toBe('fixed')
    })

    it('should identify fixed intervals with days', () => {
      const { getIntervalType } = useAggregationConfig()

      expect(getIntervalType('1d')).toBe('fixed')
      expect(getIntervalType('7d')).toBe('fixed')
    })

    it('should default to calendar for invalid formats', () => {
      const { getIntervalType } = useAggregationConfig()

      expect(getIntervalType('invalid')).toBe('calendar')
      expect(getIntervalType('1')).toBe('calendar')
      expect(getIntervalType('abc')).toBe('calendar')
    })

    it('should handle edge cases', () => {
      const { getIntervalType } = useAggregationConfig()

      expect(getIntervalType('')).toBe('calendar')
      expect(getIntervalType(null)).toBe('calendar')
      expect(getIntervalType(undefined)).toBe('calendar')
    })
  })

  describe('buildBucketAggConfig', () => {
    describe('Terms Aggregation', () => {
      it('should build basic terms aggregation config', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'category',
          aggregation: 'terms'
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config).toEqual({
          type: 'terms',
          field: 'category',
          options: {
            size: 25
          },
          orderBy: '_count',
          orderDirection: 'desc'
        })
      })

      it('should use custom size when provided', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'category',
          aggregation: 'terms',
          options: {
            size: 50
          }
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.options.size).toBe(50)
      })

      it('should use defaultSize parameter', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'category',
          aggregation: 'terms'
        }

        const config = buildBucketAggConfig(bucketState, 100)

        expect(config.options.size).toBe(100)
      })

      it('should include custom ordering options', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'category',
          aggregation: 'terms',
          options: {
            size: 10,
            orderBy: '_key',
            orderDirection: 'asc'
          }
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.orderBy).toBe('_key')
        expect(config.orderDirection).toBe('asc')
      })

      it('should handle custom metric ordering', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'category',
          aggregation: 'terms',
          options: {
            size: 10,
            orderBy: 'custom_metric',
            orderMetricType: 'avg',
            orderMetricField: 'price'
          }
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.orderBy).toBe('custom_metric')
        expect(config.orderMetric).toEqual({
          type: 'avg',
          field: 'price'
        })
        expect(config.options.orderMetricType).toBe('avg')
        expect(config.options.orderMetricField).toBe('price')
      })

      it('should not include orderMetric if orderBy is not custom_metric', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'category',
          aggregation: 'terms',
          options: {
            orderBy: '_count',
            orderMetricType: 'avg',
            orderMetricField: 'price'
          }
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.orderMetric).toBeUndefined()
      })
    })

    describe('Date Histogram Aggregation', () => {
      it('should build date_histogram with default options', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'timestamp',
          aggregation: 'date_histogram'
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.type).toBe('date_histogram')
        expect(config.field).toBe('timestamp')
        expect(config.options.interval).toBe('day')
        expect(config.options.intervalType).toBe('calendar')
        expect(config.options.format).toBe("yyyy-MM-dd'T'HH:mm:ss")
        expect(config.options.minDocCount).toBe(0)
        expect(config.options.timeZone).toBe('UTC')
      })

      it('should use custom interval', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'timestamp',
          aggregation: 'date_histogram',
          options: {
            interval: 'week'
          }
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.options.interval).toBe('week')
        expect(config.options.intervalType).toBe('calendar')
      })

      it('should detect fixed interval type', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'timestamp',
          aggregation: 'date_histogram',
          options: {
            interval: '1h'
          }
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.options.intervalType).toBe('fixed')
      })

      it('should use custom format', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'timestamp',
          aggregation: 'date_histogram',
          options: {
            interval: 'month',
            format: 'yyyy-MM'
          }
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.options.format).toBe('yyyy-MM')
      })

      it('should use custom timezone', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'timestamp',
          aggregation: 'date_histogram',
          options: {
            interval: 'day',
            timeZone: 'America/New_York'
          }
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.options.timeZone).toBe('America/New_York')
      })

      it('should preserve custom minDocCount', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'timestamp',
          aggregation: 'date_histogram',
          options: {
            interval: 'day',
            minDocCount: 1
          }
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.options.minDocCount).toBe(1)
      })

      it('should include ordering options', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'timestamp',
          aggregation: 'date_histogram',
          options: {
            interval: 'day',
            orderBy: '_key',
            orderDirection: 'asc'
          }
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.orderBy).toBe('_key')
        expect(config.orderDirection).toBe('asc')
      })
    })

    describe('Histogram Aggregation', () => {
      it('should build histogram with default options', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'price',
          aggregation: 'histogram'
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.type).toBe('histogram')
        expect(config.field).toBe('price')
        expect(config.options.interval).toBe(10)
        expect(config.options.minDocCount).toBe(0)
      })

      it('should use custom interval', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'price',
          aggregation: 'histogram',
          options: {
            interval: 50
          }
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.options.interval).toBe(50)
      })

      it('should use custom minDocCount', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'price',
          aggregation: 'histogram',
          options: {
            interval: 100,
            minDocCount: 5
          }
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.options.minDocCount).toBe(5)
      })
    })

    describe('Edge Cases and Validation', () => {
      it('should return null when no field provided', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          aggregation: 'terms'
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config).toBe(null)
      })

      it('should return null when bucketState is null', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const config = buildBucketAggConfig(null)

        expect(config).toBe(null)
      })

      it('should return null when bucketState is undefined', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const config = buildBucketAggConfig(undefined)

        expect(config).toBe(null)
      })

      it('should default to terms aggregation when type not specified', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'category'
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.type).toBe('terms')
        expect(config.options.size).toBe(25)
      })

      it('should preserve additional options', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'category',
          aggregation: 'terms',
          options: {
            size: 10,
            customOption: 'value',
            anotherOption: 123
          }
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.options.customOption).toBe('value')
        expect(config.options.anotherOption).toBe(123)
      })

      it('should handle missing options object', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'category',
          aggregation: 'terms'
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.options).toBeDefined()
        expect(config.options.size).toBe(25)
      })

      it('should handle multi_terms aggregation like terms', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'category',
          aggregation: 'multi_terms'
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.type).toBe('multi_terms')
        expect(config.options.size).toBe(25)
      })
    })

    describe('Order Configuration', () => {
      it('should include default ordering when not specified', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'category',
          aggregation: 'terms'
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.orderBy).toBe('_count')
        expect(config.orderDirection).toBe('desc')
      })

      it('should support ordering by _key', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'category',
          aggregation: 'terms',
          options: {
            orderBy: '_key',
            orderDirection: 'asc'
          }
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.orderBy).toBe('_key')
        expect(config.orderDirection).toBe('asc')
      })

      it('should support ordering by custom metric', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'category',
          aggregation: 'terms',
          options: {
            orderBy: 'custom_metric',
            orderMetricType: 'sum',
            orderMetricField: 'quantity',
            orderDirection: 'desc'
          }
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.orderBy).toBe('custom_metric')
        expect(config.orderMetric).toEqual({
          type: 'sum',
          field: 'quantity'
        })
        expect(config.orderDirection).toBe('desc')
      })

      it('should not create orderMetric if metric type missing', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'category',
          aggregation: 'terms',
          options: {
            orderBy: 'custom_metric',
            orderMetricField: 'price'
            // orderMetricType missing
          }
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.orderMetric).toBeUndefined()
      })

      it('should not create orderMetric if metric field missing', () => {
        const { buildBucketAggConfig } = useAggregationConfig()

        const bucketState = {
          field: 'category',
          aggregation: 'terms',
          options: {
            orderBy: 'custom_metric',
            orderMetricType: 'avg'
            // orderMetricField missing
          }
        }

        const config = buildBucketAggConfig(bucketState)

        expect(config.orderMetric).toBeUndefined()
      })
    })
  })
})
