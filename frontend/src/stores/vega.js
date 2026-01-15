import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'

export const useVegaStore = defineStore('vega', () => {
  // State
  const visualizationTypes = ref([])
  const selectedType = ref(null)
  const configSchema = ref(null)
  const config = ref({})
  const generatedSpec = ref(null)
  const loading = ref({
    types: false,
    schema: false,
    spec: false
  })
  const error = ref(null)
  
  // Vega-Lite schema options (from v5 spec)
  const vegaLiteOptions = ref({
    marks: [],
    aggregates: [],
    timeUnits: [],
    scales: [],
    colorSchemes: { categorical: [], sequential: [], diverging: [] }
  })

  // Getters
  const typesByCategory = computed(() => {
    const categories = {}
    for (const type of visualizationTypes.value) {
      if (!categories[type.category]) {
        categories[type.category] = []
      }
      categories[type.category].push(type)
    }
    return categories
  })

  // Ordered list of categories (determines display order)
  const categoryOrder = [
    'comparison',
    'trend',
    'flow',
    'distribution',
    'composition',
    'relationship',
    'hierarchy',
    'raw'
  ]

  const categoryLabels = {
    comparison: 'Comparison',
    trend: 'Trends',
    flow: 'Flow',
    distribution: 'Distribution',
    composition: 'Composition',
    relationship: 'Relationship',
    correlation: 'Correlation',
    hierarchy: 'Hierarchy',
    raw: 'Raw Data'
  }

  // Ordered typesByCategory - returns categories in preferred order
  const orderedTypesByCategory = computed(() => {
    const categories = {}
    for (const type of visualizationTypes.value) {
      if (!categories[type.category]) {
        categories[type.category] = []
      }
      categories[type.category].push(type)
    }
    
    // Return as ordered array of [category, types] pairs
    const ordered = {}
    for (const cat of categoryOrder) {
      if (categories[cat]) {
        ordered[cat] = categories[cat]
      }
    }
    // Add any remaining categories not in the order list
    for (const cat of Object.keys(categories)) {
      if (!ordered[cat]) {
        ordered[cat] = categories[cat]
      }
    }
    return ordered
  })

  const isConfigComplete = computed(() => {
    if (!configSchema.value) return false
    
    const requiredFields = configSchema.value.fields.filter(f => f.required)
    return requiredFields.every(field => {
      const value = config.value[field.name]
      return value !== undefined && value !== null && value !== ''
    })
  })

  // Detailed validation diagnostics - shows what's missing
  const configValidation = computed(() => {
    if (!configSchema.value) {
      return { valid: false, missing: [], messages: ['No schema loaded'] }
    }
    
    const requiredFields = configSchema.value.fields.filter(f => f.required)
    const missing = []
    const messages = []
    
    for (const field of requiredFields) {
      const value = config.value[field.name]
      const hasValue = value !== undefined && value !== null && value !== ''
      
      if (!hasValue) {
        missing.push(field.name)
        messages.push(`${field.label || field.name} is required`)
      }
    }
    
    return {
      valid: missing.length === 0,
      missing,
      messages,
      currentConfig: { ...config.value },
      requiredFields: requiredFields.map(f => f.name)
    }
  })

  // Actions
  async function fetchVisualizationTypes() {
    loading.value.types = true
    error.value = null
    try {
      const response = await api.get('/vega/types')
      visualizationTypes.value = response.data
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.types = false
    }
  }

  async function fetchConfigSchema(type) {
    loading.value.schema = true
    error.value = null
    try {
      const response = await api.get(`/vega/types/${type}/schema`)
      configSchema.value = response.data
      
      // Initialize config with defaults
      const defaults = {}
      for (const field of response.data.fields) {
        if (field.default !== undefined) {
          defaults[field.name] = field.default
        }
      }
      config.value = { ...defaults, ...config.value }
      
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.schema = false
    }
  }

  async function generateSpec(data) {
    loading.value.spec = true
    error.value = null
    try {
      // Debug: log the config including colorConfig
      console.debug('[VegaStore] Generating spec with config:', {
        type: selectedType.value,
        configKeys: Object.keys(config.value),
        colorConfig: config.value.colorConfig
      })

      const response = await api.post('/vega/generate', {
        type: selectedType.value,
        config: config.value,
        data
      })
      generatedSpec.value = response.data

      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.spec = false
    }
  }

  // Generate Kibana-compatible spec with Elasticsearch query (returns spec object)
  async function generateKibanaSpec(elasticConfig) {
    try {
      const response = await api.post('/vega/generate-kibana', {
        type: selectedType.value,
        config: config.value,
        elasticConfig
      })
      // Return the Vega-Lite spec object (same format as preview, but with url data source)
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    }
  }

  async function getExample(type) {
    try {
      const response = await api.get(`/vega/examples/${type}`)
      return response.data
    } catch (err) {
      return null
    }
  }

  async function validateSpec(spec) {
    try {
      const response = await api.post('/vega/validate', { spec })
      return response.data
    } catch (err) {
      return { valid: false, errors: [err.message] }
    }
  }

  // Pre-validate configuration before attempting generation
  async function validateConfig(data) {
    if (!selectedType.value) {
      return { valid: false, canGenerate: false, errors: [{ message: 'No chart type selected' }] }
    }
    
    try {
      const response = await api.post(`/vega/types/${selectedType.value}/validate-config`, {
        config: config.value,
        data
      })
      
      if (!response.data.valid) {
        console.warn('[VegaStore] Config validation failed:', response.data)
      }
      
      return response.data
    } catch (err) {
      console.error('[VegaStore] Config validation error:', err)
      return { valid: false, canGenerate: false, errors: [{ message: err.message }] }
    }
  }

  // Fetch Vega-Lite schema options
  async function fetchVegaLiteOptions() {
    try {
      const [marks, aggregates, timeUnits, scales, colorSchemes] = await Promise.all([
        api.get('/vega/vegalite/marks'),
        api.get('/vega/vegalite/aggregates'),
        api.get('/vega/vegalite/timeunits'),
        api.get('/vega/vegalite/scales'),
        api.get('/vega/vegalite/colorschemes')
      ])
      
      vegaLiteOptions.value = {
        marks: marks.data,
        aggregates: aggregates.data,
        timeUnits: timeUnits.data,
        scales: scales.data,
        colorSchemes: colorSchemes.data
      }
      
      return vegaLiteOptions.value
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    }
  }

  // Generate Vega-Lite spec from aggregated data
  async function generateFromAggregation(options) {
    loading.value.spec = true
    error.value = null
    try {
      const response = await api.post('/vega/vegalite/from-aggregation', options)
      generatedSpec.value = response.data
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.spec = false
    }
  }

  // Generate Vega-Lite chart by type
  async function generateVegaLiteChart(chartType, options) {
    loading.value.spec = true
    error.value = null
    try {
      const response = await api.post(`/vega/vegalite/chart/${chartType}`, options)
      generatedSpec.value = response.data
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.spec = false
    }
  }

  async function selectType(type) {
    selectedType.value = type
    // Set default dimensions for larger chart preview
    config.value = {
      width: 800,
      height: 500
    }
    generatedSpec.value = null
    await fetchConfigSchema(type)
  }

  function updateConfig(fieldOrObject, value) {
    // Support both single field update: updateConfig('field', value)
    // And batch update: updateConfig({ field1: value1, field2: value2 })
    if (typeof fieldOrObject === 'object' && fieldOrObject !== null) {
      config.value = { ...config.value, ...fieldOrObject }
    } else {
      config.value = { ...config.value, [fieldOrObject]: value }
    }
  }

  function setFullConfig(newConfig) {
    config.value = { ...newConfig }
  }

  function reset() {
    selectedType.value = null
    configSchema.value = null
    config.value = {}
    generatedSpec.value = null
    error.value = null
  }

  // Clear only the field-related config values (used when data source changes)
  function clearFieldConfigs() {
    if (!configSchema.value) return
    
    const fieldNames = configSchema.value.fields
      .filter(f => f.type === 'field' || f.type === 'fields')
      .map(f => f.name)
    
    const newConfig = { ...config.value }
    for (const fieldName of fieldNames) {
      delete newConfig[fieldName]
    }
    config.value = newConfig
  }

  return {
    // State
    visualizationTypes,
    selectedType,
    configSchema,
    config,
    generatedSpec,
    loading,
    error,
    vegaLiteOptions,
    
    // Getters
    typesByCategory,
    orderedTypesByCategory,
    categoryLabels,
    categoryOrder,
    isConfigComplete,
    configValidation,
    
    // Actions
    fetchVisualizationTypes,
    fetchConfigSchema,
    generateSpec,
    generateKibanaSpec,
    getExample,
    validateSpec,
    validateConfig,
    fetchVegaLiteOptions,
    generateFromAggregation,
    generateVegaLiteChart,
    selectType,
    updateConfig,
    setFullConfig,
    reset,
    clearFieldConfigs
  }
})

