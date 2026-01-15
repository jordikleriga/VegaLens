import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useElasticStore } from '../elastic'
import api from '@/services/api'

// Mock the API
vi.mock('@/services/api')

describe('Elastic Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const store = useElasticStore()

      expect(store.connected).toBe(false)
      expect(store.connectionInfo).toBe(null)
      expect(store.indices).toEqual([])
      expect(store.currentIndex).toBe(null)
      expect(store.fields).toEqual([])
      expect(store.sampleData).toEqual([])
      expect(store.sampleSize).toBe(5000)
      expect(store.loading).toEqual({
        connection: false,
        indices: false,
        fields: false,
        data: false
      })
      expect(store.error).toBe(null)
    })
  })

  describe('Computed Properties - Field Filtering', () => {
    beforeEach(() => {
      const store = useElasticStore()

      // Set up test fields
      store.fields = [
        { name: 'price', category: 'number', aggregatable: true, isSubfield: false },
        { name: 'quantity', category: 'number', aggregatable: true, isSubfield: false },
        { name: 'category', category: 'string', aggregatable: true, isSubfield: false },
        { name: 'description', category: 'string', aggregatable: false, isSubfield: false },
        { name: 'category.keyword', category: 'string', aggregatable: true, isSubfield: true },
        { name: 'timestamp', category: 'date', aggregatable: true, isSubfield: false },
        { name: 'location', category: 'geo', aggregatable: true, isSubfield: false },
        { name: 'active', category: 'boolean', aggregatable: true, isSubfield: false },
        { name: 'custom', category: 'other', aggregatable: false, isSubfield: false }
      ]
    })

    describe('numericFields', () => {
      it('should return only numeric fields', () => {
        const store = useElasticStore()

        expect(store.numericFields).toHaveLength(2)
        expect(store.numericFields[0].name).toBe('price')
        expect(store.numericFields[1].name).toBe('quantity')
      })
    })

    describe('stringFields', () => {
      it('should return only string fields', () => {
        const store = useElasticStore()

        expect(store.stringFields).toHaveLength(3)
        expect(store.stringFields.map(f => f.name)).toContain('category')
        expect(store.stringFields.map(f => f.name)).toContain('description')
        expect(store.stringFields.map(f => f.name)).toContain('category.keyword')
      })
    })

    describe('dateFields', () => {
      it('should return only date fields', () => {
        const store = useElasticStore()

        expect(store.dateFields).toHaveLength(1)
        expect(store.dateFields[0].name).toBe('timestamp')
      })
    })

    describe('geoFields', () => {
      it('should return only geo fields', () => {
        const store = useElasticStore()

        expect(store.geoFields).toHaveLength(1)
        expect(store.geoFields[0].name).toBe('location')
      })
    })

    describe('booleanFields', () => {
      it('should return only boolean fields', () => {
        const store = useElasticStore()

        expect(store.booleanFields).toHaveLength(1)
        expect(store.booleanFields[0].name).toBe('active')
      })
    })

    describe('aggregatableFields', () => {
      it('should return only aggregatable fields', () => {
        const store = useElasticStore()

        const aggregatable = store.aggregatableFields

        expect(aggregatable).toHaveLength(7) // All except description and custom
        expect(aggregatable.every(f => f.aggregatable)).toBe(true)
        expect(aggregatable.map(f => f.name)).not.toContain('description')
        expect(aggregatable.map(f => f.name)).not.toContain('custom')
      })
    })

    describe('aggregatableStringFields', () => {
      it('should return only aggregatable string fields', () => {
        const store = useElasticStore()

        const fields = store.aggregatableStringFields

        expect(fields).toHaveLength(2) // category and category.keyword
        expect(fields.every(f => f.aggregatable && f.category === 'string')).toBe(true)
        expect(fields.map(f => f.name)).not.toContain('description') // Not aggregatable
      })
    })

    describe('aggregatableNumericFields', () => {
      it('should return only aggregatable numeric fields', () => {
        const store = useElasticStore()

        const fields = store.aggregatableNumericFields

        expect(fields).toHaveLength(2)
        expect(fields.map(f => f.name)).toContain('price')
        expect(fields.map(f => f.name)).toContain('quantity')
        expect(fields.every(f => f.aggregatable && f.category === 'number')).toBe(true)
      })
    })

    describe('aggregatableDateFields', () => {
      it('should return only aggregatable date fields', () => {
        const store = useElasticStore()

        const fields = store.aggregatableDateFields

        expect(fields).toHaveLength(1)
        expect(fields[0].name).toBe('timestamp')
        expect(fields[0].aggregatable).toBe(true)
        expect(fields[0].category).toBe('date')
      })
    })

    describe('primaryFields', () => {
      it('should return only primary fields (not subfields)', () => {
        const store = useElasticStore()

        const fields = store.primaryFields

        expect(fields).toHaveLength(8) // All except category.keyword
        expect(fields.map(f => f.name)).not.toContain('category.keyword')
        expect(fields.every(f => !f.isSubfield)).toBe(true)
      })
    })

    describe('fieldsByCategory', () => {
      it('should group fields by category with metadata', () => {
        const store = useElasticStore()

        const byCategory = store.fieldsByCategory

        expect(byCategory.number).toBeDefined()
        expect(byCategory.number.label).toBe('Numeric')
        expect(byCategory.number.icon).toBe('hash')
        expect(byCategory.number.fields).toHaveLength(2)

        expect(byCategory.string).toBeDefined()
        expect(byCategory.string.label).toBe('String')
        expect(byCategory.string.fields).toHaveLength(3)

        expect(byCategory.date).toBeDefined()
        expect(byCategory.date.fields).toHaveLength(1)

        expect(byCategory.geo).toBeDefined()
        expect(byCategory.geo.fields).toHaveLength(1)

        expect(byCategory.boolean).toBeDefined()
        expect(byCategory.boolean.fields).toHaveLength(1)

        expect(byCategory.other).toBeDefined()
        expect(byCategory.other.fields).toHaveLength(1)
      })

      it('should handle unknown categories', () => {
        const store = useElasticStore()
        store.fields = [
          { name: 'unknown_field', category: 'unknown_type' }
        ]

        const byCategory = store.fieldsByCategory

        expect(byCategory.other.fields).toHaveLength(1)
        expect(byCategory.other.fields[0].name).toBe('unknown_field')
      })
    })

    describe('textFields (legacy alias)', () => {
      it('should be an alias for stringFields', () => {
        const store = useElasticStore()

        expect(store.textFields).toEqual(store.stringFields)
      })
    })

    describe('fieldsByType (legacy compatibility)', () => {
      it('should provide legacy field grouping', () => {
        const store = useElasticStore()

        const byType = store.fieldsByType

        expect(byType.numeric).toEqual(store.numericFields)
        expect(byType.text).toEqual(store.stringFields)
        expect(byType.date).toEqual(store.dateFields)
        expect(byType.all).toEqual(store.fields)
      })
    })

    describe('fieldMappings', () => {
      it('should create field name to type mapping object', () => {
        const store = useElasticStore()
        store.fields = [
          {
            name: 'price',
            esType: 'float',
            category: 'number',
            aggregatable: true,
            searchable: true
          },
          {
            name: 'category',
            type: 'keyword',
            category: 'string',
            aggregatable: true,
            searchable: true
          }
        ]

        const mappings = store.fieldMappings

        expect(mappings.price).toEqual({
          type: 'float',
          category: 'number',
          aggregatable: true,
          searchable: true
        })

        expect(mappings.category).toEqual({
          type: 'keyword',
          category: 'string',
          aggregatable: true,
          searchable: true
        })
      })

      it('should use esType if available, otherwise type', () => {
        const store = useElasticStore()
        store.fields = [
          { name: 'field1', esType: 'long' },
          { name: 'field2', type: 'keyword' },
          { name: 'field3' }
        ]

        const mappings = store.fieldMappings

        expect(mappings.field1.type).toBe('long')
        expect(mappings.field2.type).toBe('keyword')
        expect(mappings.field3.type).toBe('unknown')
      })
    })
  })

  describe('API Integration', () => {
    describe('checkConnection', () => {
      it('should check Elasticsearch connection successfully', async () => {
        const store = useElasticStore()

        const mockResponse = {
          connected: true,
          cluster_name: 'test-cluster',
          version: '8.0.0'
        }

        api.get.mockResolvedValue({ data: mockResponse })

        const result = await store.checkConnection()

        expect(api.get).toHaveBeenCalledWith('/elastic/connection')
        expect(store.connected).toBe(true)
        expect(store.connectionInfo).toEqual(mockResponse)
        expect(result).toEqual(mockResponse)
        expect(store.loading.connection).toBe(false)
      })

      it('should handle connection failure', async () => {
        const store = useElasticStore()

        api.get.mockRejectedValue({
          response: { data: { message: 'Connection refused' } }
        })

        await expect(store.checkConnection()).rejects.toThrow()
        expect(store.connected).toBe(false)
        expect(store.error).toBe('Connection refused')
      })

      it('should set loading state during check', async () => {
        const store = useElasticStore()

        api.get.mockImplementation(() => {
          expect(store.loading.connection).toBe(true)
          return Promise.resolve({ data: { connected: true } })
        })

        await store.checkConnection()
      })
    })

    describe('fetchIndices', () => {
      it('should fetch all indices', async () => {
        const store = useElasticStore()

        const mockIndices = [
          { name: 'logs-2024', health: 'green', docsCount: 1000 },
          { name: 'metrics-2024', health: 'yellow', docsCount: 5000 }
        ]

        api.get.mockResolvedValue({ data: mockIndices })

        const result = await store.fetchIndices()

        expect(api.get).toHaveBeenCalledWith('/elastic/indices')
        expect(store.indices).toEqual(mockIndices)
        expect(result).toEqual(mockIndices)
        expect(store.loading.indices).toBe(false)
      })

      it('should handle fetch error', async () => {
        const store = useElasticStore()

        api.get.mockRejectedValue(new Error('Fetch failed'))

        await expect(store.fetchIndices()).rejects.toThrow()
        expect(store.error).toBe('Fetch failed')
      })
    })

    describe('fetchMapping', () => {
      it('should fetch field mapping for index', async () => {
        const store = useElasticStore()

        const mockFields = [
          { name: 'price', category: 'number', aggregatable: true },
          { name: 'category', category: 'string', aggregatable: true }
        ]

        api.get.mockResolvedValue({ data: mockFields })

        const result = await store.fetchMapping('products')

        expect(api.get).toHaveBeenCalledWith('/elastic/indices/products/mapping')
        expect(store.currentIndex).toBe('products')
        expect(store.fields).toEqual(mockFields)
        expect(result).toEqual(mockFields)
      })

      it('should handle mapping fetch error', async () => {
        const store = useElasticStore()

        api.get.mockRejectedValue({
          response: { data: { message: 'Index not found' } }
        })

        await expect(store.fetchMapping('unknown')).rejects.toThrow()
        expect(store.error).toBe('Index not found')
      })
    })

    describe('fetchSampleData', () => {
      it('should fetch sample data with default size', async () => {
        const store = useElasticStore()
        store.sampleSize = 5000

        const mockResponse = {
          hits: [
            { _source: { category: 'A', value: 100 } },
            { _source: { category: 'B', value: 200 } }
          ],
          total: 2
        }

        api.get.mockResolvedValue({ data: mockResponse })

        const result = await store.fetchSampleData('products')

        expect(api.get).toHaveBeenCalledWith('/elastic/indices/products/sample', {
          params: { size: 5000 }
        })
        expect(store.sampleData).toEqual(mockResponse.hits)
        expect(result).toEqual(mockResponse)
      })

      it('should fetch sample data with custom size', async () => {
        const store = useElasticStore()

        const mockResponse = { hits: [], total: 0 }
        api.get.mockResolvedValue({ data: mockResponse })

        await store.fetchSampleData('products', 1000)

        expect(api.get).toHaveBeenCalledWith('/elastic/indices/products/sample', {
          params: { size: 1000 }
        })
      })

      it('should handle sample data fetch error', async () => {
        const store = useElasticStore()

        api.get.mockRejectedValue(new Error('Query failed'))

        await expect(store.fetchSampleData('products')).rejects.toThrow()
        expect(store.error).toBe('Query failed')
      })
    })

    describe('setSampleSize', () => {
      it('should update sample size', () => {
        const store = useElasticStore()

        store.setSampleSize(10000)

        expect(store.sampleSize).toBe(10000)
      })

      it('should refetch sample data when index is selected', async () => {
        const store = useElasticStore()
        store.currentIndex = 'products'

        api.get.mockResolvedValue({ data: { hits: [], total: 0 } })

        store.setSampleSize(10000)

        // Wait for async call
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(api.get).toHaveBeenCalledWith('/elastic/indices/products/sample', {
          params: { size: 10000 }
        })
      })

      it('should not refetch when no index selected', async () => {
        const store = useElasticStore()
        store.currentIndex = null

        store.setSampleSize(10000)

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(api.get).not.toHaveBeenCalled()
      })
    })

    describe('fetchFieldValues', () => {
      it('should fetch unique values for field', async () => {
        const store = useElasticStore()

        const mockValues = ['A', 'B', 'C']
        api.get.mockResolvedValue({ data: mockValues })

        const result = await store.fetchFieldValues('products', 'category')

        expect(api.get).toHaveBeenCalledWith('/elastic/indices/products/fields/category/values', {
          params: { size: 100 }
        })
        expect(result).toEqual(mockValues)
      })

      it('should fetch field values with custom size', async () => {
        const store = useElasticStore()

        api.get.mockResolvedValue({ data: [] })

        await store.fetchFieldValues('products', 'category', 50)

        expect(api.get).toHaveBeenCalledWith('/elastic/indices/products/fields/category/values', {
          params: { size: 50 }
        })
      })

      it('should handle fetch error', async () => {
        const store = useElasticStore()

        api.get.mockRejectedValue(new Error('Field not found'))

        await expect(store.fetchFieldValues('products', 'unknown')).rejects.toThrow()
        expect(store.error).toBe('Field not found')
      })
    })

    describe('fetchFieldStats', () => {
      it('should fetch statistics for numeric field', async () => {
        const store = useElasticStore()

        const mockStats = {
          min: 10,
          max: 1000,
          avg: 299.5,
          count: 500
        }

        api.get.mockResolvedValue({ data: mockStats })

        const result = await store.fetchFieldStats('products', 'price')

        expect(api.get).toHaveBeenCalledWith('/elastic/indices/products/fields/price/stats')
        expect(result).toEqual(mockStats)
      })

      it('should handle stats fetch error', async () => {
        const store = useElasticStore()

        api.get.mockRejectedValue({
          response: { data: { message: 'Cannot compute stats for text field' } }
        })

        await expect(store.fetchFieldStats('products', 'description')).rejects.toThrow()
        expect(store.error).toBe('Cannot compute stats for text field')
      })
    })

    describe('executeQuery', () => {
      it('should execute custom Elasticsearch query', async () => {
        const store = useElasticStore()

        const mockResponse = {
          hits: { hits: [], total: 0 }
        }

        api.post.mockResolvedValue({ data: mockResponse })

        const queryConfig = {
          index: 'products',
          query: { match_all: {} }
        }

        const result = await store.executeQuery(queryConfig)

        expect(api.post).toHaveBeenCalledWith('/elastic/query', queryConfig)
        expect(result).toEqual(mockResponse)
      })

      it('should handle query execution error', async () => {
        const store = useElasticStore()

        api.post.mockRejectedValue(new Error('Query syntax error'))

        await expect(store.executeQuery({})).rejects.toThrow()
        expect(store.error).toBe('Query syntax error')
      })
    })
  })

  describe('Actions', () => {
    describe('selectIndex', () => {
      it('should select index and fetch mapping', async () => {
        const store = useElasticStore()

        const mockFields = [
          { name: 'category', category: 'string' }
        ]

        api.get.mockResolvedValue({ data: mockFields })

        store.selectIndex('products')

        expect(store.currentIndex).toBe('products')

        // Wait for async mapping fetch
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(api.get).toHaveBeenCalledWith('/elastic/indices/products/mapping')
        expect(store.fields).toEqual(mockFields)
      })

      it('should update currentIndex immediately', () => {
        const store = useElasticStore()

        api.get.mockResolvedValue({ data: [] })

        store.selectIndex('logs')

        expect(store.currentIndex).toBe('logs')
      })
    })

    describe('reset', () => {
      it('should reset all state to initial values', () => {
        const store = useElasticStore()

        // Set up some state
        store.currentIndex = 'products'
        store.fields = [{ name: 'category' }]
        store.sampleData = [{ category: 'A' }]
        store.error = 'Some error'

        store.reset()

        expect(store.currentIndex).toBe(null)
        expect(store.fields).toEqual([])
        expect(store.sampleData).toEqual([])
        expect(store.error).toBe(null)
      })

      it('should not reset connection state', () => {
        const store = useElasticStore()

        store.connected = true
        store.connectionInfo = { cluster: 'test' }
        store.indices = [{ name: 'logs' }]

        store.reset()

        expect(store.connected).toBe(true)
        expect(store.connectionInfo).toEqual({ cluster: 'test' })
        expect(store.indices).toEqual([{ name: 'logs' }])
      })
    })

    describe('resetFields', () => {
      it('should reset fields and refetch mapping', async () => {
        const store = useElasticStore()
        store.currentIndex = 'products'
        store.fields = [{ name: 'old_field' }]
        store.error = 'Previous error'

        const mockFields = [{ name: 'new_field' }]
        api.get.mockResolvedValue({ data: mockFields })

        store.resetFields()

        expect(store.fields).toEqual([])
        expect(store.error).toBe(null)

        // Wait for async mapping fetch
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(api.get).toHaveBeenCalledWith('/elastic/indices/products/mapping')
        expect(store.fields).toEqual(mockFields)
      })

      it('should not refetch when no index selected', async () => {
        const store = useElasticStore()
        store.currentIndex = null
        store.fields = [{ name: 'field' }]

        store.resetFields()

        expect(store.fields).toEqual([])

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(api.get).not.toHaveBeenCalled()
      })
    })
  })
})
