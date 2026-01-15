import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { SingleValueMapper } from '../SingleValueMapper'

describe('SingleValueMapper', () => {
  let mapper
  let mockAxisState
  let mockVegaStore
  let mockAggregationStore
  let mockElasticStore
  let mockApi
  let mockEmit
  let mockIsLoading
  let mockError

  beforeEach(() => {
    mockAxisState = ref({
      y: { metric: 'sum', metricField: 'total_sales' }
    })

    mockVegaStore = {
      config: {},
      updateConfig: vi.fn()
    }

    mockAggregationStore = {
      currentConfig: { bucketAggs: [], metrics: [] },
      setBucketAggregation: vi.fn(),
      setAggregatedData: vi.fn(),
      executeAggregation: vi.fn().mockResolvedValue({
        data: [{ _id: 'dummy', sum_total_sales: 123456 }]
      })
    }

    mockElasticStore = {
      currentIndex: 'test_index'
    }

    mockApi = {
      get: vi.fn().mockResolvedValue({
        data: { total: 5000 }
      })
    }

    mockEmit = vi.fn()
    mockIsLoading = ref(false)
    mockError = ref(null)

    mapper = new SingleValueMapper(mockAxisState, mockVegaStore, 'metric')
  })

  describe('Constructor', () => {
    it('should initialize with chart type', () => {
      expect(mapper.chartType).toBe('metric')
      expect(mapper.axisState).toBe(mockAxisState)
      expect(mapper.vegaStore).toBe(mockVegaStore)
    })

    it('should handle gauge chart type', () => {
      const gaugeMapper = new SingleValueMapper(mockAxisState, mockVegaStore, 'gauge')

      expect(gaugeMapper.chartType).toBe('gauge')
    })
  })

  describe('buildAggregationConfig - Count Metric', () => {
    beforeEach(() => {
      mockAxisState.value.y = { metric: 'count' }
    })

    it('should fetch document count using sample endpoint', async () => {
      const result = await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockApi.get).toHaveBeenCalledWith('/elastic/indices/test_index/sample', {
        params: { size: 1 }
      })
      expect(result).toBe(true) // Indicates handled execution
    })

    it('should set aggregated data with count', async () => {
      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockAggregationStore.setAggregatedData).toHaveBeenCalledWith([{ _count: 5000 }])
    })

    it('should map count field to config', async () => {
      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('valueField', '_count')
    })

    it('should emit data-updated event with count data', async () => {
      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockEmit).toHaveBeenCalledWith('data-updated', [{ _count: 5000 }])
    })

    it('should handle zero count', async () => {
      mockApi.get.mockResolvedValue({ data: { total: 0 } })

      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockAggregationStore.setAggregatedData).toHaveBeenCalledWith([{ _count: 0 }])
    })

    it('should handle missing total in response', async () => {
      mockApi.get.mockResolvedValue({ data: {} })

      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockAggregationStore.setAggregatedData).toHaveBeenCalledWith([{ _count: 0 }])
    })

    it('should set isLoading during fetch', async () => {
      let loadingDuringFetch = false

      mockApi.get.mockImplementation(() => {
        loadingDuringFetch = mockIsLoading.value
        return Promise.resolve({ data: { total: 100 } })
      })

      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(loadingDuringFetch).toBe(true)
      expect(mockIsLoading.value).toBe(false) // Should be reset after
    })
  })

  describe('buildAggregationConfig - Other Metrics', () => {
    it('should set up dummy bucket aggregation for sum metric', async () => {
      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockAggregationStore.setBucketAggregation).toHaveBeenCalledWith({
        type: 'terms',
        field: '_index',
        options: { size: 1 }
      })
    })

    it('should configure metric aggregation for sum', async () => {
      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockAggregationStore.currentConfig.metrics).toEqual([{
        type: 'sum',
        field: 'total_sales',
        alias: ''
      }])
    })

    it('should execute aggregation', async () => {
      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockAggregationStore.executeAggregation).toHaveBeenCalledWith('test_index')
    })

    it('should map metric field to config', async () => {
      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('valueField', 'sum_total_sales')
    })

    it('should emit data-updated with aggregation result', async () => {
      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockEmit).toHaveBeenCalledWith('data-updated', [
        { _id: 'dummy', sum_total_sales: 123456 }
      ])
    })

    it('should handle avg metric', async () => {
      mockAxisState.value.y = { metric: 'avg', metricField: 'price' }
      mockAggregationStore.executeAggregation.mockResolvedValue({
        data: [{ _id: 'dummy', avg_price: 99.99 }]
      })

      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockAggregationStore.currentConfig.metrics).toEqual([{
        type: 'avg',
        field: 'price',
        alias: ''
      }])
    })

    it('should handle max metric', async () => {
      mockAxisState.value.y = { metric: 'max', metricField: 'temperature' }

      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockAggregationStore.currentConfig.metrics).toEqual([{
        type: 'max',
        field: 'temperature',
        alias: ''
      }])
    })

    it('should handle min metric', async () => {
      mockAxisState.value.y = { metric: 'min', metricField: 'price' }

      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockAggregationStore.currentConfig.metrics).toEqual([{
        type: 'min',
        field: 'price',
        alias: ''
      }])
    })

    it('should not execute if no metricField specified', async () => {
      mockAxisState.value.y = { metric: 'sum' } // Missing metricField

      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockAggregationStore.executeAggregation).not.toHaveBeenCalled()
    })

    it('should handle empty aggregation result', async () => {
      mockAggregationStore.executeAggregation.mockResolvedValue({
        data: []
      })

      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      // Should not emit or map fields when no data
      expect(mockEmit).not.toHaveBeenCalled()
      expect(mockVegaStore.updateConfig).not.toHaveBeenCalled()
    })

    it('should set isLoading during execution', async () => {
      let loadingDuringExecution = false

      mockAggregationStore.executeAggregation.mockImplementation(() => {
        loadingDuringExecution = mockIsLoading.value
        return Promise.resolve({ data: [{ _id: 'dummy', sum_total_sales: 100 }] })
      })

      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(loadingDuringExecution).toBe(true)
      expect(mockIsLoading.value).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle count API error', async () => {
      mockAxisState.value.y = { metric: 'count' }
      const apiError = new Error('Network error')
      apiError.response = { data: { message: 'Connection failed' } }
      mockApi.get.mockRejectedValue(apiError)

      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockError.value).toBe('Connection failed')
      expect(mockIsLoading.value).toBe(false)
    })

    it('should handle aggregation execution error', async () => {
      const execError = new Error('Aggregation failed')
      execError.response = { data: { message: 'Invalid field' } }
      mockAggregationStore.executeAggregation.mockRejectedValue(execError)

      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockError.value).toBe('Invalid field')
      expect(mockIsLoading.value).toBe(false)
    })

    it('should handle error without response object', async () => {
      mockAxisState.value.y = { metric: 'count' }
      mockApi.get.mockRejectedValue(new Error('Generic error'))

      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockError.value).toBe('Generic error')
    })

    it('should reset isLoading even on error', async () => {
      mockAxisState.value.y = { metric: 'count' }
      mockApi.get.mockRejectedValue(new Error('Error'))

      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(mockIsLoading.value).toBe(false)
    })
  })

  describe('mapFieldsToConfig', () => {
    it('should map count metric to _count field', () => {
      mockAxisState.value.y = { metric: 'count' }

      mapper.mapFieldsToConfig([{ _count: 100 }], ['_count'])

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('valueField', '_count')
    })

    it('should map sum metric field', () => {
      mockAxisState.value.y = { metric: 'sum', metricField: 'sales' }

      mapper.mapFieldsToConfig([{ sum_sales: 1000 }], ['sum_sales'])

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('valueField', 'sum_sales')
    })

    it('should map avg metric field', () => {
      mockAxisState.value.y = { metric: 'avg', metricField: 'price' }

      mapper.mapFieldsToConfig([{ avg_price: 50.5 }], ['avg_price'])

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('valueField', 'avg_price')
    })

    it('should not map if metricField not found in fields', () => {
      mockAxisState.value.y = { metric: 'sum', metricField: 'unknown' }

      mapper.mapFieldsToConfig([{ sum_sales: 100 }], ['sum_sales'])

      expect(mockVegaStore.updateConfig).not.toHaveBeenCalled()
    })

    it('should not map if metric state is missing', () => {
      mockAxisState.value.y = null

      mapper.mapFieldsToConfig([{ value: 100 }], ['value'])

      expect(mockVegaStore.updateConfig).not.toHaveBeenCalled()
    })

    it('should not map if metricField is missing for non-count metric', () => {
      mockAxisState.value.y = { metric: 'sum' }

      mapper.mapFieldsToConfig([{ sum_value: 100 }], ['sum_value'])

      expect(mockVegaStore.updateConfig).not.toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('should handle null metric state', async () => {
      mockAxisState.value.y = null

      const result = await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      // Should complete without error
      expect(result).toBe(true)
      expect(mockIsLoading.value).toBe(false)
    })

    it('should handle undefined metric state', async () => {
      mockAxisState.value = {}

      const result = await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(result).toBe(true)
      expect(mockIsLoading.value).toBe(false)
    })

    it('should handle empty data array in mapFieldsToConfig', () => {
      mapper.mapFieldsToConfig([], [])

      // Should not throw
      expect(mockVegaStore.updateConfig).not.toHaveBeenCalled()
    })

    it('should return true to indicate handled execution', async () => {
      const result = await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        vi.fn(),
        mockApi,
        mockEmit,
        mockIsLoading,
        mockError
      )

      expect(result).toBe(true)
    })
  })

  describe('Integration with BaseChartMapper', () => {
    it('should inherit mapMetricField from BaseChartMapper', () => {
      const fields = ['sum_sales', 'avg_price', '_count']

      const resolved = mapper.mapMetricField('sum', 'sales', fields)

      expect(resolved).toBe('sum_sales')
    })

    it('should use mapMetricField in mapFieldsToConfig', () => {
      mockAxisState.value.y = { metric: 'avg', metricField: 'revenue' }
      const fields = ['avg_revenue', '_count']

      mapper.mapFieldsToConfig([{ avg_revenue: 999 }], fields)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('valueField', 'avg_revenue')
    })
  })
})
