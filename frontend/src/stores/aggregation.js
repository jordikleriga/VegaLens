import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'

export const useAggregationStore = defineStore('aggregation', () => {
  // State
  const aggregationTypes = ref({ bucket: [], metric: [] })
  const dateIntervals = ref([])
  
  /**
   * Enhanced aggregation configuration supporting:
   * - Multi-level bucket aggregations (nested hierarchies like Kibana)
   * - Multiple metrics per visualization
   * - Rank by / Order options per bucket
   * - Split series/chart configuration
   */
  const currentConfig = ref({
    // Legacy single bucket (for backward compatibility)
    bucketAgg: null,
    
    // NEW: Multi-level bucket aggregations (array for hierarchical grouping)
    // Each bucket can be nested inside the previous one
    bucketAggs: [],
    
    // Multiple metrics with unique IDs
    metrics: [],
    
    // Split configuration for series/facets
    splitBy: null,
    splitConfig: {
      enabled: false,
      type: 'series',  // 'series' (color/overlay) or 'chart' (facets/small multiples)
      field: null,
      maxBuckets: 5,
      columns: 3  // For chart split - grid columns
    },
    
    // Query filters
    query: null
  })
  const aggregatedData = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Available color schemes organized by category
  const colorSchemes = {
    categorical: [
      { id: 'category10', name: 'Category 10', colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'] },
      { id: 'category20', name: 'Category 20', colors: ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5'] },
      { id: 'tableau10', name: 'Tableau 10', colors: ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'] },
      { id: 'set1', name: 'Set 1', colors: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'] },
      { id: 'set2', name: 'Set 2', colors: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'] },
      { id: 'set3', name: 'Set 3', colors: ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5'] },
      { id: 'pastel1', name: 'Pastel 1', colors: ['#fbb4ae', '#b3cde3', '#ccebc5', '#decbe4', '#fed9a6', '#ffffcc', '#e5d8bd', '#fddaec'] },
      { id: 'dark2', name: 'Dark 2', colors: ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#666666'] }
    ],
    sequential: [
      { id: 'blues', name: 'Blues', type: 'sequential' },
      { id: 'greens', name: 'Greens', type: 'sequential' },
      { id: 'reds', name: 'Reds', type: 'sequential' },
      { id: 'oranges', name: 'Oranges', type: 'sequential' },
      { id: 'purples', name: 'Purples', type: 'sequential' },
      { id: 'greys', name: 'Greys', type: 'sequential' },
      { id: 'viridis', name: 'Viridis', type: 'sequential' },
      { id: 'magma', name: 'Magma', type: 'sequential' },
      { id: 'plasma', name: 'Plasma', type: 'sequential' },
      { id: 'inferno', name: 'Inferno', type: 'sequential' },
      { id: 'cividis', name: 'Cividis', type: 'sequential' },
      { id: 'turbo', name: 'Turbo', type: 'sequential' }
    ],
    diverging: [
      { id: 'blueorange', name: 'Blue-Orange', type: 'diverging' },
      { id: 'redblue', name: 'Red-Blue', type: 'diverging' },
      { id: 'redgrey', name: 'Red-Grey', type: 'diverging' },
      { id: 'redyellowblue', name: 'Red-Yellow-Blue', type: 'diverging' },
      { id: 'redyellowgreen', name: 'Red-Yellow-Green', type: 'diverging' },
      { id: 'pinkgreen', name: 'Pink-Green', type: 'diverging' },
      { id: 'purplegreen', name: 'Purple-Green', type: 'diverging' },
      { id: 'purpleorange', name: 'Purple-Orange', type: 'diverging' },
      { id: 'spectral', name: 'Spectral', type: 'diverging' }
    ]
  }

  // Preset color palettes for quick selection
  const presetColors = [
    '#0ea5e9', // Ocean blue
    '#f97316', // Coral orange
    '#22c55e', // Emerald green
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#6366f1', // Indigo
    '#f43f5e', // Rose
  ]

  // Getters
  const bucketAggTypes = computed(() => aggregationTypes.value.bucket)
  const metricAggTypes = computed(() => aggregationTypes.value.metric)
  
  // Has aggregation if either legacy bucketAgg or new bucketAggs array has items
  const hasAggregation = computed(() => 
    currentConfig.value.bucketAgg !== null || 
    (currentConfig.value.bucketAggs && currentConfig.value.bucketAggs.length > 0)
  )
  
  // Get effective bucket aggregations (supports both legacy and new format)
  const effectiveBucketAggs = computed(() => {
    if (currentConfig.value.bucketAggs && currentConfig.value.bucketAggs.length > 0) {
      return currentConfig.value.bucketAggs
    }
    if (currentConfig.value.bucketAgg) {
      return [currentConfig.value.bucketAgg]
    }
    return []
  })
  
  // Check if using multi-level aggregations
  const isMultiLevel = computed(() => 
    currentConfig.value.bucketAggs && currentConfig.value.bucketAggs.length > 1
  )

  // Actions
  async function fetchAggregationTypes() {
    try {
      const response = await api.get('/aggregations/types')
      aggregationTypes.value = response.data
    } catch (err) {
      error.value = err.message
    }
  }

  async function fetchDateIntervals() {
    try {
      const response = await api.get('/aggregations/date-intervals')
      dateIntervals.value = response.data
    } catch (err) {
      error.value = err.message
    }
  }

  async function executeAggregation(index) {
    if (!currentConfig.value.bucketAgg) {
      return { data: [] }
    }

    loading.value = true
    error.value = null

    try {
      const response = await api.post('/aggregations/execute', {
        index,
        config: currentConfig.value
      })
      aggregatedData.value = response.data.data
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function previewQuery(index) {
    try {
      const response = await api.post('/aggregations/preview-query', {
        index,
        config: currentConfig.value
      })
      return response.data
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // ===== Bucket Aggregation Actions =====
  
  // Legacy: Set single bucket aggregation (backward compatible)
  function setBucketAggregation(config) {
    currentConfig.value.bucketAgg = config
    // Sync to bucketAggs array while PRESERVING additional bucket levels (sub-groupings)
    // Only update the first (primary) bucket, keep any additional levels intact
    if (config) {
      if (currentConfig.value.bucketAggs && currentConfig.value.bucketAggs.length > 1) {
        // Preserve sub-groupings: update only the primary bucket (index 0)
        currentConfig.value.bucketAggs[0] = config
      } else {
        // No sub-groupings, reset to single bucket
        currentConfig.value.bucketAggs = [config]
      }
    } else {
      currentConfig.value.bucketAggs = []
    }
  }
  
  // NEW: Add a bucket level to the hierarchy
  function addBucketLevel(config) {
    if (!currentConfig.value.bucketAggs) {
      currentConfig.value.bucketAggs = []
    }
    currentConfig.value.bucketAggs.push({
      id: `bucket_${Date.now()}`,
      ...config,
      // Default order options
      orderBy: config.orderBy || '_count',
      orderDirection: config.orderDirection || 'desc',
      orderMetric: config.orderMetric || null
    })
    // Sync legacy field for backward compatibility
    if (currentConfig.value.bucketAggs.length === 1) {
      currentConfig.value.bucketAgg = currentConfig.value.bucketAggs[0]
    }
  }
  
  // NEW: Update a bucket level
  function updateBucketLevel(index, config) {
    if (currentConfig.value.bucketAggs && currentConfig.value.bucketAggs[index]) {
      currentConfig.value.bucketAggs[index] = {
        ...currentConfig.value.bucketAggs[index],
        ...config
      }
      // Sync legacy field
      if (index === 0) {
        currentConfig.value.bucketAgg = currentConfig.value.bucketAggs[0]
      }
    }
  }
  
  // NEW: Remove a bucket level
  function removeBucketLevel(index) {
    if (currentConfig.value.bucketAggs) {
      currentConfig.value.bucketAggs.splice(index, 1)
      // Sync legacy field
      currentConfig.value.bucketAgg = currentConfig.value.bucketAggs[0] || null
    }
  }
  
  // NEW: Reorder bucket levels (for drag-drop)
  function reorderBucketLevels(fromIndex, toIndex) {
    if (currentConfig.value.bucketAggs) {
      const [moved] = currentConfig.value.bucketAggs.splice(fromIndex, 1)
      currentConfig.value.bucketAggs.splice(toIndex, 0, moved)
      // Sync legacy field
      currentConfig.value.bucketAgg = currentConfig.value.bucketAggs[0] || null
    }
  }
  
  // NEW: Clear all bucket levels
  function clearBucketLevels() {
    currentConfig.value.bucketAggs = []
    currentConfig.value.bucketAgg = null
  }

  // ===== Metric Actions =====

  function addMetric(metric) {
    const metricWithId = {
      id: `metric_${Date.now()}`,
      ...metric
    }
    currentConfig.value.metrics.push(metricWithId)
  }

  function removeMetric(index) {
    currentConfig.value.metrics.splice(index, 1)
  }

  function updateMetric(index, metric) {
    currentConfig.value.metrics[index] = {
      ...currentConfig.value.metrics[index],
      ...metric
    }
  }
  
  // NEW: Reorder metrics
  function reorderMetrics(fromIndex, toIndex) {
    const [moved] = currentConfig.value.metrics.splice(fromIndex, 1)
    currentConfig.value.metrics.splice(toIndex, 0, moved)
  }

  // ===== Split Configuration Actions =====

  function setSplitBy(config) {
    currentConfig.value.splitBy = config
  }
  
  // NEW: Update split configuration
  function setSplitConfig(config) {
    currentConfig.value.splitConfig = {
      ...currentConfig.value.splitConfig,
      ...config
    }
  }

  function setQuery(query) {
    currentConfig.value.query = query
  }

  function reset() {
    currentConfig.value = {
      bucketAgg: null,
      bucketAggs: [],
      metrics: [],
      splitBy: null,
      splitConfig: {
        enabled: false,
        type: 'series',
        field: null,
        maxBuckets: 5,
        columns: 3
      },
      query: null
    }
    aggregatedData.value = []
    error.value = null
  }

  function setAggregatedData(data) {
    aggregatedData.value = data
  }

  return {
    // State
    aggregationTypes,
    dateIntervals,
    currentConfig,
    aggregatedData,
    loading,
    error,
    colorSchemes,
    presetColors,

    // Getters
    bucketAggTypes,
    metricAggTypes,
    hasAggregation,
    effectiveBucketAggs,
    isMultiLevel,

    // Actions - Bucket Aggregations
    fetchAggregationTypes,
    fetchDateIntervals,
    executeAggregation,
    previewQuery,
    setBucketAggregation,
    addBucketLevel,
    updateBucketLevel,
    removeBucketLevel,
    reorderBucketLevels,
    clearBucketLevels,
    
    // Actions - Metrics
    addMetric,
    removeMetric,
    updateMetric,
    reorderMetrics,
    
    // Actions - Split/Query
    setSplitBy,
    setSplitConfig,
    setQuery,
    reset,
    setAggregatedData
  }
})

