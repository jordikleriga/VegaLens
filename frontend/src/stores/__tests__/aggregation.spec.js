import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAggregationStore } from '../aggregation'
import api from '@/services/api'

// Mock the API
vi.mock('@/services/api')

describe('Aggregation Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const store = useAggregationStore()

      expect(store.currentConfig).toEqual({
        bucketAgg: null,
        bucketAggs: [],
        metrics: [],
        splitBy: null,
        splitConfig: {
          enabled: false,
          type: 'series',
          field: null,
          maxBuckets: 5,
          columns: 3
        },
        query: null
      })
      expect(store.aggregatedData).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.error).toBe(null)
    })

    it('should have predefined color schemes', () => {
      const store = useAggregationStore()

      expect(store.colorSchemes).toBeDefined()
      expect(store.colorSchemes.categorical).toBeDefined()
      expect(store.colorSchemes.sequential).toBeDefined()
      expect(store.colorSchemes.diverging).toBeDefined()
    })

    it('should have preset colors array', () => {
      const store = useAggregationStore()

      expect(store.presetColors).toBeDefined()
      expect(Array.isArray(store.presetColors)).toBe(true)
      expect(store.presetColors.length).toBeGreaterThan(0)
    })
  })

  describe('Bucket Level Management', () => {
    it('should add a new bucket level', () => {
      const store = useAggregationStore()

      store.addBucketLevel({
        field: 'category',
        type: 'terms',
        options: { size: 10 }
      })

      expect(store.currentConfig.bucketAggs).toHaveLength(1)
      expect(store.currentConfig.bucketAggs[0].field).toBe('category')
      expect(store.currentConfig.bucketAggs[0].type).toBe('terms')
      expect(store.currentConfig.bucketAggs[0].orderBy).toBe('_count')
      expect(store.currentConfig.bucketAggs[0].orderDirection).toBe('desc')
    })

    it('should support multi-level buckets', () => {
      const store = useAggregationStore()

      // First level
      store.addBucketLevel({ field: 'region', type: 'terms' })
      // Second level
      store.addBucketLevel({ field: 'category', type: 'terms' })

      expect(store.currentConfig.bucketAggs).toHaveLength(2)
      expect(store.isMultiLevel).toBe(true)
      expect(store.currentConfig.bucketAggs[0].field).toBe('region')
      expect(store.currentConfig.bucketAggs[1].field).toBe('category')
    })

    it('should remove bucket level by index', () => {
      const store = useAggregationStore()
      store.addBucketLevel({ field: 'region', type: 'terms' })
      store.addBucketLevel({ field: 'category', type: 'terms' })

      store.removeBucketLevel(0)

      expect(store.currentConfig.bucketAggs).toHaveLength(1)
      expect(store.currentConfig.bucketAggs[0].field).toBe('category')
    })

    it('should update bucket level configuration', () => {
      const store = useAggregationStore()
      store.addBucketLevel({
        field: 'region',
        type: 'terms',
        options: { size: 10 }
      })

      store.updateBucketLevel(0, {
        options: { size: 20, orderBy: '_count' }
      })

      expect(store.currentConfig.bucketAggs[0].options.size).toBe(20)
    })

    it('should reorder bucket levels', () => {
      const store = useAggregationStore()
      store.addBucketLevel({ field: 'region', type: 'terms' })
      store.addBucketLevel({ field: 'category', type: 'terms' })
      store.addBucketLevel({ field: 'subcategory', type: 'terms' })

      store.reorderBucketLevels(2, 0)

      expect(store.currentConfig.bucketAggs[0].field).toBe('subcategory')
      expect(store.currentConfig.bucketAggs[1].field).toBe('region')
      expect(store.currentConfig.bucketAggs[2].field).toBe('category')
    })
  })

  describe('Legacy Bucket Aggregation (Backward Compatibility)', () => {
    it('should set single bucket aggregation', () => {
      const store = useAggregationStore()

      store.setBucketAggregation({
        field: 'category',
        type: 'terms'
      })

      expect(store.currentConfig.bucketAgg).toBeDefined()
      expect(store.currentConfig.bucketAgg.field).toBe('category')
      expect(store.currentConfig.bucketAggs).toHaveLength(1)
    })

    it('should sync bucketAgg to bucketAggs array', () => {
      const store = useAggregationStore()

      store.setBucketAggregation({
        field: 'category',
        type: 'terms'
      })

      expect(store.currentConfig.bucketAggs[0]).toEqual(store.currentConfig.bucketAgg)
    })

    it('should preserve sub-groupings when updating primary bucket', () => {
      const store = useAggregationStore()

      // Set up multi-level
      store.addBucketLevel({ field: 'region', type: 'terms' })
      store.addBucketLevel({ field: 'category', type: 'terms' })

      // Update primary bucket via legacy method
      store.setBucketAggregation({ field: 'country', type: 'terms' })

      expect(store.currentConfig.bucketAggs).toHaveLength(2)
      expect(store.currentConfig.bucketAggs[0].field).toBe('country')
      expect(store.currentConfig.bucketAggs[1].field).toBe('category')
    })

    it('should clear bucketAggs when setting null', () => {
      const store = useAggregationStore()
      store.addBucketLevel({ field: 'category', type: 'terms' })

      store.setBucketAggregation(null)

      expect(store.currentConfig.bucketAgg).toBe(null)
      expect(store.currentConfig.bucketAggs).toEqual([])
    })
  })

  describe('Computed Properties', () => {
    it('should calculate hasAggregation correctly', () => {
      const store = useAggregationStore()

      expect(store.hasAggregation).toBe(false)

      store.addBucketLevel({ field: 'category', type: 'terms' })

      expect(store.hasAggregation).toBe(true)
    })

    it('should calculate hasAggregation from legacy bucketAgg', () => {
      const store = useAggregationStore()

      expect(store.hasAggregation).toBe(false)

      store.currentConfig.bucketAgg = { field: 'category', type: 'terms' }

      expect(store.hasAggregation).toBe(true)
    })

    it('should calculate isMultiLevel correctly', () => {
      const store = useAggregationStore()

      expect(store.isMultiLevel).toBe(false)

      store.addBucketLevel({ field: 'region', type: 'terms' })
      expect(store.isMultiLevel).toBe(false)

      store.addBucketLevel({ field: 'category', type: 'terms' })
      expect(store.isMultiLevel).toBe(true)
    })

    it('should return effectiveBucketAggs from bucketAggs array', () => {
      const store = useAggregationStore()

      store.addBucketLevel({ field: 'category', type: 'terms' })
      store.addBucketLevel({ field: 'subcategory', type: 'terms' })

      expect(store.effectiveBucketAggs).toHaveLength(2)
      expect(store.effectiveBucketAggs[0].field).toBe('category')
    })

    it('should return effectiveBucketAggs from legacy bucketAgg', () => {
      const store = useAggregationStore()

      store.currentConfig.bucketAgg = { field: 'category', type: 'terms' }
      store.currentConfig.bucketAggs = []

      expect(store.effectiveBucketAggs).toHaveLength(1)
      expect(store.effectiveBucketAggs[0].field).toBe('category')
    })
  })

  describe('API Integration', () => {
    it('should fetch aggregation types', async () => {
      const store = useAggregationStore()
      const mockTypes = {
        bucket: ['terms', 'date_histogram', 'histogram'],
        metric: ['avg', 'sum', 'min', 'max', 'count']
      }

      api.get.mockResolvedValue({ data: mockTypes })

      await store.fetchAggregationTypes()

      expect(api.get).toHaveBeenCalledWith('/aggregations/types')
      expect(store.aggregationTypes).toEqual(mockTypes)
    })

    it('should handle fetchAggregationTypes error', async () => {
      const store = useAggregationStore()

      api.get.mockRejectedValue(new Error('Network error'))

      await store.fetchAggregationTypes()

      expect(store.error).toBe('Network error')
    })

    it('should fetch date intervals', async () => {
      const store = useAggregationStore()
      const mockIntervals = ['1m', '5m', '1h', '1d']

      api.get.mockResolvedValue({ data: mockIntervals })

      await store.fetchDateIntervals()

      expect(api.get).toHaveBeenCalledWith('/aggregations/date-intervals')
      expect(store.dateIntervals).toEqual(mockIntervals)
    })

    it('should execute aggregation successfully', async () => {
      const store = useAggregationStore()
      const mockData = [
        { category: 'A', _count: 100 },
        { category: 'B', _count: 200 }
      ]

      store.setBucketAggregation({ field: 'category', type: 'terms' })

      api.post.mockResolvedValue({
        data: {
          data: mockData
        }
      })

      const result = await store.executeAggregation('test_index')

      expect(api.post).toHaveBeenCalledWith('/aggregations/execute', {
        index: 'test_index',
        config: store.currentConfig
      })
      expect(store.aggregatedData).toEqual(mockData)
      expect(result.data).toEqual(mockData)
      expect(store.loading).toBe(false)
    })

    it('should handle aggregation execution error', async () => {
      const store = useAggregationStore()

      store.setBucketAggregation({ field: 'category', type: 'terms' })

      const errorMessage = 'Field not found'
      api.post.mockRejectedValue({
        response: { data: { message: errorMessage } }
      })

      await expect(store.executeAggregation('test_index')).rejects.toThrow()
      expect(store.error).toBe(errorMessage)
      expect(store.loading).toBe(false)
    })

    it('should return early if no bucket aggregation configured', async () => {
      const store = useAggregationStore()

      const result = await store.executeAggregation('test_index')

      expect(result.data).toEqual([])
      expect(api.post).not.toHaveBeenCalled()
    })

    it('should preview query', async () => {
      const store = useAggregationStore()
      const mockQuery = {
        size: 0,
        aggs: {
          primary: {
            terms: { field: 'category' }
          }
        }
      }

      store.setBucketAggregation({ field: 'category', type: 'terms' })

      api.post.mockResolvedValue({ data: mockQuery })

      const result = await store.previewQuery('test_index')

      expect(api.post).toHaveBeenCalledWith('/aggregations/preview-query', {
        index: 'test_index',
        config: store.currentConfig
      })
      expect(result).toEqual(mockQuery)
    })
  })

  describe('Metrics Management', () => {
    it('should add metrics to configuration', () => {
      const store = useAggregationStore()

      store.currentConfig.metrics = [
        { type: 'avg', field: 'price', alias: 'avg_price' }
      ]

      expect(store.currentConfig.metrics).toHaveLength(1)
      expect(store.currentConfig.metrics[0].type).toBe('avg')
    })

    it('should support multiple metrics', () => {
      const store = useAggregationStore()

      store.currentConfig.metrics = [
        { type: 'sum', field: 'quantity', alias: 'total_qty' },
        { type: 'avg', field: 'price', alias: 'avg_price' },
        { type: 'max', field: 'price', alias: 'max_price' }
      ]

      expect(store.currentConfig.metrics).toHaveLength(3)
    })
  })

  describe('Split Configuration', () => {
    it('should configure series split', () => {
      const store = useAggregationStore()

      store.currentConfig.splitConfig = {
        enabled: true,
        type: 'series',
        field: 'region',
        maxBuckets: 10,
        columns: 3
      }

      expect(store.currentConfig.splitConfig.enabled).toBe(true)
      expect(store.currentConfig.splitConfig.type).toBe('series')
    })

    it('should configure chart split (small multiples)', () => {
      const store = useAggregationStore()

      store.currentConfig.splitConfig = {
        enabled: true,
        type: 'chart',
        field: 'region',
        maxBuckets: 6,
        columns: 2
      }

      expect(store.currentConfig.splitConfig.type).toBe('chart')
      expect(store.currentConfig.splitConfig.columns).toBe(2)
    })
  })
})
