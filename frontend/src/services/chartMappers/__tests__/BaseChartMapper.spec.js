import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BaseChartMapper } from '../BaseChartMapper'

describe('BaseChartMapper', () => {
  let mapper
  let mockAxisState
  let mockVegaStore

  beforeEach(() => {
    mockAxisState = {
      x: { field: 'category' },
      y: { field: 'value', metric: 'sum' }
    }

    mockVegaStore = {
      config: {},
      updateConfig: vi.fn()
    }

    mapper = new BaseChartMapper(mockAxisState, mockVegaStore, 'test-chart')
  })

  describe('Constructor', () => {
    it('should initialize with provided parameters', () => {
      expect(mapper.axisState).toBe(mockAxisState)
      expect(mapper.vegaStore).toBe(mockVegaStore)
      expect(mapper.chartType).toBe('test-chart')
    })
  })

  describe('resolveDataField', () => {
    it('should return field name for direct match', () => {
      const availableFields = ['category', 'value', 'count']

      const result = mapper.resolveDataField('category', availableFields)

      expect(result).toBe('category')
    })

    it('should resolve dot notation to underscore', () => {
      const availableFields = ['products_price', 'customer_age']

      const result = mapper.resolveDataField('products.price', availableFields)

      expect(result).toBe('products_price')
    })

    it('should handle nested paths with multiple dots', () => {
      const availableFields = ['geoip_location_lat', 'geoip_location_lon']

      const result = mapper.resolveDataField('geoip.location.lat', availableFields)

      expect(result).toBe('geoip_location_lat')
    })

    it('should find partial match when exact match fails', () => {
      const availableFields = ['avg_products_base_price', 'sum_total_quantity']

      const result = mapper.resolveDataField('products_base_price', availableFields)

      expect(result).toBe('avg_products_base_price')
    })

    it('should return null when no match found', () => {
      const availableFields = ['category', 'value']

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = mapper.resolveDataField('unknown_field', availableFields)

      expect(result).toBe(null)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not resolve field: unknown_field')
      )

      consoleSpy.mockRestore()
    })

    it('should return null when fieldName is null', () => {
      const availableFields = ['category', 'value']

      const result = mapper.resolveDataField(null, availableFields)

      expect(result).toBe(null)
    })

    it('should return null when fieldName is undefined', () => {
      const availableFields = ['category', 'value']

      const result = mapper.resolveDataField(undefined, availableFields)

      expect(result).toBe(null)
    })

    it('should return null when fieldName is empty string', () => {
      const availableFields = ['category', 'value']

      const result = mapper.resolveDataField('', availableFields)

      expect(result).toBe(null)
    })

    it('should handle available fields being empty array', () => {
      const result = mapper.resolveDataField('category', [])

      expect(result).toBe(null)
    })

    it('should prioritize exact match over partial match', () => {
      const availableFields = ['price', 'avg_price', 'products_price']

      const result = mapper.resolveDataField('price', availableFields)

      expect(result).toBe('price')
    })

    it('should prioritize sanitized match over partial match', () => {
      const availableFields = ['products_price', 'avg_products_price']

      const result = mapper.resolveDataField('products.price', availableFields)

      expect(result).toBe('products_price')
    })
  })

  describe('toSafeFieldName', () => {
    it('should convert dots to underscores', () => {
      const result = mapper.toSafeFieldName('products.price')

      expect(result).toBe('products_price')
    })

    it('should handle multiple dots', () => {
      const result = mapper.toSafeFieldName('geoip.location.lat')

      expect(result).toBe('geoip_location_lat')
    })

    it('should return original field if no dots', () => {
      const result = mapper.toSafeFieldName('category')

      expect(result).toBe('category')
    })

    it('should handle empty string', () => {
      const result = mapper.toSafeFieldName('')

      expect(result).toBe('')
    })

    it('should handle null', () => {
      const result = mapper.toSafeFieldName(null)

      expect(result).toBe('')
    })

    it('should handle undefined', () => {
      const result = mapper.toSafeFieldName(undefined)

      expect(result).toBe('')
    })

    it('should handle field names with underscores already', () => {
      const result = mapper.toSafeFieldName('customer_age')

      expect(result).toBe('customer_age')
    })

    it('should handle mixed dots and underscores', () => {
      const result = mapper.toSafeFieldName('user_profile.address.zip')

      expect(result).toBe('user_profile_address_zip')
    })
  })

  describe('isNumericValue', () => {
    it('should return true for positive numbers', () => {
      expect(mapper.isNumericValue(42)).toBe(true)
      expect(mapper.isNumericValue(3.14)).toBe(true)
    })

    it('should return true for negative numbers', () => {
      expect(mapper.isNumericValue(-10)).toBe(true)
      expect(mapper.isNumericValue(-3.14)).toBe(true)
    })

    it('should return true for zero', () => {
      expect(mapper.isNumericValue(0)).toBe(true)
    })

    it('should return false for NaN', () => {
      expect(mapper.isNumericValue(NaN)).toBe(false)
    })

    it('should return false for strings', () => {
      expect(mapper.isNumericValue('42')).toBe(false)
      expect(mapper.isNumericValue('hello')).toBe(false)
    })

    it('should return false for null', () => {
      expect(mapper.isNumericValue(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(mapper.isNumericValue(undefined)).toBe(false)
    })

    it('should return false for objects', () => {
      expect(mapper.isNumericValue({})).toBe(false)
      expect(mapper.isNumericValue({ value: 42 })).toBe(false)
    })

    it('should return true for array of numbers', () => {
      expect(mapper.isNumericValue([1, 2, 3])).toBe(true)
      expect(mapper.isNumericValue([42])).toBe(true)
    })

    it('should return false for empty array', () => {
      expect(mapper.isNumericValue([])).toBe(false)
    })

    it('should return false for array with non-numeric values', () => {
      expect(mapper.isNumericValue([1, 'two', 3])).toBe(false)
      expect(mapper.isNumericValue([1, null, 3])).toBe(false)
      expect(mapper.isNumericValue([1, NaN, 3])).toBe(false)
    })

    it('should return true for array of floating point numbers', () => {
      expect(mapper.isNumericValue([1.5, 2.7, 3.14])).toBe(true)
    })

    it('should return true for array with negative numbers', () => {
      expect(mapper.isNumericValue([-1, -2, -3])).toBe(true)
    })

    it('should return true for array with mixed positive and negative', () => {
      expect(mapper.isNumericValue([-1, 0, 1])).toBe(true)
    })
  })

  describe('mapMetricField', () => {
    it('should map avg metric field', () => {
      const availableFields = ['category', 'avg_price', 'count']

      const result = mapper.mapMetricField('avg', 'price', availableFields)

      expect(result).toBe('avg_price')
    })

    it('should map sum metric field', () => {
      const availableFields = ['category', 'sum_quantity', 'count']

      const result = mapper.mapMetricField('sum', 'quantity', availableFields)

      expect(result).toBe('sum_quantity')
    })

    it('should handle field with dots', () => {
      const availableFields = ['avg_products_base_price', 'count']

      const result = mapper.mapMetricField('avg', 'products.base_price', availableFields)

      expect(result).toBe('avg_products_base_price')
    })

    it('should handle max metric', () => {
      const availableFields = ['max_price', 'count']

      const result = mapper.mapMetricField('max', 'price', availableFields)

      expect(result).toBe('max_price')
    })

    it('should handle min metric', () => {
      const availableFields = ['min_price', 'count']

      const result = mapper.mapMetricField('min', 'price', availableFields)

      expect(result).toBe('min_price')
    })

    it('should find partial match when exact match not found', () => {
      const availableFields = ['category', 'avg_products_price_value', 'count']

      const result = mapper.mapMetricField('avg', 'products.price', availableFields)

      expect(result).toBe('avg_products_price_value')
    })

    it('should return null when no match found', () => {
      const availableFields = ['category', 'count']

      const result = mapper.mapMetricField('avg', 'unknown_field', availableFields)

      expect(result).toBe(null)
    })

    it('should return null when fieldName is null', () => {
      const availableFields = ['avg_price', 'count']

      const result = mapper.mapMetricField('avg', null, availableFields)

      expect(result).toBe(null)
    })

    it('should return null when fieldName is undefined', () => {
      const availableFields = ['avg_price', 'count']

      const result = mapper.mapMetricField('avg', undefined, availableFields)

      expect(result).toBe(null)
    })

    it('should handle median metric', () => {
      const availableFields = ['median_response_time', 'count']

      const result = mapper.mapMetricField('median', 'response_time', availableFields)

      expect(result).toBe('median_response_time')
    })

    it('should handle count metric', () => {
      const availableFields = ['count', '_count']

      const result = mapper.mapMetricField('count', '', availableFields)

      // When fieldName is empty, mapMetricField returns null (fieldName check at start)
      expect(result).toBe(null)
    })

    it('should prioritize exact match over partial match', () => {
      const availableFields = ['avg_price', 'avg_price_total', 'sum_avg_price']

      const result = mapper.mapMetricField('avg', 'price', availableFields)

      expect(result).toBe('avg_price')
    })
  })

  describe('Abstract Methods', () => {
    describe('buildAggregationConfig', () => {
      it('should throw error when not implemented', async () => {
        await expect(
          mapper.buildAggregationConfig({}, {}, () => {})
        ).rejects.toThrow('buildAggregationConfig() must be implemented by subclass')
      })
    })

    describe('mapFieldsToConfig', () => {
      it('should throw error when not implemented', () => {
        expect(() => {
          mapper.mapFieldsToConfig([], [])
        }).toThrow('mapFieldsToConfig() must be implemented by subclass')
      })
    })
  })

  describe('Subclass Implementation', () => {
    it('should allow subclass to override abstract methods', async () => {
      class TestMapper extends BaseChartMapper {
        async buildAggregationConfig(aggregationStore, elasticStore, buildBucketAggConfig) {
          return { success: true }
        }

        mapFieldsToConfig(data, fields) {
          return { data, fields }
        }
      }

      const testMapper = new TestMapper(mockAxisState, mockVegaStore, 'test')

      // Should not throw
      const aggResult = await testMapper.buildAggregationConfig({}, {}, () => {})
      expect(aggResult).toEqual({ success: true })

      const mapResult = testMapper.mapFieldsToConfig([{ a: 1 }], ['a'])
      expect(mapResult).toEqual({ data: [{ a: 1 }], fields: ['a'] })
    })

    it('should inherit utility methods in subclass', () => {
      class TestMapper extends BaseChartMapper {
        async buildAggregationConfig() { return {} }
        mapFieldsToConfig() { return {} }
      }

      const testMapper = new TestMapper(mockAxisState, mockVegaStore, 'test')

      // Test inherited methods
      expect(testMapper.toSafeFieldName('field.name')).toBe('field_name')
      expect(testMapper.isNumericValue(42)).toBe(true)
      expect(testMapper.resolveDataField('test', ['test'])).toBe('test')
    })
  })
})
