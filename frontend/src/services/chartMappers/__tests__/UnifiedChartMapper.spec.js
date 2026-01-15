import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { UnifiedChartMapper } from '../UnifiedChartMapper'

describe('UnifiedChartMapper', () => {
  let mapper
  let mockAxisState
  let mockVegaStore
  let mockAggregationStore
  let mockElasticStore
  let mockAxisConfig

  beforeEach(() => {
    mockAxisState = ref({
      x: { field: 'category', aggregation: 'terms' },
      y: { field: 'price', metric: 'avg', metricField: 'price' }
    })

    mockVegaStore = {
      config: {},
      updateConfig: vi.fn()
    }

    mockAggregationStore = {
      currentConfig: { bucketAggs: [], metrics: [] },
      setBucketAggregation: vi.fn(),
      addBucketLevel: vi.fn()
    }

    mockElasticStore = {}

    mockAxisConfig = {
      bar: [
        { id: 'x', fieldType: 'bucket', required: true, configKey: 'xField' },
        { id: 'y', fieldType: 'metric', required: true, configKey: 'yField' },
        { id: 'color', fieldType: 'bucket', required: false, configKey: 'colorField' }
      ]
    }

    mapper = new UnifiedChartMapper(mockAxisState, mockVegaStore, 'bar', mockAxisConfig)
  })

  describe('Constructor', () => {
    it('should initialize with axis configuration', () => {
      expect(mapper.axisConfig).toBe(mockAxisConfig)
      expect(mapper.chartType).toBe('bar')
    })
  })

  describe('buildAggregationConfig', () => {
    const buildBucketAggConfig = vi.fn((state) => {
      if (!state) return null
      return {
        type: state.aggregation || 'terms',
        field: state.field,
        options: { size: 10 }
      }
    })

    it('should build bucket aggregation for primary axis', async () => {
      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        buildBucketAggConfig
      )

      expect(buildBucketAggConfig).toHaveBeenCalledWith(mockAxisState.value.x)
      expect(mockAggregationStore.setBucketAggregation).toHaveBeenCalledWith({
        type: 'terms',
        field: 'category',
        options: { size: 10 }
      })
    })

    it('should handle missing bucket axis', async () => {
      mockAxisState.value.x = null

      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        buildBucketAggConfig
      )

      expect(mockAggregationStore.setBucketAggregation).not.toHaveBeenCalled()
    })

    it('should configure metric aggregations', async () => {
      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        buildBucketAggConfig
      )

      expect(mockAggregationStore.currentConfig.metrics).toEqual([
        { type: 'avg', field: 'price', alias: '' }
      ])
    })

    it('should skip count metrics', async () => {
      mockAxisState.value.y = { metric: 'count' }

      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        buildBucketAggConfig
      )

      expect(mockAggregationStore.currentConfig.metrics).toEqual([])
    })

    it('should handle color splits as secondary bucket', async () => {
      mockAxisState.value.color = { field: 'region', aggregation: 'terms' }
      mockAggregationStore.currentConfig.bucketAggs = [{ field: 'category' }]

      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        buildBucketAggConfig
      )

      expect(mockAggregationStore.addBucketLevel).toHaveBeenCalledWith({
        field: 'region',
        type: 'terms',
        options: { size: 10 }
      })
    })

    it('should not add color split if already multi-level', async () => {
      mockAxisState.value.color = { field: 'region' }
      mockAggregationStore.currentConfig.bucketAggs = [
        { field: 'category' },
        { field: 'product' }
      ]

      await mapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        buildBucketAggConfig
      )

      expect(mockAggregationStore.addBucketLevel).not.toHaveBeenCalled()
    })
  })

  describe('mapFieldsToConfig', () => {
    const availableFields = ['category', 'avg_price', '_count']

    it('should map bucket field to config', () => {
      mapper.mapFieldsToConfig([], availableFields, mockAggregationStore)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('xField', 'category')
    })

    it('should map metric field to config', () => {
      mapper.mapFieldsToConfig([], availableFields, mockAggregationStore)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('yField', 'avg_price')
    })

    it('should skip axes without configKey', () => {
      mockAxisConfig.bar.push({ id: 'test', fieldType: 'bucket' })

      mapper.mapFieldsToConfig([], availableFields, mockAggregationStore)

      // Only xField and yField should be mapped (color has no state)
      expect(mockVegaStore.updateConfig).toHaveBeenCalledTimes(2)
    })

    it('should skip already mapped fields', () => {
      mockVegaStore.config = { xField: 'existing' }

      mapper.mapFieldsToConfig([], availableFields, mockAggregationStore)

      // Only yField should be mapped (xField already exists)
      expect(mockVegaStore.updateConfig).toHaveBeenCalledTimes(1)
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('yField', 'avg_price')
    })

    it('should use composite key for multi-level buckets', () => {
      mockAggregationStore.currentConfig.bucketAggs = [
        { field: 'category' },
        { field: 'region' }
      ]

      const fieldsWithComposite = ['_composite_key', 'avg_price', '_count']

      mapper.mapFieldsToConfig([], fieldsWithComposite, mockAggregationStore)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('xField', '_composite_key')
    })

    it('should use _split_count when available for count metric', () => {
      mockAxisState.value.y = { metric: 'count' }

      const fieldsWithSplit = ['category', '_split_count', '_count']

      mapper.mapFieldsToConfig([], fieldsWithSplit, mockAggregationStore)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('yField', '_split_count')
    })

    it('should fallback to _count when _split_count not available', () => {
      mockAxisState.value.y = { metric: 'count' }

      mapper.mapFieldsToConfig([], availableFields, mockAggregationStore)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('yField', '_count')
    })

    it('should handle numeric fieldType', () => {
      mockAxisConfig.bar[0].fieldType = 'numeric'

      mapper.mapFieldsToConfig([], availableFields, mockAggregationStore)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('xField', 'category')
    })

    it('should handle any fieldType', () => {
      mockAxisConfig.bar[0].fieldType = 'any'

      mapper.mapFieldsToConfig([], availableFields, mockAggregationStore)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('xField', 'category')
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing axis config for chart type', async () => {
      const invalidMapper = new UnifiedChartMapper(
        mockAxisState,
        mockVegaStore,
        'unknown_chart',
        mockAxisConfig
      )

      await expect(
        invalidMapper.buildAggregationConfig(mockAggregationStore, mockElasticStore, vi.fn())
      ).resolves.not.toThrow()
    })

    it('should handle empty axis state', () => {
      mockAxisState.value = {}

      mapper.mapFieldsToConfig([], ['category'], mockAggregationStore)

      expect(mockVegaStore.updateConfig).not.toHaveBeenCalled()
    })

    it('should handle missing metricField', () => {
      mockAxisState.value.y = { metric: 'avg' }

      mapper.mapFieldsToConfig([], ['category', '_count'], mockAggregationStore)

      // Only xField should be mapped (yField missing metricField)
      expect(mockVegaStore.updateConfig).toHaveBeenCalledTimes(1)
    })
  })

  describe('Multi-Dimensional Charts (Heatmap)', () => {
    let heatmapAxisConfig

    beforeEach(() => {
      heatmapAxisConfig = {
        heatmap: [
          { id: 'x', name: 'Columns', fieldType: 'bucket', required: true, configKey: 'xField' },
          { id: 'y', name: 'Rows', fieldType: 'bucket', required: true, configKey: 'yField' },
          { id: 'color', name: 'Intensity', fieldType: 'metric', required: true, configKey: 'valueField' }
        ]
      }
    })

    it('should build two-level bucket aggregation for heatmap', async () => {
      const heatmapMapper = new UnifiedChartMapper(mockAxisState, mockVegaStore, 'heatmap', heatmapAxisConfig)

      mockAxisState.value = {
        x: { field: 'day', aggregation: 'terms' },
        y: { field: 'hour', aggregation: 'terms' },
        color: { metric: 'count' }
      }

      const buildBucketAggConfig = vi.fn((state) => {
        if (!state) return null
        return {
          type: state.aggregation || 'terms',
          field: state.field,
          options: { size: 10 }
        }
      })

      await heatmapMapper.buildAggregationConfig(
        mockAggregationStore,
        mockElasticStore,
        buildBucketAggConfig
      )

      // Should set primary bucket (X-axis)
      expect(mockAggregationStore.setBucketAggregation).toHaveBeenCalledWith({
        type: 'terms',
        field: 'day',
        options: { size: 10 }
      })

      // Should add second bucket level (Y-axis)
      expect(mockAggregationStore.addBucketLevel).toHaveBeenCalledWith({
        type: 'terms',
        field: 'hour',
        options: { size: 10 }
      })
    })

    it('should map each bucket axis to its own field', () => {
      const heatmapMapper = new UnifiedChartMapper(mockAxisState, mockVegaStore, 'heatmap', heatmapAxisConfig)

      mockAxisState.value = {
        x: { field: 'day' },
        y: { field: 'hour' },
        color: { metric: 'count' }
      }

      // Simulate two-level bucket aggregation
      mockAggregationStore.currentConfig.bucketAggs = [
        { field: 'day', type: 'terms' },
        { field: 'hour', type: 'terms' }
      ]

      const fields = ['day', 'hour', '_count']

      heatmapMapper.mapFieldsToConfig([], fields, mockAggregationStore)

      // X-axis should map to first bucket field (day)
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('xField', 'day')

      // Y-axis should map to second bucket field (hour)
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('yField', 'hour')

      // Color should map to count
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('valueField', '_count')
    })

    it('should not use composite key for multi-dimensional charts', () => {
      const heatmapMapper = new UnifiedChartMapper(mockAxisState, mockVegaStore, 'heatmap', heatmapAxisConfig)

      mockAxisState.value = {
        x: { field: 'day' },
        y: { field: 'hour' },
        color: { metric: 'count' }
      }

      mockAggregationStore.currentConfig.bucketAggs = [
        { field: 'day', type: 'terms' },
        { field: 'hour', type: 'terms' }
      ]

      const fields = ['day', 'hour', '_composite_key', '_count']

      heatmapMapper.mapFieldsToConfig([], fields, mockAggregationStore)

      // Should NOT use composite key (each axis maps to its own field)
      expect(mockVegaStore.updateConfig).not.toHaveBeenCalledWith('xField', '_composite_key')
      expect(mockVegaStore.updateConfig).not.toHaveBeenCalledWith('yField', '_composite_key')

      // Should map to individual fields
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('xField', 'day')
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('yField', 'hour')
    })
  })

  describe('Metric Field Re-mapping', () => {
    it('should re-map metric field when data changes from count to avg', () => {
      // First mapping with count
      mockAxisState.value.y = { metric: 'count' }
      mapper.mapFieldsToConfig([], ['category', '_count'], mockAggregationStore)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('xField', 'category')
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('yField', '_count')

      // Simulate config being set
      mockVegaStore.config = { xField: 'category', yField: '_count' }
      mockVegaStore.updateConfig.mockClear()

      // Change to avg metric with new data
      mockAxisState.value.y = { metric: 'avg', metricField: 'price' }
      mapper.mapFieldsToConfig([], ['category', 'avg_price'], mockAggregationStore)

      // Should NOT re-map bucket field (already set)
      expect(mockVegaStore.updateConfig).not.toHaveBeenCalledWith('xField', expect.anything())

      // Should re-map metric field to new value
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('yField', 'avg_price')
    })

    it('should re-map metric field when data changes from avg to max', () => {
      // Start with avg
      mockAxisState.value.y = { metric: 'avg', metricField: 'price' }
      mockVegaStore.config = { xField: 'category', yField: 'avg_price' }
      mockVegaStore.updateConfig.mockClear()

      // Change to max
      mockAxisState.value.y = { metric: 'max', metricField: 'price' }
      mapper.mapFieldsToConfig([], ['category', 'max_price'], mockAggregationStore)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('yField', 'max_price')
      expect(mockVegaStore.updateConfig).toHaveBeenCalledTimes(1) // Only yField
    })

    it('should preserve bucket field when metric changes', () => {
      // Initial mapping
      mockVegaStore.config = { xField: 'category', yField: '_count' }
      mockVegaStore.updateConfig.mockClear()

      // Change metric
      mockAxisState.value.y = { metric: 'sum', metricField: 'quantity' }
      mapper.mapFieldsToConfig([], ['category', 'sum_quantity'], mockAggregationStore)

      // xField should not be updated (already set to 'category')
      const xFieldCalls = mockVegaStore.updateConfig.mock.calls.filter(
        call => call[0] === 'xField'
      )
      expect(xFieldCalls).toHaveLength(0)
    })
  })

  describe('SplitBy Charts (Streamgraph, Area with Series)', () => {
    let streamgraphAxisConfig

    beforeEach(() => {
      streamgraphAxisConfig = {
        streamgraph: [
          { id: 'x', name: 'X-Axis', fieldType: 'bucket', required: true, configKey: 'xField' },
          { id: 'y', name: 'Y-Axis', fieldType: 'metric', required: true, configKey: 'yField' },
          { id: 'color', name: 'Stack By', fieldType: 'bucket', required: true, configKey: 'colorField' }
        ]
      }
    })

    it('should map color axis from splitBy field', () => {
      const streamgraphMapper = new UnifiedChartMapper(mockAxisState, mockVegaStore, 'streamgraph', streamgraphAxisConfig)

      mockAxisState.value = {
        x: { field: 'category.keyword' },
        y: { metric: 'avg', metricField: 'products.base_price' },
        color: { field: 'day_of_week' }
      }

      mockAggregationStore.currentConfig.bucketAggs = [{
        type: 'terms',
        field: 'category.keyword',
        options: { size: 10 }
      }]

      mockAggregationStore.currentConfig.splitBy = {
        type: 'terms',
        field: 'day_of_week',
        options: { size: 15 }
      }

      const fields = ['_count', 'category_keyword', 'avg_products_base_price', 'day_of_week', '_split_count']

      streamgraphMapper.mapFieldsToConfig([], fields, mockAggregationStore)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('xField', 'category_keyword')
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('yField', 'avg_products_base_price')
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('colorField', 'day_of_week')
    })

    it('should handle splitBy with underscore conversion', () => {
      const streamgraphMapper = new UnifiedChartMapper(mockAxisState, mockVegaStore, 'streamgraph', streamgraphAxisConfig)

      mockAxisState.value = {
        x: { field: 'timestamp' },
        y: { metric: 'count' },
        color: { field: 'geoip.country_name' } // Nested field
      }

      mockAggregationStore.currentConfig.bucketAggs = [{
        type: 'date_histogram',
        field: 'timestamp',
        options: { calendarInterval: '1d' }
      }]

      mockAggregationStore.currentConfig.splitBy = {
        type: 'terms',
        field: 'geoip.country_name',
        options: { size: 10 }
      }

      const fields = ['timestamp', '_count', 'geoip_country_name', '_split_count']

      streamgraphMapper.mapFieldsToConfig([], fields, mockAggregationStore)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('xField', 'timestamp')
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('yField', '_split_count')
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('colorField', 'geoip_country_name')
    })

    it('should map facet axis from splitBy field (Trellis Area)', () => {
      const trellisAxisConfig = {
        trellis_area: [
          { id: 'x', name: 'X-Axis', fieldType: 'bucket', required: true, configKey: 'xField' },
          { id: 'y', name: 'Y-Axis', fieldType: 'metric', required: true, configKey: 'yField' },
          { id: 'facet', name: 'Facet By', fieldType: 'bucket', required: true, configKey: 'facetField' }
        ]
      }

      const trellisMapper = new UnifiedChartMapper(mockAxisState, mockVegaStore, 'trellis_area', trellisAxisConfig)

      mockAxisState.value = {
        x: { field: 'category.keyword' },
        y: { metric: 'count' },
        facet: { field: 'day_of_week' }
      }

      mockAggregationStore.currentConfig.bucketAggs = [{
        type: 'terms',
        field: 'category.keyword',
        options: { size: 10 }
      }]

      mockAggregationStore.currentConfig.splitBy = {
        type: 'terms',
        field: 'day_of_week',
        options: { size: 7 }
      }

      const fields = ['_count', 'category_keyword', 'day_of_week', '_split_count']

      trellisMapper.mapFieldsToConfig([], fields, mockAggregationStore)

      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('xField', 'category_keyword')
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('yField', '_split_count')
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('facetField', 'day_of_week')
    })
  })

  describe('Multi-Terms Aggregation (Comet)', () => {
    let cometAxisConfig

    beforeEach(() => {
      cometAxisConfig = {
        comet: [
          { id: 'category', name: 'Category', fieldType: 'bucket', required: true, configKey: 'categoryField' },
          { id: 'time', name: 'State Field', fieldType: 'bucket', required: true, configKey: 'timeField' },
          { id: 'value', name: 'Value', fieldType: 'metric', required: true, configKey: 'valueField' }
        ]
      }
    })

    it('should handle multi_terms aggregation mapping', () => {
      const cometMapper = new UnifiedChartMapper(mockAxisState, mockVegaStore, 'comet', cometAxisConfig)

      mockAxisState.value = {
        category: { field: 'category.keyword' },
        time: { field: 'customer_gender' },
        value: { metric: 'sum', metricField: 'products.base_unit_price' }
      }

      // Simulate multi_terms aggregation
      mockAggregationStore.currentConfig.bucketAggs = [{
        type: 'multi_terms',
        field: 'category.keyword',
        options: {
          fields: ['category.keyword', 'customer_gender'],
          size: 25
        }
      }]

      const fields = ['category_keyword', 'customer_gender', '_key', 'sum_products_base_unit_price', '_count']

      cometMapper.mapFieldsToConfig([], fields, mockAggregationStore)

      // Category should map to first field from multi_terms
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('categoryField', 'category_keyword')

      // Time should map to second field from multi_terms
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('timeField', 'customer_gender')

      // Value should map to metric field
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('valueField', 'sum_products_base_unit_price')
    })

    it('should not use composite key for multi_terms', () => {
      const cometMapper = new UnifiedChartMapper(mockAxisState, mockVegaStore, 'comet', cometAxisConfig)

      mockAxisState.value = {
        category: { field: 'category.keyword' },
        time: { field: 'customer_gender' },
        value: { metric: 'count' }
      }

      mockAggregationStore.currentConfig.bucketAggs = [{
        type: 'multi_terms',
        field: 'category.keyword',
        options: {
          fields: ['category.keyword', 'customer_gender']
        }
      }]

      const fields = ['category_keyword', 'customer_gender', '_composite_key', '_count']

      cometMapper.mapFieldsToConfig([], fields, mockAggregationStore)

      // Should NOT use composite key (each axis maps to its own field from multi_terms)
      expect(mockVegaStore.updateConfig).not.toHaveBeenCalledWith('categoryField', '_composite_key')
      expect(mockVegaStore.updateConfig).not.toHaveBeenCalledWith('timeField', '_composite_key')

      // Should map to individual fields
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('categoryField', 'category_keyword')
      expect(mockVegaStore.updateConfig).toHaveBeenCalledWith('timeField', 'customer_gender')
    })
  })
})
