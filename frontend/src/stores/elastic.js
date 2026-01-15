import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'

export const useElasticStore = defineStore('elastic', () => {
  // State
  const connected = ref(false)
  const connectionInfo = ref(null)
  const indices = ref([])
  const currentIndex = ref(null)
  const fields = ref([])
  const sampleData = ref([])
  const sampleSize = ref(5000)  // Default sample size
  const loading = ref({
    connection: false,
    indices: false,
    fields: false,
    data: false
  })
  const error = ref(null)

  // Getters - categorized by field type (like Kibana)
  const numericFields = computed(() => 
    fields.value.filter(f => f.category === 'number')
  )

  const stringFields = computed(() => 
    fields.value.filter(f => f.category === 'string')
  )

  const dateFields = computed(() => 
    fields.value.filter(f => f.category === 'date')
  )

  const geoFields = computed(() => 
    fields.value.filter(f => f.category === 'geo')
  )

  const booleanFields = computed(() => 
    fields.value.filter(f => f.category === 'boolean')
  )

  // Only aggregatable fields (for bucket/metric aggregations)
  const aggregatableFields = computed(() => 
    fields.value.filter(f => f.aggregatable)
  )

  // Aggregatable string fields (for terms aggregation)
  const aggregatableStringFields = computed(() => 
    fields.value.filter(f => f.aggregatable && f.category === 'string')
  )

  // Aggregatable numeric fields (for metrics)
  const aggregatableNumericFields = computed(() => 
    fields.value.filter(f => f.aggregatable && f.category === 'number')
  )

  // Aggregatable date fields (for date histogram)
  const aggregatableDateFields = computed(() => 
    fields.value.filter(f => f.aggregatable && f.category === 'date')
  )

  // Primary fields (not subfields, like .keyword)
  const primaryFields = computed(() => 
    fields.value.filter(f => !f.isSubfield)
  )

  // Group fields by category for UI
  const fieldsByCategory = computed(() => {
    const categories = {
      number: { label: 'Numeric', icon: 'hash', fields: [] },
      string: { label: 'String', icon: 'type', fields: [] },
      date: { label: 'Date', icon: 'calendar', fields: [] },
      geo: { label: 'Geo', icon: 'map-pin', fields: [] },
      boolean: { label: 'Boolean', icon: 'toggle-left', fields: [] },
      other: { label: 'Other', icon: 'box', fields: [] }
    }
    
    fields.value.forEach(f => {
      const cat = f.category || 'other'
      if (categories[cat]) {
        categories[cat].fields.push(f)
      } else {
        categories.other.fields.push(f)
      }
    })
    
    return categories
  })

  // Legacy compatibility
  const textFields = computed(() => stringFields.value)
  
  const fieldsByType = computed(() => ({
    numeric: numericFields.value,
    text: stringFields.value,
    date: dateFields.value,
    all: fields.value
  }))

  // Field mappings object for recommendation engine (maps field name -> type info)
  const fieldMappings = computed(() => {
    const mappings = {}
    fields.value.forEach(f => {
      mappings[f.name] = {
        type: f.esType || f.type || 'unknown',
        category: f.category,
        aggregatable: f.aggregatable,
        searchable: f.searchable
      }
    })
    return mappings
  })

  // Actions
  async function checkConnection() {
    loading.value.connection = true
    error.value = null
    try {
      const response = await api.get('/elastic/connection')
      connected.value = response.data.connected
      connectionInfo.value = response.data
      return response.data
    } catch (err) {
      connected.value = false
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.connection = false
    }
  }

  async function fetchIndices() {
    loading.value.indices = true
    error.value = null
    try {
      const response = await api.get('/elastic/indices')
      indices.value = response.data
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.indices = false
    }
  }

  async function fetchMapping(indexName) {
    loading.value.fields = true
    error.value = null
    currentIndex.value = indexName
    try {
      const response = await api.get(`/elastic/indices/${indexName}/mapping`)
      fields.value = response.data
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.fields = false
    }
  }

  async function fetchSampleData(indexName, size = null) {
    // Use provided size, or fall back to store's sampleSize
    const fetchSize = size ?? sampleSize.value
    loading.value.data = true
    error.value = null
    try {
      const response = await api.get(`/elastic/indices/${indexName}/sample`, {
        params: { size: fetchSize }
      })
      sampleData.value = response.data.hits
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.data = false
    }
  }

  function setSampleSize(size) {
    sampleSize.value = size
    // Refetch if we have a current index
    if (currentIndex.value) {
      fetchSampleData(currentIndex.value, size)
    }
  }

  async function fetchFieldValues(indexName, fieldName, size = 100) {
    try {
      const response = await api.get(`/elastic/indices/${indexName}/fields/${fieldName}/values`, {
        params: { size }
      })
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    }
  }

  async function fetchFieldStats(indexName, fieldName) {
    try {
      const response = await api.get(`/elastic/indices/${indexName}/fields/${fieldName}/stats`)
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    }
  }

  async function executeQuery(queryConfig) {
    loading.value.data = true
    error.value = null
    try {
      const response = await api.post('/elastic/query', queryConfig)
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.data = false
    }
  }

  function selectIndex(indexName) {
    currentIndex.value = indexName
    fetchMapping(indexName)
    // Note: fetchSampleData is called separately by the caller with proper sampleSize
  }

  // Reset all state
  function reset() {
    currentIndex.value = null
    fields.value = []
    sampleData.value = []
    error.value = null
  }

  // Reset just the field selection (useful for re-fetching)
  function resetFields() {
    fields.value = []
    error.value = null
    if (currentIndex.value) {
      fetchMapping(currentIndex.value)
    }
  }

  return {
    // State
    connected,
    connectionInfo,
    indices,
    currentIndex,
    fields,
    sampleData,
    sampleSize,
    loading,
    error,
    
    // Getters
    numericFields,
    stringFields,
    textFields, // Legacy alias
    dateFields,
    geoFields,
    booleanFields,
    aggregatableFields,
    aggregatableStringFields,
    aggregatableNumericFields,
    aggregatableDateFields,
    primaryFields,
    fieldsByCategory,
    fieldsByType,
    fieldMappings,
    
    // Actions
    checkConnection,
    fetchIndices,
    fetchMapping,
    fetchSampleData,
    setSampleSize,
    fetchFieldValues,
    fetchFieldStats,
    executeQuery,
    selectIndex,
    reset,
    resetFields
  }
})

