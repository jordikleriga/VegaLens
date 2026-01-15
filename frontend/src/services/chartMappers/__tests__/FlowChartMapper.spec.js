import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { FlowChartMapper } from '../FlowChartMapper'

describe('FlowChartMapper', () => {
  let mapper
  let mockAxisState
  let mockVegaStore
  let mockAggregationStore

  beforeEach(() => {
    mockAxisState = ref({
      source: { field: 'from_country', options: { size: 25 } },
      target: { field: 'to_country' },
      value: { metric: 'sum', metricField: 'transfer_amount' }
    })

    mockVegaStore = {
      config: {},
      updateConfig: vi.fn()
    }

    mockAggregationStore = {
      currentConfig: { bucketAggs: [], metrics: [] },
      setBucketAggregation: vi.fn()
    }

    mapper = new FlowChartMapper(mockAxisState, mockVegaStore, 'sankey')
  })

  describe('Constructor', () => {
    it('should initialize with chart type', () => {
      expect(mapper.chartType).toBe('sankey')
      expect(mapper.axisState).toBe(mockAxisState)
      expect(mapper.vegaStore).toBe(mockVegaStore)
    })
  })

  describe('buildAggregationConfig', () => {
    it('should build multi_terms aggregation for source and target', async () => {
      await mapper.buildAggregationConfig(mockAggregationStore, {})

      expect(mockAggregationStore.setBucketAggregation).toHaveBeenCalledWith({
        type: 'multi_terms',
        field: 'from_country',
        options: {
          fields: ['from_country', 'to_country'],
          size: 25
        }
      })
    })

    it('should use default size when not specified', async () => {
      mockAxisState.value.source = { field: 'from_country' }

      await mapper.buildAggregationConfig(mockAggregationStore, {})

      expect(mockAggregationStore.setBucketAggregation).toHaveBeenCalledWith({
        type: 'multi_terms',
        field: 'from_country',
        options: {
          fields: ['from_country', 'to_country'],
          size: 25
        }
      })
    })

    it('should respect custom size option', async () => {
      mockAxisState.value.source.options.size = 50

      await mapper.buildAggregationConfig(mockAggregationStore, {})

      expect(mockAggregationStore.setBucketAggregation).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ size: 50 })
        })
      )
    })

    it('should not build aggregation if source field is missing', async () => {
      mockAxisState.value.source = null

      await mapper.buildAggregationConfig(mockAggregationStore, {})

      expect(mockAggregationStore.setBucketAggregation).not.toHaveBeenCalled()
    })

    it('should not build aggregation if target field is missing', async () => {
      mockAxisState.value.target = null

      await mapper.buildAggregationConfig(mockAggregationStore, {})

      expect(mockAggregationStore.setBucketAggregation).not.toHaveBeenCalled()
    })

    it('should not build aggregation if source field value is undefined', async () => {
      mockAxisState.value.source = { options: { size: 10 } }

      await mapper.buildAggregationConfig(mockAggregationStore, {})

      expect(mockAggregationStore.setBucketAggregation).not.toHaveBeenCalled()
    })

    it('should not build aggregation if target field value is undefined', async () => {
      mockAxisState.value.target = {}

      await mapper.buildAggregationConfig(mockAggregationStore, {})

      expect(mockAggregationStore.setBucketAggregation).not.toHaveBeenCalled()
    })

    it('should configure metric aggregation for non-count metrics', async () => {
      await mapper.buildAggregationConfig(mockAggregationStore, {})

      expect(mockAggregationStore.currentConfig.metrics).toEqual([
        {
          type: 'sum',
          field: 'transfer_amount',
          alias: ''
        }
      ])
    })

    it('should handle avg metric', async () => {
      mockAxisState.value.value = { metric: 'avg', metricField: 'amount' }

      await mapper.buildAggregationConfig(mockAggregationStore, {})

      expect(mockAggregationStore.currentConfig.metrics).toEqual([
        {
          type: 'avg',
          field: 'amount',
          alias: ''
        }
      ])
    })

    it('should handle max metric', async () => {
      mockAxisState.value.value = { metric: 'max', metricField: 'price' }

      await mapper.buildAggregationConfig(mockAggregationStore, {})

      expect(mockAggregationStore.currentConfig.metrics).toEqual([
        {
          type: 'max',
          field: 'price',
          alias: ''
        }
      ])
    })

    it('should skip count metrics', async () => {
      mockAxisState.value.value = { metric: 'count' }

      await mapper.buildAggregationConfig(mockAggregationStore, {})

      expect(mockAggregationStore.currentConfig.metrics).toEqual([])
    })

    it('should skip metrics without metricField', async () => {
      mockAxisState.value.value = { metric: 'avg' }

      await mapper.buildAggregationConfig(mockAggregationStore, {})

      expect(mockAggregationStore.currentConfig.metrics).toEqual([])
    })

    it('should not add metrics if value axis is missing', async () => {
      mockAxisState.value.value = null

      await mapper.buildAggregationConfig(mockAggregationStore, {})

      // Metrics should remain empty (initialized in beforeEach)
      expect(mockAggregationStore.currentConfig.metrics).toEqual([])
    })
  })

  describe('mapFieldsToConfig', () => {
    const fields = ['from_country', 'to_country', 'sum_transfer_amount', '_count']

    it('should map source field to config', () => {
      mapper.mapFieldsToConfig([], fields)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('sourceField', 'from_country')
    })

    it('should map target field to config', () => {
      mapper.mapFieldsToConfig([], fields)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('targetField', 'to_country')
    })

    it('should map value field for sum metric', () => {
      mapper.mapFieldsToConfig([], fields)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('valueField', 'sum_transfer_amount')
    })

    it('should map count metric to _count', () => {
      mockAxisState.value.value = { metric: 'count' }

      mapper.mapFieldsToConfig([], fields)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('valueField', '_count')
    })

    it('should handle nested field paths for source', () => {
      mockAxisState.value.source.field = 'geo.country.from'
      const fieldsWithNested = ['geo_country_from', 'to_country', '_count']

      mapper.mapFieldsToConfig([], fieldsWithNested)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('sourceField', 'geo_country_from')
    })

    it('should handle nested field paths for target', () => {
      mockAxisState.value.target.field = 'geo.country.to'
      const fieldsWithNested = ['from_country', 'geo_country_to', '_count']

      mapper.mapFieldsToConfig([], fieldsWithNested)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('targetField', 'geo_country_to')
    })

    it('should skip source mapping if field not in axis state', () => {
      mockAxisState.value.source = null

      mapper.mapFieldsToConfig([], fields)

      expect(mockVegaStore.updateConfig).not.toHaveBeenCalledWith(
        'sourceField',
        expect.anything()
      )
    })

    it('should skip target mapping if field not in axis state', () => {
      mockAxisState.value.target = null

      mapper.mapFieldsToConfig([], fields)

      expect(mockVegaStore.updateConfig).not.toHaveBeenCalledWith(
        'targetField',
        expect.anything()
      )
    })

    it('should skip value mapping if metric not in axis state', () => {
      mockAxisState.value.value = null

      mapper.mapFieldsToConfig([], fields)

      expect(mockVegaStore.updateConfig).not.toHaveBeenCalledWith(
        'valueField',
        expect.anything()
      )
    })

    it('should skip source mapping if field not found in data', () => {
      mockAxisState.value.source.field = 'unknown_source'

      mapper.mapFieldsToConfig([], fields)

      expect(mockVegaStore.updateConfig).not.toHaveBeenCalledWith(
        'sourceField',
        expect.anything()
      )
    })

    it('should skip target mapping if field not found in data', () => {
      mockAxisState.value.target.field = 'unknown_target'

      mapper.mapFieldsToConfig([], fields)

      expect(mockVegaStore.updateConfig).not.toHaveBeenCalledWith(
        'targetField',
        expect.anything()
      )
    })

    it('should skip value mapping if metric field not found', () => {
      mockAxisState.value.value = { metric: 'avg', metricField: 'unknown_metric' }

      mapper.mapFieldsToConfig([], fields)

      expect(mockVegaStore.updateConfig).not.toHaveBeenCalledWith(
        'valueField',
        expect.anything()
      )
    })

    it('should handle avg metric field mapping', () => {
      mockAxisState.value.value = { metric: 'avg', metricField: 'transfer_amount' }
      const fieldsWithAvg = ['from_country', 'to_country', 'avg_transfer_amount', '_count']

      mapper.mapFieldsToConfig([], fieldsWithAvg)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('valueField', 'avg_transfer_amount')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty axis state', () => {
      mockAxisState.value = {}

      const fields = ['from_country', 'to_country', '_count']
      mapper.mapFieldsToConfig([], fields)

      // Should not throw, and should not map any fields
      expect(mockVegaStore.updateConfig).not.toHaveBeenCalled()
    })

    it('should handle chord diagram chart type', () => {
      const chordMapper = new FlowChartMapper(mockAxisState, mockVegaStore, 'chord')

      expect(chordMapper.chartType).toBe('chord')
    })

    it('should handle empty fields array', () => {
      mapper.mapFieldsToConfig([], [])

      // Should not map any fields when fields array is empty
      expect(mockVegaStore.updateConfig).not.toHaveBeenCalled()
    })

    it('should handle partial axis state', async () => {
      mockAxisState.value = {
        source: { field: 'from' }
        // Missing target and value
      }

      await mapper.buildAggregationConfig(mockAggregationStore, {})

      // Should not build aggregation with missing target
      expect(mockAggregationStore.setBucketAggregation).not.toHaveBeenCalled()
    })

    it('should use default size when size is 0 (falsy)', async () => {
      mockAxisState.value.source.options.size = 0

      await mapper.buildAggregationConfig(mockAggregationStore, {})

      // 0 is falsy, so it falls back to default 25
      expect(mockAggregationStore.setBucketAggregation).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ size: 25 })
        })
      )
    })
  })

  describe('Integration with BaseChartMapper', () => {
    it('should inherit resolveDataField from BaseChartMapper', () => {
      const fields = ['products_category', 'sales']

      // Test that BaseChartMapper's resolveDataField works
      const resolved = mapper.resolveDataField('products.category', fields)

      expect(resolved).toBe('products_category')
    })

    it('should inherit mapMetricField from BaseChartMapper', () => {
      const fields = ['from', 'to', 'avg_amount', '_count']

      const resolved = mapper.mapMetricField('avg', 'amount', fields)

      expect(resolved).toBe('avg_amount')
    })
  })
})
