import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useVegaStore } from '../vega'
import api from '@/services/api'

// Mock the API
vi.mock('@/services/api')

describe('Vega Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const store = useVegaStore()

      expect(store.visualizationTypes).toEqual([])
      expect(store.selectedType).toBe(null)
      expect(store.configSchema).toBe(null)
      expect(store.config).toEqual({})
      expect(store.generatedSpec).toBe(null)
      expect(store.loading).toEqual({
        types: false,
        schema: false,
        spec: false
      })
      expect(store.error).toBe(null)
    })

    it('should have vega-lite options structure', () => {
      const store = useVegaStore()

      expect(store.vegaLiteOptions).toBeDefined()
      expect(store.vegaLiteOptions.marks).toEqual([])
      expect(store.vegaLiteOptions.aggregates).toEqual([])
      expect(store.vegaLiteOptions.timeUnits).toEqual([])
      expect(store.vegaLiteOptions.scales).toEqual([])
      expect(store.vegaLiteOptions.colorSchemes).toEqual({
        categorical: [],
        sequential: [],
        diverging: []
      })
    })

    it('should have category labels defined', () => {
      const store = useVegaStore()

      expect(store.categoryLabels).toBeDefined()
      expect(store.categoryLabels.comparison).toBe('Comparison')
      expect(store.categoryLabels.trend).toBe('Trends')
      expect(store.categoryLabels.kpi).toBe('Single-Value')
    })

    it('should have category order defined', () => {
      const store = useVegaStore()

      expect(store.categoryOrder).toBeDefined()
      expect(Array.isArray(store.categoryOrder)).toBe(true)
      expect(store.categoryOrder.length).toBeGreaterThan(0)
      expect(store.categoryOrder[0]).toBe('comparison')
    })
  })

  describe('Computed Properties', () => {
    describe('typesByCategory', () => {
      it('should group visualization types by category', () => {
        const store = useVegaStore()

        store.visualizationTypes = [
          { id: 'bar', name: 'Bar Chart', category: 'comparison' },
          { id: 'line', name: 'Line Chart', category: 'trend' },
          { id: 'area', name: 'Area Chart', category: 'trend' },
          { id: 'pie', name: 'Pie Chart', category: 'composition' }
        ]

        const grouped = store.typesByCategory

        expect(grouped.comparison).toHaveLength(1)
        expect(grouped.trend).toHaveLength(2)
        expect(grouped.composition).toHaveLength(1)
        expect(grouped.comparison[0].id).toBe('bar')
        expect(grouped.trend[0].id).toBe('line')
      })

      it('should return empty object when no types', () => {
        const store = useVegaStore()

        expect(store.typesByCategory).toEqual({})
      })
    })

    describe('orderedTypesByCategory', () => {
      it('should return categories in categoryOrder sequence', () => {
        const store = useVegaStore()

        store.visualizationTypes = [
          { id: 'pie', name: 'Pie', category: 'composition' },
          { id: 'bar', name: 'Bar', category: 'comparison' },
          { id: 'line', name: 'Line', category: 'trend' }
        ]

        const ordered = store.orderedTypesByCategory

        const keys = Object.keys(ordered)
        expect(keys[0]).toBe('comparison') // First in categoryOrder
        expect(keys[1]).toBe('trend')      // Second in categoryOrder
        expect(keys[2]).toBe('composition') // Third in categoryOrder
      })

      it('should include categories not in categoryOrder at the end', () => {
        const store = useVegaStore()

        store.visualizationTypes = [
          { id: 'bar', name: 'Bar', category: 'comparison' },
          { id: 'custom', name: 'Custom', category: 'unknown_category' }
        ]

        const ordered = store.orderedTypesByCategory

        const keys = Object.keys(ordered)
        expect(keys[0]).toBe('comparison')
        expect(keys[1]).toBe('unknown_category') // Added at end
      })
    })

    describe('isConfigComplete', () => {
      it('should return false when no schema loaded', () => {
        const store = useVegaStore()

        expect(store.isConfigComplete).toBe(false)
      })

      it('should return true when all required fields provided', () => {
        const store = useVegaStore()

        store.configSchema = {
          fields: [
            { name: 'xField', required: true },
            { name: 'yField', required: true },
            { name: 'colorField', required: false }
          ]
        }

        store.config = {
          xField: 'category',
          yField: 'value'
        }

        expect(store.isConfigComplete).toBe(true)
      })

      it('should return false when required fields missing', () => {
        const store = useVegaStore()

        store.configSchema = {
          fields: [
            { name: 'xField', required: true },
            { name: 'yField', required: true }
          ]
        }

        store.config = {
          xField: 'category'
          // yField missing
        }

        expect(store.isConfigComplete).toBe(false)
      })

      it('should return false when required field is empty string', () => {
        const store = useVegaStore()

        store.configSchema = {
          fields: [
            { name: 'xField', required: true }
          ]
        }

        store.config = {
          xField: ''
        }

        expect(store.isConfigComplete).toBe(false)
      })

      it('should return false when required field is null', () => {
        const store = useVegaStore()

        store.configSchema = {
          fields: [
            { name: 'xField', required: true }
          ]
        }

        store.config = {
          xField: null
        }

        expect(store.isConfigComplete).toBe(false)
      })
    })

    describe('configValidation', () => {
      it('should return invalid when no schema', () => {
        const store = useVegaStore()

        const validation = store.configValidation

        expect(validation.valid).toBe(false)
        expect(validation.messages).toContain('No schema loaded')
      })

      it('should return valid when all required fields present', () => {
        const store = useVegaStore()

        store.configSchema = {
          fields: [
            { name: 'xField', label: 'X-Axis', required: true },
            { name: 'yField', label: 'Y-Axis', required: true }
          ]
        }

        store.config = {
          xField: 'category',
          yField: 'value'
        }

        const validation = store.configValidation

        expect(validation.valid).toBe(true)
        expect(validation.missing).toEqual([])
        expect(validation.messages).toEqual([])
      })

      it('should list missing required fields', () => {
        const store = useVegaStore()

        store.configSchema = {
          fields: [
            { name: 'xField', label: 'X-Axis', required: true },
            { name: 'yField', label: 'Y-Axis', required: true },
            { name: 'colorField', label: 'Color', required: false }
          ]
        }

        store.config = {
          xField: 'category'
          // yField missing
        }

        const validation = store.configValidation

        expect(validation.valid).toBe(false)
        expect(validation.missing).toEqual(['yField'])
        expect(validation.messages).toContain('Y-Axis is required')
      })

      it('should include current config snapshot', () => {
        const store = useVegaStore()

        store.configSchema = {
          fields: [{ name: 'xField', required: true }]
        }

        store.config = { xField: 'category', otherField: 'value' }

        const validation = store.configValidation

        expect(validation.currentConfig).toEqual({
          xField: 'category',
          otherField: 'value'
        })
      })

      it('should list required field names', () => {
        const store = useVegaStore()

        store.configSchema = {
          fields: [
            { name: 'xField', required: true },
            { name: 'yField', required: true },
            { name: 'colorField', required: false }
          ]
        }

        store.config = { xField: 'category', yField: 'value' }

        const validation = store.configValidation

        expect(validation.requiredFields).toEqual(['xField', 'yField'])
      })
    })
  })

  describe('API Integration', () => {
    describe('fetchVisualizationTypes', () => {
      it('should fetch visualization types successfully', async () => {
        const store = useVegaStore()
        const mockTypes = [
          { id: 'bar', name: 'Bar Chart', category: 'comparison' },
          { id: 'line', name: 'Line Chart', category: 'trend' }
        ]

        api.get.mockResolvedValue({ data: mockTypes })

        const result = await store.fetchVisualizationTypes()

        expect(api.get).toHaveBeenCalledWith('/vega/types')
        expect(store.visualizationTypes).toEqual(mockTypes)
        expect(result).toEqual(mockTypes)
        expect(store.loading.types).toBe(false)
      })

      it('should handle fetch error', async () => {
        const store = useVegaStore()

        api.get.mockRejectedValue({
          response: { data: { message: 'Network error' } }
        })

        await expect(store.fetchVisualizationTypes()).rejects.toThrow()
        expect(store.error).toBe('Network error')
        expect(store.loading.types).toBe(false)
      })

      it('should set loading state during fetch', async () => {
        const store = useVegaStore()

        api.get.mockImplementation(() => {
          expect(store.loading.types).toBe(true)
          return Promise.resolve({ data: [] })
        })

        await store.fetchVisualizationTypes()
      })
    })

    describe('fetchConfigSchema', () => {
      it('should fetch config schema for chart type', async () => {
        const store = useVegaStore()
        const mockSchema = {
          fields: [
            { name: 'xField', type: 'field', required: true, default: null },
            { name: 'yField', type: 'field', required: true, default: null },
            { name: 'width', type: 'number', required: false, default: 800 }
          ]
        }

        api.get.mockResolvedValue({ data: mockSchema })

        const result = await store.fetchConfigSchema('bar')

        expect(api.get).toHaveBeenCalledWith('/vega/types/bar/schema')
        expect(store.configSchema).toEqual(mockSchema)
        expect(result).toEqual(mockSchema)
      })

      it('should initialize config with default values', async () => {
        const store = useVegaStore()
        const mockSchema = {
          fields: [
            { name: 'xField', required: true, default: null },
            { name: 'width', required: false, default: 800 },
            { name: 'height', required: false, default: 500 }
          ]
        }

        api.get.mockResolvedValue({ data: mockSchema })

        await store.fetchConfigSchema('bar')

        expect(store.config.width).toBe(800)
        expect(store.config.height).toBe(500)
      })

      it('should preserve existing config when merging defaults', async () => {
        const store = useVegaStore()
        store.config = { xField: 'category', customField: 'value' }

        const mockSchema = {
          fields: [
            { name: 'width', default: 800 }
          ]
        }

        api.get.mockResolvedValue({ data: mockSchema })

        await store.fetchConfigSchema('bar')

        expect(store.config.xField).toBe('category')
        expect(store.config.customField).toBe('value')
        expect(store.config.width).toBe(800)
      })

      it('should handle fetch error', async () => {
        const store = useVegaStore()

        api.get.mockRejectedValue(new Error('Schema not found'))

        await expect(store.fetchConfigSchema('unknown')).rejects.toThrow()
        expect(store.error).toBe('Schema not found')
      })
    })

    describe('generateSpec', () => {
      it('should generate spec from config and data', async () => {
        const store = useVegaStore()
        store.selectedType = 'bar'
        store.config = { xField: 'category', yField: 'value' }

        const mockSpec = {
          $schema: 'https://vega.github.io/schema/vega/v5.json',
          marks: [{ type: 'rect' }]
        }

        api.post.mockResolvedValue({ data: mockSpec })

        const data = [{ category: 'A', value: 100 }]
        const result = await store.generateSpec(data)

        expect(api.post).toHaveBeenCalledWith('/vega/generate', {
          type: 'bar',
          config: { xField: 'category', yField: 'value' },
          data
        })
        expect(store.generatedSpec).toEqual(mockSpec)
        expect(result).toEqual(mockSpec)
      })

      it('should include colorConfig in generation request', async () => {
        const store = useVegaStore()
        store.selectedType = 'bar'
        store.config = {
          xField: 'category',
          yField: 'value',
          colorConfig: { scheme: 'blues' }
        }

        api.post.mockResolvedValue({ data: {} })

        await store.generateSpec([])

        const callArgs = api.post.mock.calls[0][1]
        expect(callArgs.config.colorConfig).toEqual({ scheme: 'blues' })
      })

      it('should handle generation error', async () => {
        const store = useVegaStore()
        store.selectedType = 'bar'

        api.post.mockRejectedValue({
          response: { data: { message: 'Invalid configuration' } }
        })

        await expect(store.generateSpec([])).rejects.toThrow()
        expect(store.error).toBe('Invalid configuration')
      })
    })

    describe('generateKibanaSpec', () => {
      it('should generate Kibana-compatible spec', async () => {
        const store = useVegaStore()
        store.selectedType = 'bar'
        store.config = { xField: 'category', yField: 'value' }

        const mockKibanaSpec = {
          $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
          data: { url: { index: 'test_index' } }
        }

        api.post.mockResolvedValue({ data: mockKibanaSpec })

        const elasticConfig = {
          index: 'test_index',
          aggregation: { bucketAgg: { type: 'terms', field: 'category' } }
        }

        const result = await store.generateKibanaSpec(elasticConfig)

        expect(api.post).toHaveBeenCalledWith('/vega/generate-kibana', {
          type: 'bar',
          config: { xField: 'category', yField: 'value' },
          elasticConfig
        })
        expect(result).toEqual(mockKibanaSpec)
      })

      it('should handle Kibana generation error', async () => {
        const store = useVegaStore()
        store.selectedType = 'bar'

        api.post.mockRejectedValue(new Error('Kibana generation failed'))

        await expect(store.generateKibanaSpec({})).rejects.toThrow()
        expect(store.error).toBe('Kibana generation failed')
      })
    })

    describe('getExample', () => {
      it('should fetch example for chart type', async () => {
        const store = useVegaStore()

        const mockExample = {
          config: { xField: 'category', yField: 'value' },
          data: [{ category: 'A', value: 100 }]
        }

        api.get.mockResolvedValue({ data: mockExample })

        const result = await store.getExample('bar')

        expect(api.get).toHaveBeenCalledWith('/vega/examples/bar')
        expect(result).toEqual(mockExample)
      })

      it('should return null on error', async () => {
        const store = useVegaStore()

        api.get.mockRejectedValue(new Error('Not found'))

        const result = await store.getExample('unknown')

        expect(result).toBe(null)
      })
    })

    describe('validateSpec', () => {
      it('should validate Vega spec', async () => {
        const store = useVegaStore()

        api.post.mockResolvedValue({
          data: { valid: true, errors: [] }
        })

        const spec = { $schema: 'https://vega.github.io/schema/vega/v5.json' }
        const result = await store.validateSpec(spec)

        expect(api.post).toHaveBeenCalledWith('/vega/validate', { spec })
        expect(result.valid).toBe(true)
      })

      it('should return invalid result on error', async () => {
        const store = useVegaStore()

        api.post.mockRejectedValue(new Error('Validation failed'))

        const result = await store.validateSpec({})

        expect(result.valid).toBe(false)
        expect(result.errors).toEqual(['Validation failed'])
      })
    })

    describe('validateConfig', () => {
      it('should validate config before generation', async () => {
        const store = useVegaStore()
        store.selectedType = 'bar'
        store.config = { xField: 'category', yField: 'value' }

        api.post.mockResolvedValue({
          data: { valid: true, canGenerate: true, errors: [] }
        })

        const data = [{ category: 'A', value: 100 }]
        const result = await store.validateConfig(data)

        expect(api.post).toHaveBeenCalledWith('/vega/types/bar/validate-config', {
          config: { xField: 'category', yField: 'value' },
          data
        })
        expect(result.valid).toBe(true)
      })

      it('should return invalid when no chart type selected', async () => {
        const store = useVegaStore()
        store.selectedType = null

        const result = await store.validateConfig([])

        expect(result.valid).toBe(false)
        expect(result.canGenerate).toBe(false)
        expect(result.errors[0].message).toBe('No chart type selected')
      })

      it('should handle validation error', async () => {
        const store = useVegaStore()
        store.selectedType = 'bar'

        api.post.mockRejectedValue(new Error('Validation error'))

        const result = await store.validateConfig([])

        expect(result.valid).toBe(false)
        expect(result.canGenerate).toBe(false)
      })
    })

    describe('fetchVegaLiteOptions', () => {
      it('should fetch all Vega-Lite schema options', async () => {
        const store = useVegaStore()

        api.get.mockImplementation((url) => {
          const responses = {
            '/vega/vegalite/marks': { data: ['bar', 'line', 'point'] },
            '/vega/vegalite/aggregates': { data: ['sum', 'avg', 'count'] },
            '/vega/vegalite/timeunits': { data: ['year', 'month', 'day'] },
            '/vega/vegalite/scales': { data: ['linear', 'log', 'pow'] },
            '/vega/vegalite/colorschemes': {
              data: {
                categorical: ['tableau10', 'category20'],
                sequential: ['blues', 'greens'],
                diverging: ['blueorange', 'redblue']
              }
            }
          }
          return Promise.resolve(responses[url])
        })

        const result = await store.fetchVegaLiteOptions()

        expect(store.vegaLiteOptions.marks).toEqual(['bar', 'line', 'point'])
        expect(store.vegaLiteOptions.aggregates).toEqual(['sum', 'avg', 'count'])
        expect(store.vegaLiteOptions.timeUnits).toEqual(['year', 'month', 'day'])
        expect(store.vegaLiteOptions.scales).toEqual(['linear', 'log', 'pow'])
        expect(store.vegaLiteOptions.colorSchemes.categorical).toEqual(['tableau10', 'category20'])
        expect(result).toEqual(store.vegaLiteOptions)
      })

      it('should handle fetch error', async () => {
        const store = useVegaStore()

        api.get.mockRejectedValue(new Error('Network error'))

        await expect(store.fetchVegaLiteOptions()).rejects.toThrow()
        expect(store.error).toBe('Network error')
      })
    })

    describe('generateFromAggregation', () => {
      it('should generate Vega-Lite from aggregation', async () => {
        const store = useVegaStore()

        const mockSpec = {
          $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
          mark: 'bar'
        }

        api.post.mockResolvedValue({ data: mockSpec })

        const options = {
          data: [{ category: 'A', count: 100 }],
          aggregation: { bucketAgg: { type: 'terms', field: 'category' } }
        }

        const result = await store.generateFromAggregation(options)

        expect(api.post).toHaveBeenCalledWith('/vega/vegalite/from-aggregation', options)
        expect(store.generatedSpec).toEqual(mockSpec)
        expect(result).toEqual(mockSpec)
      })
    })

    describe('generateVegaLiteChart', () => {
      it('should generate specific Vega-Lite chart type', async () => {
        const store = useVegaStore()

        const mockSpec = {
          $schema: 'https://vega.github.io/schema/vega-lite/v5.json'
        }

        api.post.mockResolvedValue({ data: mockSpec })

        const options = {
          data: [],
          encoding: { x: { field: 'category' } }
        }

        const result = await store.generateVegaLiteChart('bar', options)

        expect(api.post).toHaveBeenCalledWith('/vega/vegalite/chart/bar', options)
        expect(result).toEqual(mockSpec)
      })
    })
  })

  describe('Actions', () => {
    describe('selectType', () => {
      it('should select chart type and fetch schema', async () => {
        const store = useVegaStore()

        const mockSchema = {
          fields: [{ name: 'xField', required: true }]
        }

        api.get.mockResolvedValue({ data: mockSchema })

        store.selectType('bar')

        expect(store.selectedType).toBe('bar')
        expect(store.config.width).toBe(800)
        expect(store.config.height).toBe(500)
        expect(store.generatedSpec).toBe(null)

        // Wait for async schema fetch
        await new Promise(resolve => setTimeout(resolve, 10))
        expect(api.get).toHaveBeenCalledWith('/vega/types/bar/schema')
      })

      it('should reset config to defaults when selecting type', () => {
        const store = useVegaStore()
        store.config = { xField: 'category', yField: 'value', customField: 'test' }

        api.get.mockResolvedValue({ data: { fields: [] } })

        store.selectType('line')

        expect(store.config.width).toBe(800)
        expect(store.config.height).toBe(500)
        // Previous config cleared except dimensions
        expect(store.config.xField).toBeUndefined()
      })

      it('should clear generated spec when selecting new type', () => {
        const store = useVegaStore()
        store.generatedSpec = { $schema: 'test' }

        api.get.mockResolvedValue({ data: { fields: [] } })

        store.selectType('pie')

        expect(store.generatedSpec).toBe(null)
      })
    })

    describe('updateConfig', () => {
      it('should update single config field', () => {
        const store = useVegaStore()
        store.config = { xField: 'category' }

        store.updateConfig('yField', 'value')

        expect(store.config).toEqual({
          xField: 'category',
          yField: 'value'
        })
      })

      it('should update multiple fields with object', () => {
        const store = useVegaStore()
        store.config = { width: 800 }

        store.updateConfig({
          xField: 'category',
          yField: 'value',
          colorField: 'region'
        })

        expect(store.config).toEqual({
          width: 800,
          xField: 'category',
          yField: 'value',
          colorField: 'region'
        })
      })

      it('should preserve existing config when updating', () => {
        const store = useVegaStore()
        store.config = {
          xField: 'category',
          yField: 'value',
          width: 800
        }

        store.updateConfig('colorField', 'region')

        expect(store.config.xField).toBe('category')
        expect(store.config.yField).toBe('value')
        expect(store.config.width).toBe(800)
        expect(store.config.colorField).toBe('region')
      })
    })

    describe('setFullConfig', () => {
      it('should replace entire config', () => {
        const store = useVegaStore()
        store.config = { xField: 'old', yField: 'old' }

        store.setFullConfig({
          xField: 'new',
          colorField: 'region'
        })

        expect(store.config).toEqual({
          xField: 'new',
          colorField: 'region'
        })
        expect(store.config.yField).toBeUndefined()
      })
    })

    describe('reset', () => {
      it('should reset all state to initial values', () => {
        const store = useVegaStore()

        // Set up some state
        store.selectedType = 'bar'
        store.configSchema = { fields: [] }
        store.config = { xField: 'category' }
        store.generatedSpec = { $schema: 'test' }
        store.error = 'Some error'

        store.reset()

        expect(store.selectedType).toBe(null)
        expect(store.configSchema).toBe(null)
        expect(store.config).toEqual({})
        expect(store.generatedSpec).toBe(null)
        expect(store.error).toBe(null)
      })
    })

    describe('clearFieldConfigs', () => {
      it('should clear only field-type config values', () => {
        const store = useVegaStore()

        store.configSchema = {
          fields: [
            { name: 'xField', type: 'field' },
            { name: 'yField', type: 'field' },
            { name: 'measures', type: 'fields' },
            { name: 'width', type: 'number' },
            { name: 'colorScheme', type: 'select' }
          ]
        }

        store.config = {
          xField: 'category',
          yField: 'value',
          measures: ['sales', 'profit'],
          width: 800,
          colorScheme: 'blues'
        }

        store.clearFieldConfigs()

        expect(store.config.xField).toBeUndefined()
        expect(store.config.yField).toBeUndefined()
        expect(store.config.measures).toBeUndefined()
        expect(store.config.width).toBe(800) // Preserved
        expect(store.config.colorScheme).toBe('blues') // Preserved
      })

      it('should do nothing when no schema loaded', () => {
        const store = useVegaStore()
        store.configSchema = null
        store.config = { xField: 'category' }

        store.clearFieldConfigs()

        expect(store.config.xField).toBe('category')
      })
    })
  })
})
