import { describe, it, expect } from 'vitest'
import {
  Hash,
  Type,
  Calendar,
  MapPin,
  ToggleLeft,
  Box
} from 'lucide-vue-next'
import { useFieldSelection } from '../useFieldSelection'

describe('useFieldSelection', () => {
  describe('getFieldIcon', () => {
    it('should return Hash icon for number category', () => {
      const { getFieldIcon } = useFieldSelection()
      const field = { category: 'number' }

      const icon = getFieldIcon(field)

      expect(icon).toBe(Hash)
    })

    it('should return Type icon for string category', () => {
      const { getFieldIcon } = useFieldSelection()
      const field = { category: 'string' }

      const icon = getFieldIcon(field)

      expect(icon).toBe(Type)
    })

    it('should return Calendar icon for date category', () => {
      const { getFieldIcon } = useFieldSelection()
      const field = { category: 'date' }

      const icon = getFieldIcon(field)

      expect(icon).toBe(Calendar)
    })

    it('should return MapPin icon for geo category', () => {
      const { getFieldIcon } = useFieldSelection()
      const field = { category: 'geo' }

      const icon = getFieldIcon(field)

      expect(icon).toBe(MapPin)
    })

    it('should return ToggleLeft icon for boolean category', () => {
      const { getFieldIcon } = useFieldSelection()
      const field = { category: 'boolean' }

      const icon = getFieldIcon(field)

      expect(icon).toBe(ToggleLeft)
    })

    it('should return Box icon for other category', () => {
      const { getFieldIcon } = useFieldSelection()
      const field = { category: 'other' }

      const icon = getFieldIcon(field)

      expect(icon).toBe(Box)
    })

    it('should return Box icon for unknown category', () => {
      const { getFieldIcon } = useFieldSelection()
      const field = { category: 'unknown_category' }

      const icon = getFieldIcon(field)

      expect(icon).toBe(Box)
    })
  })

  describe('getFieldTypeColor', () => {
    it('should return blue color for number category', () => {
      const { getFieldTypeColor } = useFieldSelection()
      const field = { category: 'number' }

      const color = getFieldTypeColor(field)

      expect(color).toBe('text-blue-400')
    })

    it('should return emerald color for string category', () => {
      const { getFieldTypeColor } = useFieldSelection()
      const field = { category: 'string' }

      const color = getFieldTypeColor(field)

      expect(color).toBe('text-emerald-400')
    })

    it('should return amber color for date category', () => {
      const { getFieldTypeColor } = useFieldSelection()
      const field = { category: 'date' }

      const color = getFieldTypeColor(field)

      expect(color).toBe('text-amber-400')
    })

    it('should return purple color for geo category', () => {
      const { getFieldTypeColor } = useFieldSelection()
      const field = { category: 'geo' }

      const color = getFieldTypeColor(field)

      expect(color).toBe('text-purple-400')
    })

    it('should return pink color for boolean category', () => {
      const { getFieldTypeColor } = useFieldSelection()
      const field = { category: 'boolean' }

      const color = getFieldTypeColor(field)

      expect(color).toBe('text-pink-400')
    })

    it('should return slate color for other category', () => {
      const { getFieldTypeColor } = useFieldSelection()
      const field = { category: 'other' }

      const color = getFieldTypeColor(field)

      expect(color).toBe('text-slate-400')
    })

    it('should return slate color for unknown category', () => {
      const { getFieldTypeColor } = useFieldSelection()
      const field = { category: 'unknown_category' }

      const color = getFieldTypeColor(field)

      expect(color).toBe('text-slate-400')
    })
  })

  describe('getFieldsForAxis', () => {
    const mockElasticStore = {
      aggregatableFields: [
        { name: 'category', category: 'string', aggregatable: true },
        { name: 'region', category: 'string', aggregatable: true },
        { name: 'price', category: 'number', aggregatable: true }
      ],
      aggregatableNumericFields: [
        { name: 'price', category: 'number', aggregatable: true },
        { name: 'quantity', category: 'number', aggregatable: true }
      ],
      fields: [
        { name: 'category', category: 'string', aggregatable: true },
        { name: 'region', category: 'string', aggregatable: true },
        { name: 'price', category: 'number', aggregatable: true },
        { name: 'description', category: 'text', aggregatable: false }
      ]
    }

    it('should return aggregatable fields for bucket axis', () => {
      const { getFieldsForAxis } = useFieldSelection()
      const axisConfig = { fieldType: 'bucket' }

      const fields = getFieldsForAxis(axisConfig, mockElasticStore)

      expect(fields).toBe(mockElasticStore.aggregatableFields)
      expect(fields).toHaveLength(3)
    })

    it('should return numeric fields for metric axis', () => {
      const { getFieldsForAxis } = useFieldSelection()
      const axisConfig = { fieldType: 'metric' }

      const fields = getFieldsForAxis(axisConfig, mockElasticStore)

      expect(fields).toBe(mockElasticStore.aggregatableNumericFields)
      expect(fields).toHaveLength(2)
    })

    it('should return numeric fields for numeric axis', () => {
      const { getFieldsForAxis } = useFieldSelection()
      const axisConfig = { fieldType: 'numeric' }

      const fields = getFieldsForAxis(axisConfig, mockElasticStore)

      expect(fields).toBe(mockElasticStore.aggregatableNumericFields)
      expect(fields).toHaveLength(2)
    })

    it('should return all fields for other axis types', () => {
      const { getFieldsForAxis } = useFieldSelection()
      const axisConfig = { fieldType: 'other' }

      const fields = getFieldsForAxis(axisConfig, mockElasticStore)

      expect(fields).toBe(mockElasticStore.fields)
      expect(fields).toHaveLength(4)
    })

    it('should filter fields by search term', () => {
      const { getFieldsForAxis } = useFieldSelection()
      const axisConfig = { fieldType: 'bucket' }

      const fields = getFieldsForAxis(axisConfig, mockElasticStore, 'cat')

      expect(fields).toHaveLength(1)
      expect(fields[0].name).toBe('category')
    })

    it('should filter case-insensitively', () => {
      const { getFieldsForAxis } = useFieldSelection()
      const axisConfig = { fieldType: 'bucket' }

      const fields = getFieldsForAxis(axisConfig, mockElasticStore, 'REG')

      expect(fields).toHaveLength(1)
      expect(fields[0].name).toBe('region')
    })

    it('should return empty array when search has no matches', () => {
      const { getFieldsForAxis } = useFieldSelection()
      const axisConfig = { fieldType: 'bucket' }

      const fields = getFieldsForAxis(axisConfig, mockElasticStore, 'xyz')

      expect(fields).toHaveLength(0)
    })

    it('should return all fields when search is empty string', () => {
      const { getFieldsForAxis } = useFieldSelection()
      const axisConfig = { fieldType: 'bucket' }

      const fields = getFieldsForAxis(axisConfig, mockElasticStore, '')

      expect(fields).toHaveLength(3)
    })
  })

  describe('determineAggregationType', () => {
    it('should return null for non-bucket axes', () => {
      const { determineAggregationType } = useFieldSelection()
      const field = { category: 'number' }

      const type = determineAggregationType(field, 'bar', 'metric')

      expect(type).toBe(null)
    })

    it('should return histogram for histogram chart type', () => {
      const { determineAggregationType } = useFieldSelection()
      const field = { category: 'number' }

      const type = determineAggregationType(field, 'histogram', 'bucket')

      expect(type).toBe('histogram')
    })

    it('should return date_histogram for date fields', () => {
      const { determineAggregationType } = useFieldSelection()
      const field = { category: 'date' }

      const type = determineAggregationType(field, 'bar', 'bucket')

      expect(type).toBe('date_histogram')
    })

    it('should return histogram for numeric field in heatmap', () => {
      const { determineAggregationType } = useFieldSelection()
      const field = { category: 'number' }

      const type = determineAggregationType(field, 'heatmap', 'bucket')

      expect(type).toBe('histogram')
    })

    it('should return terms for string fields in bar chart', () => {
      const { determineAggregationType } = useFieldSelection()
      const field = { category: 'string' }

      const type = determineAggregationType(field, 'bar', 'bucket')

      expect(type).toBe('terms')
    })

    it('should return terms for string fields in pie chart', () => {
      const { determineAggregationType } = useFieldSelection()
      const field = { category: 'string' }

      const type = determineAggregationType(field, 'pie', 'bucket')

      expect(type).toBe('terms')
    })

    it('should return terms for boolean fields', () => {
      const { determineAggregationType } = useFieldSelection()
      const field = { category: 'boolean' }

      const type = determineAggregationType(field, 'bar', 'bucket')

      expect(type).toBe('terms')
    })

    it('should return terms for geo fields', () => {
      const { determineAggregationType } = useFieldSelection()
      const field = { category: 'geo' }

      const type = determineAggregationType(field, 'bar', 'bucket')

      expect(type).toBe('terms')
    })

    it('should prioritize histogram chart type over field type', () => {
      const { determineAggregationType } = useFieldSelection()
      const field = { category: 'date' }

      // histogram chart type should return histogram even for date fields
      const type = determineAggregationType(field, 'histogram', 'bucket')

      expect(type).toBe('histogram')
    })

    it('should prioritize date fields over chart type (except histogram)', () => {
      const { determineAggregationType } = useFieldSelection()
      const field = { category: 'date' }

      const type = determineAggregationType(field, 'heatmap', 'bucket')

      expect(type).toBe('date_histogram')
    })
  })
})
