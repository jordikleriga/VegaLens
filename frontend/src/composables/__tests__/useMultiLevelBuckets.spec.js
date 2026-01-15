import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useMultiLevelBuckets } from '../useMultiLevelBuckets'
import { useAggregationStore } from '@/stores/aggregation'
import { useElasticStore } from '@/stores/elastic'
import { useVegaStore } from '@/stores/vega'

describe('useMultiLevelBuckets', () => {
  let aggregationStore
  let elasticStore
  let vegaStore
  let onUpdateMock

  beforeEach(() => {
    setActivePinia(createPinia())
    aggregationStore = useAggregationStore()
    elasticStore = useElasticStore()
    vegaStore = useVegaStore()
    onUpdateMock = vi.fn()
  })

  describe('supportsMultiLevelBuckets', () => {
    it('should return true for supported chart types', () => {
      const supportedTypes = ['bar', 'line', 'area', 'pie', 'donut', 'treemap', 'sunburst']

      supportedTypes.forEach(type => {
        vegaStore.selectedType = type

        const { supportsMultiLevelBuckets } = useMultiLevelBuckets(
          aggregationStore,
          elasticStore,
          vegaStore,
          onUpdateMock
        )

        expect(supportsMultiLevelBuckets.value).toBe(true)
      })
    })

    it('should return false for unsupported chart types', () => {
      vegaStore.selectedType = 'unsupported_type'

      const { supportsMultiLevelBuckets } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      expect(supportsMultiLevelBuckets.value).toBe(false)
    })

    it('should support all priority chart types', () => {
      const priorityTypes = [
        // P1
        'scatter', 'bubble',
        // P2
        'heatmap', 'boxplot', 'histogram', 'funnel', 'sankey',
        // P3
        'radial', 'pareto', 'radar', 'violin', 'waterfall',
        // P4
        'chord', 'streamgraph', 'circle_packing', 'gauge', 'dual_axis'
      ]

      priorityTypes.forEach(type => {
        vegaStore.selectedType = type

        const { supportsMultiLevelBuckets } = useMultiLevelBuckets(
          aggregationStore,
          elasticStore,
          vegaStore,
          onUpdateMock
        )

        expect(supportsMultiLevelBuckets.value).toBe(true)
      })
    })
  })

  describe('additionalBucketLevels', () => {
    it('should return empty array when no bucket aggs exist', () => {
      aggregationStore.currentConfig.bucketAggs = []

      const { additionalBucketLevels } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      expect(additionalBucketLevels.value).toEqual([])
    })

    it('should return empty array when only primary bucket exists', () => {
      aggregationStore.currentConfig.bucketAggs = [
        { field: 'region', type: 'terms', options: { size: 10 } }
      ]

      const { additionalBucketLevels } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      expect(additionalBucketLevels.value).toEqual([])
    })

    it('should return additional buckets beyond the primary', () => {
      aggregationStore.currentConfig.bucketAggs = [
        { field: 'region', type: 'terms', options: { size: 10 } },
        { field: 'category', type: 'terms', options: { size: 5 } },
        { field: 'product', type: 'terms', options: { size: 3 } }
      ]

      const { additionalBucketLevels } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      expect(additionalBucketLevels.value).toHaveLength(2)
      expect(additionalBucketLevels.value[0].field).toBe('category')
      expect(additionalBucketLevels.value[1].field).toBe('product')
    })

    it('should handle undefined bucketAggs', () => {
      aggregationStore.currentConfig.bucketAggs = undefined

      const { additionalBucketLevels } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      expect(additionalBucketLevels.value).toEqual([])
    })
  })

  describe('subGroupFields', () => {
    beforeEach(() => {
      // Set fields ref, not the computed aggregatableFields
      elasticStore.fields = [
        { name: 'region', type: 'keyword', category: 'keyword', aggregatable: true },
        { name: 'category', type: 'keyword', category: 'keyword', aggregatable: true },
        { name: 'product', type: 'keyword', category: 'keyword', aggregatable: true },
        { name: 'timestamp', type: 'date', category: 'date', aggregatable: true },
        { name: 'price', type: 'float', category: 'numeric', aggregatable: true }
      ]
    })

    it('should return all aggregatable fields when none are used', () => {
      aggregationStore.currentConfig.bucketAggs = []

      const { subGroupFields } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      expect(subGroupFields.value).toHaveLength(5)
    })

    it('should exclude fields already used in bucket aggregations', () => {
      aggregationStore.currentConfig.bucketAggs = [
        { field: 'region', type: 'terms' }
      ]

      const { subGroupFields } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      expect(subGroupFields.value).toHaveLength(4)
      expect(subGroupFields.value.find(f => f.name === 'region')).toBeUndefined()
    })

    it('should filter fields by search term', () => {
      aggregationStore.currentConfig.bucketAggs = []

      const { subGroupFields, subGroupSearch } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      subGroupSearch.value = 'cat'

      expect(subGroupFields.value).toHaveLength(1)
      expect(subGroupFields.value[0].name).toBe('category')
    })

    it('should filter case-insensitively', () => {
      aggregationStore.currentConfig.bucketAggs = []

      const { subGroupFields, subGroupSearch } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      subGroupSearch.value = 'REG'

      expect(subGroupFields.value).toHaveLength(1)
      expect(subGroupFields.value[0].name).toBe('region')
    })

    it('should return empty array when search has no matches', () => {
      aggregationStore.currentConfig.bucketAggs = []

      const { subGroupFields, subGroupSearch } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      subGroupSearch.value = 'nonexistent'

      expect(subGroupFields.value).toHaveLength(0)
    })

    it('should handle empty aggregatable fields', () => {
      elasticStore.fields = []

      const { subGroupFields } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      expect(subGroupFields.value).toEqual([])
    })
  })

  describe('isPrimaryBucketAxis', () => {
    it('should identify the first required bucket axis as primary', () => {
      const chartAxes = [
        { id: 'x', fieldType: 'bucket', required: true },
        { id: 'y', fieldType: 'metric', required: true },
        { id: 'color', fieldType: 'bucket', required: false }
      ]

      const { isPrimaryBucketAxis } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      expect(isPrimaryBucketAxis(chartAxes[0], chartAxes)).toBe(true)
      expect(isPrimaryBucketAxis(chartAxes[1], chartAxes)).toBe(false)
      expect(isPrimaryBucketAxis(chartAxes[2], chartAxes)).toBe(false)
    })

    it('should return falsy when no required bucket axis exists', () => {
      const chartAxes = [
        { id: 'x', fieldType: 'metric', required: true },
        { id: 'y', fieldType: 'metric', required: true }
      ]

      const { isPrimaryBucketAxis } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      expect(isPrimaryBucketAxis(chartAxes[0], chartAxes)).toBeFalsy()
    })

    it('should handle optional bucket axes correctly', () => {
      const chartAxes = [
        { id: 'x', fieldType: 'metric', required: true },
        { id: 'y', fieldType: 'metric', required: true },
        { id: 'split', fieldType: 'bucket', required: false }
      ]

      const { isPrimaryBucketAxis } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      expect(isPrimaryBucketAxis(chartAxes[2], chartAxes)).toBeFalsy()
    })
  })

  describe('addBucketLevel', () => {
    it('should add a terms aggregation for keyword field', () => {
      const field = { name: 'category', type: 'keyword', category: 'keyword' }

      const { addBucketLevel } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      addBucketLevel(field)

      expect(aggregationStore.currentConfig.bucketAggs).toHaveLength(1)
      expect(aggregationStore.currentConfig.bucketAggs[0]).toMatchObject({
        field: 'category',
        type: 'terms',
        options: { size: 10 },
        orderBy: '_count',
        orderDirection: 'desc',
        orderMetric: null
      })
      expect(aggregationStore.currentConfig.bucketAggs[0].id).toBeDefined()
    })

    it('should add a date_histogram aggregation for date field', () => {
      const field = { name: 'timestamp', type: 'date', category: 'date' }

      const { addBucketLevel } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      addBucketLevel(field)

      expect(aggregationStore.currentConfig.bucketAggs).toHaveLength(1)
      expect(aggregationStore.currentConfig.bucketAggs[0]).toMatchObject({
        field: 'timestamp',
        type: 'date_histogram',
        options: { size: 10 },
        orderBy: '_count',
        orderDirection: 'desc',
        orderMetric: null
      })
      expect(aggregationStore.currentConfig.bucketAggs[0].id).toBeDefined()
    })

    it('should close the sub-group picker after adding', () => {
      const field = { name: 'category', type: 'keyword', category: 'keyword' }

      const { addBucketLevel, showSubGroupPicker } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      showSubGroupPicker.value = true
      addBucketLevel(field)

      expect(showSubGroupPicker.value).toBe(false)
    })

    it('should clear search after adding', () => {
      const field = { name: 'category', type: 'keyword', category: 'keyword' }

      const { addBucketLevel, subGroupSearch } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      subGroupSearch.value = 'test search'
      addBucketLevel(field)

      expect(subGroupSearch.value).toBe('')
    })

    it('should call onUpdate callback if provided', () => {
      const field = { name: 'category', type: 'keyword', category: 'keyword' }

      const { addBucketLevel } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      addBucketLevel(field)

      expect(onUpdateMock).toHaveBeenCalledTimes(1)
    })

    it('should not throw if onUpdate is not provided', () => {
      const field = { name: 'category', type: 'keyword', category: 'keyword' }

      const { addBucketLevel } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        null // No callback
      )

      expect(() => addBucketLevel(field)).not.toThrow()
    })
  })

  describe('removeBucketLevel', () => {
    beforeEach(() => {
      aggregationStore.currentConfig.bucketAggs = [
        { field: 'region', type: 'terms' },
        { field: 'category', type: 'terms' },
        { field: 'product', type: 'terms' }
      ]
    })

    it('should remove the specified additional bucket level', () => {
      const { removeBucketLevel } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      // Remove index 0 of additional levels (which is index 1 overall)
      removeBucketLevel(0)

      expect(aggregationStore.currentConfig.bucketAggs).toHaveLength(2)
      expect(aggregationStore.currentConfig.bucketAggs[0].field).toBe('region')
      expect(aggregationStore.currentConfig.bucketAggs[1].field).toBe('product')
    })

    it('should remove the correct bucket when removing last level', () => {
      const { removeBucketLevel } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      // Remove index 1 of additional levels (which is index 2 overall)
      removeBucketLevel(1)

      expect(aggregationStore.currentConfig.bucketAggs).toHaveLength(2)
      expect(aggregationStore.currentConfig.bucketAggs[0].field).toBe('region')
      expect(aggregationStore.currentConfig.bucketAggs[1].field).toBe('category')
    })

    it('should call onUpdate callback', () => {
      const { removeBucketLevel } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      removeBucketLevel(0)

      expect(onUpdateMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('moveBucketLevelUp', () => {
    beforeEach(() => {
      aggregationStore.currentConfig.bucketAggs = [
        { field: 'region', type: 'terms' },
        { field: 'category', type: 'terms' },
        { field: 'product', type: 'terms' }
      ]
    })

    it('should move bucket level up in order', () => {
      const { moveBucketLevelUp } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      // Move 'product' (index 1 in additional) up
      moveBucketLevelUp(1)

      expect(aggregationStore.currentConfig.bucketAggs[1].field).toBe('product')
      expect(aggregationStore.currentConfig.bucketAggs[2].field).toBe('category')
    })

    it('should not move if already at top of additional levels', () => {
      const { moveBucketLevelUp } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      const beforeBuckets = [...aggregationStore.currentConfig.bucketAggs]

      // Try to move index 0 up (already at top)
      moveBucketLevelUp(0)

      expect(aggregationStore.currentConfig.bucketAggs).toEqual(beforeBuckets)
      expect(onUpdateMock).not.toHaveBeenCalled()
    })

    it('should call onUpdate when successfully moved', () => {
      const { moveBucketLevelUp } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      moveBucketLevelUp(1)

      expect(onUpdateMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('moveBucketLevelDown', () => {
    beforeEach(() => {
      aggregationStore.currentConfig.bucketAggs = [
        { field: 'region', type: 'terms' },
        { field: 'category', type: 'terms' },
        { field: 'product', type: 'terms' }
      ]
    })

    it('should move bucket level down in order', () => {
      const { moveBucketLevelDown } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      // Move 'category' (index 0 in additional) down
      moveBucketLevelDown(0)

      expect(aggregationStore.currentConfig.bucketAggs[1].field).toBe('product')
      expect(aggregationStore.currentConfig.bucketAggs[2].field).toBe('category')
    })

    it('should not move if already at bottom', () => {
      const { moveBucketLevelDown } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      const beforeBuckets = [...aggregationStore.currentConfig.bucketAggs]

      // Try to move last index down (already at bottom)
      moveBucketLevelDown(1)

      expect(aggregationStore.currentConfig.bucketAggs).toEqual(beforeBuckets)
      expect(onUpdateMock).not.toHaveBeenCalled()
    })

    it('should call onUpdate when successfully moved', () => {
      const { moveBucketLevelDown } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      moveBucketLevelDown(0)

      expect(onUpdateMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('State Management', () => {
    it('should initialize showSubGroupPicker as false', () => {
      const { showSubGroupPicker } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      expect(showSubGroupPicker.value).toBe(false)
    })

    it('should initialize subGroupSearch as empty string', () => {
      const { subGroupSearch } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      expect(subGroupSearch.value).toBe('')
    })

    it('should allow toggling showSubGroupPicker', () => {
      const { showSubGroupPicker } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      showSubGroupPicker.value = true
      expect(showSubGroupPicker.value).toBe(true)

      showSubGroupPicker.value = false
      expect(showSubGroupPicker.value).toBe(false)
    })

    it('should allow updating subGroupSearch', () => {
      const { subGroupSearch } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      subGroupSearch.value = 'test'
      expect(subGroupSearch.value).toBe('test')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty bucketAggs array', () => {
      aggregationStore.currentConfig.bucketAggs = []

      const { additionalBucketLevels, subGroupFields } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      expect(additionalBucketLevels.value).toEqual([])
      expect(() => subGroupFields.value).not.toThrow()
    })

    it('should handle missing elasticStore fields', () => {
      elasticStore.fields = []

      const { subGroupFields } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      expect(subGroupFields.value).toEqual([])
    })

    it('should handle undefined vegaStore selectedType', () => {
      vegaStore.selectedType = undefined

      const { supportsMultiLevelBuckets } = useMultiLevelBuckets(
        aggregationStore,
        elasticStore,
        vegaStore,
        onUpdateMock
      )

      expect(supportsMultiLevelBuckets.value).toBe(false)
    })
  })
})
