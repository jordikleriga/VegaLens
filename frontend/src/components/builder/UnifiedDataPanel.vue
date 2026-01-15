<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useAggregationStore } from '@/stores/aggregation'
import { useElasticStore } from '@/stores/elastic'
import { useVegaStore } from '@/stores/vega'
import api from '@/services/api'
import { axisConfig, metricTypes } from '@/config/chartAxisConfig'
import { useDropdownPositioning } from '@/composables/useDropdownPositioning'
import { useFieldSelection } from '@/composables/useFieldSelection'
import { useAggregationConfig } from '@/composables/useAggregationConfig'
import { useMultiLevelBuckets } from '@/composables/useMultiLevelBuckets'
import { getChartMapper } from '@/services/chartMappers'
import {
  ChevronDown,
  Search,
  Check,
  X,
  AlertTriangle,
  RotateCcw,
  Play,
  Eye,
  Hash,
  Type,
  Calendar,
  MapPin,
  ToggleLeft,
  Box,
  TrendingUp,
  TrendingDown,
  Palette,
  CircleDot,
  Settings,
  Clock,
  Plus,
  GripVertical,
  Layers,
  ArrowUp,
  ArrowDown
} from 'lucide-vue-next'

const emit = defineEmits(['data-updated', 'preview-ready'])

const aggregationStore = useAggregationStore()
const elasticStore = useElasticStore()
const vegaStore = useVegaStore()

// Use composables
const { dropdownPositions, getDropdownPosition, updateDropdownPosition } = useDropdownPositioning()
const { getFieldIcon, getFieldTypeColor, getFieldsForAxis, determineAggregationType } = useFieldSelection()
const { getDefaultOptions, getIntervalType, buildBucketAggConfig } = useAggregationConfig()
const {
  showSubGroupPicker,
  subGroupSearch,
  supportsMultiLevelBuckets,
  additionalBucketLevels,
  subGroupFields,
  isPrimaryBucketAxis,
  addBucketLevel,
  removeBucketLevel,
  moveBucketLevelUp,
  moveBucketLevelDown
} = useMultiLevelBuckets(aggregationStore, elasticStore, vegaStore, checkAndRunAggregation)

// UI State
const error = ref(null)
const isLoading = ref(false)
// Track which axes are expanded (all start collapsed for cleaner UI)
const expandedAxes = ref({
  x: false, y: false, color: false, size: false,
  source: false, target: false, value: false, text: false,
  columns: false, key: false, category: false,
  label: false, measures: false, ranges: false, marker: false,
  stage: false, top: false, left: false, right: false,
  group: false, time: false, dimension: false, parent: false,
  startValue: false, endValue: false, rank: false, facet: false
})
const fieldSearch = ref({ x: '', y: '', color: '', size: '', source: '', target: '', value: '', text: '', columns: '', key: '', category: '' })
const showFieldPicker = ref({ x: false, y: false, color: false, size: false, source: false, target: false, value: false, text: false, columns: false, key: false, category: false })
const fieldPickerButtons = ref({}) // Store refs to picker buttons for positioning

// Dropdown positioning functions now provided by useDropdownPositioning() composable

// Toggle field picker with position tracking
function toggleFieldPicker(axisId, event) {
  // Close all other pickers first
  Object.keys(showFieldPicker.value).forEach(key => {
    if (key !== axisId) showFieldPicker.value[key] = false
  })
  
  // Update position before showing
  if (!showFieldPicker.value[axisId]) {
    updateDropdownPosition(axisId, event)
  }
  
  showFieldPicker.value[axisId] = !showFieldPicker.value[axisId]
}

// Configuration imported from chartAxisConfig.js

// Chart type determines what axes are available
const chartAxes = computed(() => {
  const type = vegaStore.selectedType
  return axisConfig[type] || axisConfig.bar
})

// Axis configurations with current values
const axisState = ref({
  x: { field: null, aggregation: 'terms', options: { size: 25 }, label: '' },
  y: { field: null, metric: 'count', metricField: null, label: '' },
  color: { field: null, label: '' },
  size: { field: null, metric: 'avg', label: '' },
  // Sankey-specific
  source: { field: null, aggregation: 'terms', options: { size: 25 }, label: '' },
  target: { field: null, aggregation: 'terms', options: { size: 25 }, label: '' },
  value: { field: null, metric: 'sum', metricField: null, label: '' },
  // Wordcloud-specific
  text: { field: null, aggregation: 'terms', options: { size: 100 }, label: '' },
  // Ternary-specific
  label: { field: null, aggregation: 'terms', options: { size: 50 }, label: '' },
  top: { field: null, metric: 'sum', metricField: null, label: '' },
  left: { field: null, metric: 'sum', metricField: null, label: '' },
  right: { field: null, metric: 'sum', metricField: null, label: '' },
  // Comet-specific
  category: { field: null, aggregation: 'terms', options: { size: 25 }, label: '' },
  time: { field: null, aggregation: 'terms', options: { size: 10 }, label: '' },
  // Radar-specific
  key: { field: null, aggregation: 'terms', options: { size: 25 }, label: '' },
  // Table columns
  columns: { fields: [], label: '' },
  // Dual Axis specific
  y1: { field: null, metric: 'avg', metricField: null, label: '' },
  y2: { field: null, metric: 'avg', metricField: null, label: '' },
  // Population Pyramid specific  
  group: { field: null, aggregation: 'terms', options: { size: 10 }, label: '' },
  // Trellis Area specific
  facet: { field: null, aggregation: 'terms', options: { size: 10 }, label: '' },
  // Bullet specific
  title: { field: null, aggregation: 'terms', options: { size: 10 }, label: '' },
  measures: { field: null, metric: 'avg', metricField: null, label: '' },
  ranges: { field: null, metric: 'max', metricField: null, label: '' }
})

// Metric types imported from chartAxisConfig.js
// Field utilities provided by useFieldSelection() composable

// Wrapper for getFieldsForAxis to inject dependencies
function getFieldsForAxisWrapper(axisConfig) {
  const searchTerm = fieldSearch.value[axisConfig.id] || ''
  return getFieldsForAxis(axisConfig, elasticStore, searchTerm)
}

// Axis selection handlers
function selectField(axisId, field) {
  const axis = chartAxes.value.find(a => a.id === axisId)

  if (axis.fieldType === 'bucket') {
    // Use composable to determine aggregation type
    const aggType = determineAggregationType(field, vegaStore.selectedType, axis.fieldType)

    axisState.value[axisId] = {
      ...axisState.value[axisId],
      field: field.name,
      aggregation: aggType,
      options: getDefaultOptions(aggType)
    }
  } else if (axis.fieldType === 'metric') {
    axisState.value[axisId] = {
      ...axisState.value[axisId],
      metricField: field.name
    }
  } else {
    axisState.value[axisId] = {
      ...axisState.value[axisId],
      field: field.name
    }
  }

  showFieldPicker.value[axisId] = false
  fieldSearch.value[axisId] = ''

  // Auto-run if configuration is complete
  checkAndRunAggregation()
}

function selectMetric(axisId, metricType) {
  axisState.value[axisId] = {
    ...axisState.value[axisId],
    metric: metricType.id,
    metricField: metricType.needsField ? axisState.value[axisId].metricField : null
  }

  checkAndRunAggregation()
}

// Clear field selection for an axis
function clearField(axisId) {
  const axis = chartAxes.value.find(a => a.id === axisId)

  if (axis?.fieldType === 'metric') {
    // For metric axes, clear the metric field but keep the metric type
    axisState.value[axisId] = {
      ...axisState.value[axisId],
      metricField: null
    }
  } else {
    // For bucket and other axes, clear field and related options
    axisState.value[axisId] = {
      ...axisState.value[axisId],
      field: null,
      aggregation: null,
      options: {}
    }
  }

  // Clear the corresponding vega config using the axis's configKey
  if (axis?.configKey) {
    vegaStore.updateConfig(axis.configKey, null)
  }

  // Also clear the label for this axis
  axisState.value[axisId] = {
    ...axisState.value[axisId],
    label: null
  }

  showFieldPicker.value[axisId] = false
  fieldSearch.value[axisId] = ''

  // Trigger re-render with updated config
  checkAndRunAggregation()
}

// Aggregation config functions provided by useAggregationConfig() composable

function updateAxisOption(axisId, key, value) {
  // When switching to custom_metric, initialize the default metric type
  if (key === 'orderBy' && value === 'custom_metric') {
    axisState.value[axisId].options = {
      ...axisState.value[axisId].options,
      [key]: value,
      // Initialize defaults for metric ordering
      orderMetricType: axisState.value[axisId].options?.orderMetricType || 'sum',
      orderMetricField: axisState.value[axisId].options?.orderMetricField || ''
    }
  } else {
    axisState.value[axisId].options = {
      ...axisState.value[axisId].options,
      [key]: value
    }
  }
  
  // Trigger re-aggregation when options change
  checkAndRunAggregation()
}

// Toggle order direction between 'asc' and 'desc'
function toggleOrderDirection(axisId) {
  const current = axisState.value[axisId]?.options?.orderDirection || 'desc'
  updateAxisOption(axisId, 'orderDirection', current === 'desc' ? 'asc' : 'desc')
}

function updateAxisLabel(axisId, label) {
  axisState.value[axisId] = {
    ...axisState.value[axisId],
    label: label
  }
  // Trigger chart update when label changes
  checkAndRunAggregation()
}

function getDefaultLabel(axis) {
  const state = axisState.value[axis.id]
  if (axis.fieldType === 'metric') {
    if (state?.metric === 'count') {
      return 'Count'
    }
    const metricName = metricTypes.find(m => m.id === state?.metric)?.name || state?.metric
    return state?.metricField ? `${metricName} of ${state.metricField}` : metricName
  }
  return state?.field || axis.name
}

// Configuration completeness
const isConfigComplete = computed(() => {
  const requiredAxes = chartAxes.value.filter(a => a.required)
  
  return requiredAxes.every(axis => {
    const state = axisState.value[axis.id]
    
    if (axis.fieldType === 'bucket') {
      return !!state?.field
    } else if (axis.fieldType === 'metric') {
      const metric = metricTypes.find(m => m.id === state?.metric)
      if (!metric) return false
      return !metric.needsField || !!state?.metricField
    }
    
    return !!state?.field
  })
})

// Check if there are numeric fields available for custom metric ordering
const hasNumericMetric = computed(() => {
  return elasticStore.aggregatableNumericFields && elasticStore.aggregatableNumericFields.length > 0
})

// Multi-level bucket aggregation logic provided by useMultiLevelBuckets() composable

// Configuration summary
const configSummary = computed(() => {
  if (!isConfigComplete.value) return null
  
  const chartType = vegaStore.selectedType
  const parts = []
  
  // Handle special chart types
  if (chartType === 'sankey' || chartType === 'chord') {
    const sourceState = axisState.value.source
    const targetState = axisState.value.target
    const valueState = axisState.value.value
    
    if (sourceState?.field && targetState?.field) {
      parts.push({ 
        label: chartType === 'chord' ? 'Connection' : 'Flow', 
        value: `${sourceState.field.split('.').pop()} → ${targetState.field.split('.').pop()}`,
        color: 'text-emerald-300'
      })
    }
    if (valueState?.metric) {
      const metricName = metricTypes.find(m => m.id === valueState.metric)?.name || valueState.metric
      const fieldName = valueState.metricField?.split('.').pop()
      parts.push({ 
        label: 'Value', 
        value: fieldName ? `${metricName} of ${fieldName}` : metricName,
        color: 'text-blue-300'
      })
    }
    return parts
  }
  
  if (chartType === 'wordcloud') {
    const textState = axisState.value.text
    const sizeState = axisState.value.size
    
    if (textState?.field) {
      parts.push({ label: 'Words from', value: textState.field.split('.').pop(), color: 'text-emerald-300' })
    }
    if (sizeState?.metric) {
      const metricName = metricTypes.find(m => m.id === sizeState.metric)?.name || sizeState.metric
      parts.push({ label: 'Sized by', value: metricName, color: 'text-blue-300' })
    }
    return parts
  }
  
  // Standard X/Y charts
  const xState = axisState.value.x
  const yState = axisState.value.y
  
  if (xState?.field) {
    parts.push({ label: 'Group by', value: xState.field.split('.').pop(), color: 'text-emerald-300' })
  }
  
  if (yState?.metric) {
    const metricName = metricTypes.find(m => m.id === yState.metric)?.name || yState.metric
    const fieldName = yState.metricField?.split('.').pop()
    parts.push({ 
      label: 'Measure', 
      value: fieldName ? `${metricName} of ${fieldName}` : metricName,
      color: 'text-blue-300'
    })
  }
  
  return parts
})

// Sync with aggregation store and execute
async function checkAndRunAggregation() {
  if (!isConfigComplete.value || !elasticStore.currentIndex) return
  
  const chartType = vegaStore.selectedType
  
  // Build aggregation config based on chart type
  let bucketState, metricState
  
  if (chartType === 'sankey' || chartType === 'chord') {
    // For sankey/chord, use multi_terms aggregation with source, target, and optional stages
    const sourceState = axisState.value.source
    const targetState = axisState.value.target
    const sourceField = sourceState?.field
    const targetField = targetState?.field
    // Uses source's size for the number of source→target combinations
    const size = sourceState?.options?.size || 25

    if (sourceField && targetField) {
      // Build list of all stage fields (for multi-stage sankey)
      const stageFields = [sourceField, targetField]

      // Add optional stage3 and stage4 if configured (sankey only)
      if (chartType === 'sankey') {
        const stage3State = axisState.value.stage3
        const stage4State = axisState.value.stage4

        if (stage3State?.field) {
          stageFields.push(stage3State.field)
        }
        if (stage4State?.field) {
          stageFields.push(stage4State.field)
        }
      }

      aggregationStore.setBucketAggregation({
        type: 'multi_terms',
        field: sourceField, // Primary field (for compatibility)
        options: {
          fields: stageFields,
          size: size
        }
      })
    }
    metricState = axisState.value.value
  } else if (chartType === 'gauge' || chartType === 'metric') {
    // Gauge and Metric are single-value charts
    // They only need a metric (typically Count or aggregation of a numeric field)
    metricState = axisState.value.y
    
    console.log('Gauge/Metric aggregation setup:', { metricState })
    
    try {
      isLoading.value = true
      
      if (metricState?.metric === 'count') {
        // For Count metric, get the document count using the sample endpoint
        // The sample endpoint returns total count in addition to sample hits
        const response = await api.get(`/elastic/indices/${elasticStore.currentIndex}/sample`, {
          params: { size: 1 } // We just need the total count, not the data
        })
        const count = response.data.total || 0
        const data = [{ _count: count }]
        
        console.log(`Gauge/Metric: Got count of ${count} documents`)
        
        // Update aggregation store so chartData computed picks it up
        aggregationStore.setAggregatedData(data)
        
        // Map and emit data
        await mapToChartFields(data)
        emit('data-updated', data)
      } else if (metricState?.metricField) {
        // For other metrics (Sum, Avg, etc.), we need to aggregate the field
        // Use the aggregation service with a simple stats query
        // Since we need the full dataset, use a match_all bucket with the metric
        // Use _index instead of _id since _id field access is disabled by default in ES
        aggregationStore.setBucketAggregation({
          type: 'terms',
          field: '_index', // Dummy bucket - we'll just use the first result
          options: { size: 1 }
        })
        aggregationStore.currentConfig.metrics = [{
          type: metricState.metric,
          field: metricState.metricField,
          alias: ''
        }]
        
        const result = await aggregationStore.executeAggregation(elasticStore.currentIndex)
        if (result.data && result.data.length > 0) {
          await mapToChartFields(result.data)
          emit('data-updated', result.data)
        }
      }
    } catch (err) {
      console.error('Gauge/Metric aggregation failed:', err)
      error.value = err.response?.data?.message || err.message
    } finally {
      isLoading.value = false
    }
    return
  } else if (chartType === 'wordcloud') {
    bucketState = axisState.value.text
    metricState = axisState.value.size
    
    const aggConfig = buildBucketAggConfig(bucketState, 100)
    if (aggConfig) {
      aggregationStore.setBucketAggregation(aggConfig)
    }
  } else if (chartType === 'bubble' || chartType === 'scatter' || chartType === 'binned_heatmap') {
    // These chart types need raw numeric data or aggregation by a color/category field
    // For bubble: X, Y, Size are all metrics; Color is optional bucket
    
    const xState = axisState.value.x
    const yState = axisState.value.y
    const sizeState = axisState.value.size
    const colorState = axisState.value.color
    
    console.log('Bubble/Scatter aggregation setup:', { xState, yState, sizeState, colorState })
    
    // If we have a color field (bucket), use it for grouping
    if (colorState?.field) {
      aggregationStore.setBucketAggregation({
        type: 'terms',
        field: colorState.field,
        options: { size: 100 }
      })
      
      // Add all metrics
      aggregationStore.currentConfig.metrics = []
      
      if (xState?.metric && xState.metric !== 'count' && xState.metricField) {
        aggregationStore.addMetric({
          type: xState.metric,
          field: xState.metricField,
          alias: ''
        })
      }
      
      if (yState?.metric && yState.metric !== 'count' && yState.metricField) {
        aggregationStore.addMetric({
          type: yState.metric,
          field: yState.metricField,
          alias: ''
        })
      }
      
      if (chartType === 'bubble' && sizeState?.metric && sizeState.metric !== 'count' && sizeState.metricField) {
        aggregationStore.addMetric({
          type: sizeState.metric,
          field: sizeState.metricField,
          alias: ''
        })
      }
      
      await runAggregation()
    } else {
      // No grouping - use raw sample data directly
      const sampleData = elasticStore.sampleData || []
      if (sampleData.length > 0) {
        console.log('Bubble using raw sample data:', sampleData.length, 'records')
        // Flatten nested objects for scatter/bubble charts
        // e.g., { products: { base_price: 29.99 } } => { "products.base_price": 29.99 }
        const flattenedData = sampleData.map(flattenObject)
        await mapToChartFields(flattenedData)
        emit('data-updated', flattenedData)
      }
    }
    return
  } else if (chartType === 'dual_axis') {
    // Dual axis needs X (bucket) and two Y metrics
    bucketState = axisState.value.x
    const y1State = axisState.value.y1
    const y2State = axisState.value.y2
    
    const aggConfig = buildBucketAggConfig(bucketState, 25)
    if (aggConfig) {
      aggregationStore.setBucketAggregation(aggConfig)
      
      // Clear and add both metrics
      aggregationStore.currentConfig.metrics = []
      
      if (y1State?.metric && y1State.metric !== 'count' && y1State.metricField) {
        aggregationStore.addMetric({
          type: y1State.metric,
          field: y1State.metricField,
          alias: ''
        })
      }
      
      if (y2State?.metric && y2State.metric !== 'count' && y2State.metricField) {
        aggregationStore.addMetric({
          type: y2State.metric,
          field: y2State.metricField,
          alias: ''
        })
      }
      
      await runAggregation()
    }
    return
  } else if (chartType === 'population_pyramid') {
    // Population pyramid: group by category, split by group field
    const categoryState = axisState.value.category
    const groupState = axisState.value.group
    const valueState = axisState.value.value
    
    if (categoryState?.field && groupState?.field) {
      // Use multi_terms for category + group
      aggregationStore.setBucketAggregation({
        type: 'multi_terms',
        field: categoryState.field,
        options: { 
          fields: [categoryState.field, groupState.field],
          size: categoryState.options?.size || 25
        }
      })
      
      aggregationStore.currentConfig.metrics = []
      if (valueState?.metric && valueState.metric !== 'count' && valueState.metricField) {
        aggregationStore.addMetric({
          type: valueState.metric,
          field: valueState.metricField,
          alias: ''
        })
      }
      
      await runAggregation()
    }
    return
  } else if (chartType === 'lasagna') {
    // Lasagna: X (time), Y (series), value (color)
    const xState = axisState.value.x
    const yState = axisState.value.y
    const valueState = axisState.value.value
    
    if (xState?.field && yState?.field) {
      // Use X as primary bucket with Y as split
      const aggConfig = buildBucketAggConfig(xState, 50)
      if (aggConfig) {
        aggregationStore.setBucketAggregation(aggConfig)
      }
      
      // Add Y as split
      aggregationStore.setSplitBy({
        type: 'terms',
        field: yState.field,
        options: { size: 25 }
      })
      
      aggregationStore.currentConfig.metrics = []
      if (valueState?.metric && valueState.metric !== 'count' && valueState.metricField) {
        aggregationStore.addMetric({
          type: valueState.metric,
          field: valueState.metricField,
          alias: ''
        })
      }
      
      await runAggregation()
    }
    return
  } else if (chartType === 'trellis_area') {
    // Trellis: X (time), Y (value), facet (split panels)
    bucketState = axisState.value.x
    metricState = axisState.value.y
    const facetState = axisState.value.facet
    
    const aggConfig = buildBucketAggConfig(bucketState, 50)
    if (aggConfig) {
      aggregationStore.setBucketAggregation(aggConfig)
      
      // Add facet as split
      if (facetState?.field) {
        aggregationStore.setSplitBy({
          type: 'terms',
          field: facetState.field,
          options: { size: 10 }
        })
      }
    }
    // Will fall through to standard metric handling below
  } else if (chartType === 'bullet') {
    // Bullet: title (bucket), measures and ranges (metrics)
    const titleState = axisState.value.title
    const measuresState = axisState.value.measures
    const rangesState = axisState.value.ranges
    
    if (titleState?.field) {
      aggregationStore.setBucketAggregation({
        type: 'terms',
        field: titleState.field,
        options: { size: 10 }
      })
      
      aggregationStore.currentConfig.metrics = []
      
      if (measuresState?.metric && measuresState.metric !== 'count' && measuresState.metricField) {
        aggregationStore.addMetric({
          type: measuresState.metric,
          field: measuresState.metricField,
          alias: ''
        })
      }
      
      if (rangesState?.metric && rangesState.metric !== 'count' && rangesState.metricField) {
        aggregationStore.addMetric({
          type: rangesState.metric,
          field: rangesState.metricField,
          alias: ''
        })
      }
      
      await runAggregation()
    }
    return
  } else if (chartType === 'funnel' || chartType === 'error_bars' || chartType === 'circle_packing') {
    // Funnel, Error Bars, Circle Packing: simple bucket + metric
    const bucketState = axisState.value.x
    const metricState = axisState.value.y

    if (bucketState?.field) {
      const bucketConfig = buildBucketAggConfig(bucketState, 25)
      if (bucketConfig) {
        // For circle packing with parent field (color axis), create multi-level buckets
        if (chartType === 'circle_packing' && axisState.value.color?.field) {
          // Parent field becomes first bucket, category becomes second bucket
          const parentBucketConfig = {
            type: 'terms',
            field: axisState.value.color.field,
            options: { size: 20, orderBy: '_count', orderDirection: 'desc' }
          }

          console.log('[UnifiedDataPanel] Creating multi-level buckets for Circle Packing:', {
            parent: parentBucketConfig,
            child: bucketConfig
          })

          // Clear and rebuild bucket aggregations
          aggregationStore.clearBucketLevels()
          aggregationStore.addBucketLevel(parentBucketConfig)
          aggregationStore.addBucketLevel(bucketConfig)
        } else {
          // Single-level bucket
          aggregationStore.setBucketAggregation(bucketConfig)
        }
      }

      // Add metric
      if (metricState?.metric === 'count') {
        aggregationStore.currentConfig.metrics = []
      } else if (metricState?.metricField) {
        aggregationStore.currentConfig.metrics = [{
          type: metricState.metric,
          field: metricState.metricField,
          alias: ''
        }]
      }

      await runAggregation()
    }
    return
  } else if (chartType === 'sparkline' || chartType === 'horizon') {
    // Sparkline, Horizon: time-based bucket + metric + optional series split
    const bucketState = axisState.value.x
    const metricState = axisState.value.y
    const colorState = axisState.value.color
    
    if (bucketState?.field) {
      const bucketConfig = buildBucketAggConfig(bucketState, 50)
      if (bucketConfig) {
        aggregationStore.setBucketAggregation(bucketConfig)
      }
      
      // Add metric
      if (metricState?.metric === 'count') {
        aggregationStore.currentConfig.metrics = []
      } else if (metricState?.metricField) {
        aggregationStore.currentConfig.metrics = [{
          type: metricState.metric,
          field: metricState.metricField,
          alias: ''
        }]
      }
      
      // Handle series split
      if (colorState?.field) {
        aggregationStore.setSplitBy({
          type: 'terms',
          field: colorState.field,
          options: { size: 10 }
        })
      }
      
      await runAggregation()
    }
    return
  } else if (chartType === 'streamgraph' || chartType === 'marimekko') {
    // Streamgraph, Marimekko: bucket + metric + required series split
    const bucketState = axisState.value.x
    const metricState = axisState.value.y
    const colorState = axisState.value.color
    
    if (bucketState?.field && colorState?.field) {
      const bucketConfig = buildBucketAggConfig(bucketState, 50)
      if (bucketConfig) {
        aggregationStore.setBucketAggregation(bucketConfig)
      }
      
      // Add metric
      if (metricState?.metric === 'count') {
        aggregationStore.currentConfig.metrics = []
      } else if (metricState?.metricField) {
        aggregationStore.currentConfig.metrics = [{
          type: metricState.metric,
          field: metricState.metricField,
          alias: ''
        }]
      }
      
      // Series split is required for these charts
      aggregationStore.setSplitBy({
        type: 'terms',
        field: colorState.field,
        options: { size: 15 }
      })
      
      await runAggregation()
    }
    return
  } else if (chartType === 'density') {
    // Density: needs raw numeric data, use bucket on value field with histogram
    const valueState = axisState.value.x
    const groupState = axisState.value.color
    
    if (valueState?.metricField) {
      // For density, we need the raw values, so use a histogram with small intervals
      aggregationStore.setBucketAggregation({
        type: 'histogram',
        field: valueState.metricField,
        options: { interval: 10, minDocCount: 1 }
      })
      
      // Add count metric
      aggregationStore.currentConfig.metrics = []
      
      // Handle optional grouping
      if (groupState?.field) {
        aggregationStore.setSplitBy({
          type: 'terms',
          field: groupState.field,
          options: { size: 10 }
        })
      }
      
      await runAggregation()
    }
    return
  } else if (chartType === 'comet') {
    // Comet: category (Y-axis), time/state field, value (metric)
    const categoryState = axisState.value.category
    const timeState = axisState.value.time
    const valueState = axisState.value.value
    
    if (categoryState?.field && timeState?.field) {
      // Use multi_terms for category + time
      aggregationStore.setBucketAggregation({
        type: 'multi_terms',
        field: categoryState.field,
        options: { 
          fields: [categoryState.field, timeState.field],
          size: categoryState.options?.size || 25
        }
      })
      
      aggregationStore.currentConfig.metrics = []
      if (valueState?.metric && valueState.metric !== 'count' && valueState.metricField) {
        aggregationStore.addMetric({
          type: valueState.metric,
          field: valueState.metricField,
          alias: ''
        })
      }
      
      await runAggregation()
    }
    return
  } else if (chartType === 'waterfall') {
    // Waterfall: x/label (bucket) and y/value (metric)
    // BOTH fields are required before running aggregation
    bucketState = axisState.value.x
    metricState = axisState.value.y
    
    // For waterfall, require both bucket (label) AND metric (amount) to be set
    const hasRequiredFields = bucketState?.field && (metricState?.metric === 'count' || metricState?.metricField)
    
    if (hasRequiredFields) {
      const aggConfig = buildBucketAggConfig(bucketState, 25)
      if (aggConfig) {
        aggregationStore.setBucketAggregation(aggConfig)
      }
      
      aggregationStore.currentConfig.metrics = []
      if (metricState?.metric && metricState.metric !== 'count' && metricState.metricField) {
        aggregationStore.addMetric({
          type: metricState.metric,
          field: metricState.metricField,
          alias: ''
        })
      }
      
      await runAggregation()
    }
    return
  } else if (chartType === 'ternary') {
    // Ternary: label (bucket), top/left/right (metrics)
    const labelState = axisState.value.label
    const topState = axisState.value.top
    const leftState = axisState.value.left
    const rightState = axisState.value.right
    
    if (labelState?.field) {
      aggregationStore.setBucketAggregation({
        type: 'terms',
        field: labelState.field,
        options: labelState.options || { size: 50 }
      })
      
      aggregationStore.currentConfig.metrics = []
      
      if (topState?.metric && topState.metric !== 'count' && topState.metricField) {
        aggregationStore.addMetric({
          type: topState.metric,
          field: topState.metricField,
          alias: ''
        })
      }
      
      if (leftState?.metric && leftState.metric !== 'count' && leftState.metricField) {
        aggregationStore.addMetric({
          type: leftState.metric,
          field: leftState.metricField,
          alias: ''
        })
      }
      
      if (rightState?.metric && rightState.metric !== 'count' && rightState.metricField) {
        aggregationStore.addMetric({
          type: rightState.metric,
          field: rightState.metricField,
          alias: ''
        })
      }
      
      await runAggregation()
    }
    return
  } else if (chartType === 'heatlane') {
    // Heatlane just needs a numeric value field - use sample data
    const valueState = axisState.value.value
    // For numeric field type, the field is stored as 'field', not 'metricField'
    const numericField = valueState?.field || valueState?.numericField || valueState?.metricField
    
    if (numericField) {
      const sampleData = elasticStore.sampleData || []
      if (sampleData.length > 0) {
        console.log('Heatlane: valueField=', numericField, 'dataPoints=', sampleData.length)
        
        // IMPORTANT: Set aggregated data FIRST, so chartData.value.length > 0
        // when the config watcher fires
        aggregationStore.setAggregatedData(sampleData)
        
        // Now update config - this triggers the watcher
        vegaStore.updateConfig('valueField', numericField)
        
        emit('data-updated', sampleData)
      }
    }
    return
  } else if (chartType === 'radar') {
    // Radar: key (dimensions) + optional category (series) as bucket, value as metric
    const keyState = axisState.value.key
    const categoryState = axisState.value.category
    const valueState = axisState.value.value
    
    if (keyState?.field) {
      // If we have both key and category, use multi_terms
      if (categoryState?.field) {
        aggregationStore.setBucketAggregation({
          type: 'multi_terms',
          field: keyState.field,
          options: { 
            fields: [keyState.field, categoryState.field],
            size: keyState.options?.size || 25
          }
        })
      } else {
        aggregationStore.setBucketAggregation({
          type: 'terms',
          field: keyState.field,
          options: keyState.options || { size: 25 }
        })
      }
      
      aggregationStore.currentConfig.metrics = []
      if (valueState?.metric && valueState.metric !== 'count' && valueState.metricField) {
        aggregationStore.addMetric({
          type: valueState.metric,
          field: valueState.metricField,
          alias: ''
        })
      }
      
      await runAggregation()
    }
    return
  } else if (chartType === 'histogram') {
    // Histogram uses raw sample data - Vega-Lite bins the values automatically
    const xState = axisState.value.x
    const numericField = xState?.field
    
    if (numericField) {
      const sampleData = elasticStore.sampleData || []
      if (sampleData.length > 0) {
        console.log('Histogram: field=', numericField, 'dataPoints=', sampleData.length)
        
        // IMPORTANT: Set aggregated data FIRST, so chartData.value.length > 0
        // when the config watcher fires
        aggregationStore.setAggregatedData(sampleData)
        
        // Now update config - this triggers the watcher
        vegaStore.updateConfig({
          field: numericField
        })
        
        emit('data-updated', sampleData)
      }
    }
    return
  } else if (chartType === 'boxplot' || chartType === 'violin') {
    // Boxplot/Violin use raw sample data grouped by category - Vega computes the statistics
    const xState = axisState.value.x
    const yState = axisState.value.y
    const categoryField = xState?.field
    const numericField = yState?.field
    
    if (categoryField && numericField) {
      const sampleData = elasticStore.sampleData || []
      if (sampleData.length > 0) {
        console.log(`${chartType}: categoryField=`, categoryField, 'valueField=', numericField, 'dataPoints=', sampleData.length)
        
        // Set aggregated data first
        aggregationStore.setAggregatedData(sampleData)
        
        // Update config
        vegaStore.updateConfig({
          categoryField: categoryField,
          valueField: numericField
        })
        
        emit('data-updated', sampleData)
        
        // Explicitly generate spec after config is set
        // Use nextTick to ensure Vue has processed the config update
        nextTick(async () => {
          try {
            if (vegaStore.isConfigComplete) {
              console.log(`${chartType}: generating spec...`)
              await vegaStore.generateSpec(sampleData)
              console.log(`${chartType}: spec generated`)
            }
          } catch (err) {
            console.error(`${chartType} spec generation failed:`, err.message)
          }
        })
      }
    }
    return
  } else if (chartType === 'pareto') {
    // Pareto uses aggregation like bar chart
    bucketState = axisState.value.x
    metricState = axisState.value.y
    
    const aggConfig = buildBucketAggConfig(bucketState, 25)
    if (aggConfig) {
      aggregationStore.setBucketAggregation(aggConfig)
    }
    
    // Clear existing metrics and add new one
    aggregationStore.currentConfig.metrics = []
    if (metricState?.metric) {
      const metric = {
        type: metricState.metric,
        field: metricState.metricField || '',
        alias: ''
      }
      aggregationStore.addMetric(metric)
    }
    
    await runAggregation()
    return
  } else if (chartType === 'heatmap' || chartType === 'treemap' || chartType === 'area' || chartType === 'line' || chartType === 'streamgraph') {
    // Use UnifiedChartMapper for charts with special aggregation handling:
    // - Heatmap/Treemap: multi-bucket aggregations
    // - Area/Line/Streamgraph: series-based charts using splitBy
    const { getChartMapper } = await import('@/services/chartMappers')
    const mapper = getChartMapper(chartType, axisState, vegaStore)

    // Use mapper's buildAggregationConfig to properly handle aggregation structure
    await mapper.buildAggregationConfig(aggregationStore, elasticStore, buildBucketAggConfig)

    // Execute aggregation
    await runAggregation()
    return
  } else {
    bucketState = axisState.value.x
    metricState = axisState.value.y
    const colorState = axisState.value.color  // Check for stacking/color field

    const aggConfig = buildBucketAggConfig(bucketState, 25)
    if (aggConfig) {
      // For date_histogram or histogram, use splitBy for color field (sub-aggregation)
      // For terms, use multi_terms to combine bucket + color
      if (colorState?.field) {
        if (aggConfig.type === 'date_histogram' || aggConfig.type === 'histogram') {
          // Keep the time/numeric bucket and add color as split sub-aggregation
          console.log('Standard chart with color field - using splitBy for', aggConfig.type, ':', bucketState.field, 'split by', colorState.field)
          aggregationStore.setBucketAggregation(aggConfig)
          aggregationStore.setSplitBy({
            type: 'terms',
            field: colorState.field,
            options: { size: 25 }
          })
        } else {
          // For terms aggregation, use multi_terms to combine fields
          // Preserve order configuration from the original aggConfig
          console.log('Standard chart with color field - using multi_terms:', bucketState.field, colorState.field)
          aggregationStore.setBucketAggregation({
            type: 'multi_terms',
            field: bucketState.field,
            options: {
              ...aggConfig.options,
              fields: [bucketState.field, colorState.field],
              size: aggConfig.options.size || 100  // Increase size for multi-term combinations
            },
            // Carry over order configuration
            orderBy: aggConfig.orderBy,
            orderDirection: aggConfig.orderDirection,
            orderMetric: aggConfig.orderMetric
          })
        }
      } else {
        aggregationStore.setBucketAggregation(aggConfig)
        // Clear any existing split when no color field
        aggregationStore.setSplitBy(null)
      }
    }
  }

  // Clear existing metrics and add new one
  aggregationStore.currentConfig.metrics = []
  if (metricState?.metric) {
    const metric = {
      type: metricState.metric,
      field: metricState.metricField || '',
      alias: ''
    }
    aggregationStore.addMetric(metric)
  }

  // Execute aggregation
  await runAggregation()
}

async function runAggregation() {
  console.log('[runAggregation] Starting...', {
    index: elasticStore.currentIndex,
    isComplete: isConfigComplete.value,
    bucketAgg: aggregationStore.currentConfig.bucketAgg
  })
  
  if (!elasticStore.currentIndex || !isConfigComplete.value) {
    console.log('[runAggregation] Early return - config not complete')
    return
  }
  
  const chartType = vegaStore.selectedType
  
  // For Gauge/Metric and other special chart types, use checkAndRunAggregation
  const specialChartTypes = ['gauge', 'metric', 'histogram', 'boxplot', 'heatlane']
  if (specialChartTypes.includes(chartType)) {
    await checkAndRunAggregation()
    return
  }
  
  isLoading.value = true
  error.value = null
  
  try {
    console.log('[runAggregation] Calling executeAggregation with config:', JSON.stringify(aggregationStore.currentConfig, null, 2))
    const result = await aggregationStore.executeAggregation(elasticStore.currentIndex)
    console.log('[runAggregation] Got result with', result.data?.length, 'records')
    
    // Map to chart fields
    await mapToChartFields(result.data)
    
    emit('data-updated', result.data)
  } catch (err) {
    console.error('Aggregation failed:', err)
    error.value = err.response?.data?.message || err.message
    if (err.response?.data?.suggestion) {
      error.value += ` ${err.response.data.suggestion}`
    }
  } finally {
    isLoading.value = false
  }
}

// ========================================
// UNIFIED FIELD MAPPING SYSTEM
// ========================================

/**
 * Resolve a field name to an actual data field
 * Handles sanitized field names (dots replaced with underscores)
 * @param {string} fieldName - Original field name (e.g., "category.keyword")
 * @param {string[]} availableFields - Available fields in the data
 * @returns {string} Resolved field name
 */
function resolveDataField(fieldName, availableFields) {
  if (!fieldName) return null
  
  // Direct match
  if (availableFields.includes(fieldName)) return fieldName
  
  // Sanitized match (dots replaced with underscores)
  const sanitized = fieldName.replace(/\./g, '_')
  if (availableFields.includes(sanitized)) return sanitized
  
  // Base field match (without .keyword)
  if (fieldName.endsWith('.keyword')) {
    const base = fieldName.replace(/\.keyword$/, '')
    if (availableFields.includes(base)) return base
  }
  
  // Partial match (field contains the sanitized name)
  const partial = availableFields.find(f => f.includes(sanitized))
  if (partial) return partial
  
  return fieldName
}

/**
 * Map axis state to vega config using configKeys from axis definitions
 * This is the unified mapping function that all charts should use
 * @param {string} chartType - Chart type (e.g., "bar", "pie")
 * @param {string[]} availableFields - Available fields in the aggregated data
 */
function mapAxisToConfig(chartType, availableFields) {
  const axes = axisConfig[chartType]
  if (!axes) {
    console.warn('[mapAxisToConfig] No axis config for chart type:', chartType)
    return
  }
  
  console.log('[mapAxisToConfig] Mapping for', chartType, 'with fields:', availableFields)
  
  for (const axis of axes) {
    const { id, configKey, fieldType } = axis
    if (!configKey) continue // Skip axes without configKey (legacy)
    
    const state = axisState.value[id]
    if (!state) continue
    
    let resolvedValue = null
    
    if (fieldType === 'metric') {
      // Metric axes use either count or a specific metric field
      if (state.metric === 'count') {
        // Prefer _split_count when available (split aggregation)
        resolvedValue = availableFields.includes('_split_count') ? '_split_count' : '_count'
      } else if (state.metricField) {
        resolvedValue = resolveDataField(state.metricField, availableFields)
      }
    } else if (fieldType === 'bucket' || fieldType === 'numeric' || fieldType === 'any') {
      // Bucket/category axes use direct field names
      if (state.field) {
        // For primary bucket axis with multi-level buckets, use _composite_key if available
        // This works for any chart type (bar uses xField, pareto uses categoryField, etc.)
        const axisInfo = chartAxes.value.find(a => a.id === id)
        const isPrimary = axisInfo && isPrimaryBucketAxis(axisInfo, chartAxes.value)
        
        if (isPrimary && aggregationStore.currentConfig.bucketAggs?.length > 1) {
          // Check if _composite_key exists in available fields
          if (availableFields.includes('_composite_key')) {
            resolvedValue = '_composite_key'
            console.log('[mapAxisToConfig] Using composite key for multi-level primary bucket axis:', configKey)
          } else {
            resolvedValue = resolveDataField(state.field, availableFields)
          }
        } else {
          resolvedValue = resolveDataField(state.field, availableFields)
        }
      }
      // Color axis: NO automatic mapping from sub-grouping
      // Color is only set when user explicitly selects a field (handled by state.field above)
    }
    
    if (resolvedValue) {
      vegaStore.updateConfig(configKey, resolvedValue)
      console.log(`  [${id}] -> ${configKey} = ${resolvedValue}`)
    }
  }
}

// Map aggregated data fields to chart configuration
async function mapToChartFields(data) {
  if (!data || data.length === 0) return

  const chartType = vegaStore.selectedType
  const fields = Object.keys(data[0])

  console.log('[mapToChartFields] Chart type:', chartType, 'Available fields:', fields)

  // Use chart mapper system
  const mapper = getChartMapper(chartType, axisState, vegaStore)
  mapper.mapFieldsToConfig(data, fields, aggregationStore)
  updateConfigLabels()
  console.log('[mapToChartFields] Mapped using', mapper.constructor.name)

  // For most charts, the mapper handles everything. Only add special cases below if truly needed.

  // Gauge/Metric: Already handled by SingleValueMapper, no additional mapping needed
  if (chartType === 'gauge' || chartType === 'metric') {
    return
  }

  // Sankey/Chord: Already handled by FlowChartMapper, no additional mapping needed
  if (chartType === 'sankey' || chartType === 'chord') {
    return
  }

  // All other charts with configKeys: UnifiedChartMapper handles field mapping
  // No manual overrides needed (funnel, wordcloud, bubble, scatter, etc.)
}

// DELETED: 700+ lines of manual field mapping that duplicated mapper logic
// All charts now use their designated mapper (UnifiedChartMapper, FlowChartMapper, or SingleValueMapper)
// This ensures consistent behavior and proper re-mapping when metric fields change

// Update the Vega config with custom axis labels
function updateConfigLabels() {
  const xLabel = axisState.value.x?.label
  const yLabel = axisState.value.y?.label
  const colorLabel = axisState.value.color?.label
  
  // Only set labels that have been explicitly configured
  vegaStore.updateConfig('xLabel', xLabel || '')
  vegaStore.updateConfig('yLabel', yLabel || '')
  vegaStore.updateConfig('legendLabel', colorLabel || '')
  
  console.log('Custom labels updated:', { xLabel, yLabel, legendLabel: colorLabel })
}

// Flatten nested objects for Vega consumption
// Converts { products: { base_price: 29.99 } } to { "products.base_price": 29.99 }
function flattenObject(obj, prefix = '') {
  const flattened = {}

  for (const key in obj) {
    // Skip prototype properties
    if (!obj.hasOwnProperty(key)) continue

    const value = obj[key]

    // Handle null/undefined
    if (value === null || value === undefined) {
      flattened[prefix + key] = value
      continue
    }

    // Handle arrays - flatten by index or keep as is
    if (Array.isArray(value)) {
      flattened[prefix + key] = value
      continue
    }

    // Handle dates - keep as is
    if (value instanceof Date) {
      flattened[prefix + key] = value
      continue
    }

    // Recursively flatten nested objects (but not Date, RegExp, etc.)
    if (typeof value === 'object' && value.constructor === Object) {
      Object.assign(flattened, flattenObject(value, prefix + key + '.'))
    } else {
      flattened[prefix + key] = value
    }
  }

  return flattened
}

// Reset configuration
function resetConfig() {
  axisState.value = {
    x: { field: null, aggregation: 'terms', options: { size: 25 }, label: '' },
    y: { field: null, metric: 'count', metricField: null, label: '' },
    color: { field: null, label: '' },
    size: { field: null, metric: 'avg', label: '' },
    source: { field: null, aggregation: 'terms', options: { size: 25 }, label: '' },
    target: { field: null, aggregation: 'terms', options: { size: 25 }, label: '' },
    value: { field: null, metric: 'sum', metricField: null, label: '' },
    text: { field: null, aggregation: 'terms', options: { size: 100 }, label: '' },
    label: { field: null, aggregation: 'terms', options: { size: 50 }, label: '' },
    top: { field: null, metric: 'sum', metricField: null, label: '' },
    left: { field: null, metric: 'sum', metricField: null, label: '' },
    right: { field: null, metric: 'sum', metricField: null, label: '' },
    category: { field: null, aggregation: 'terms', options: { size: 25 }, label: '' },
    time: { field: null, aggregation: 'terms', options: { size: 10 }, label: '' },
    key: { field: null, aggregation: 'terms', options: { size: 25 }, label: '' },
    columns: { fields: [], label: '' }
  }
  error.value = null
  aggregationStore.reset()
  emit('data-updated', [])
}

// Close all pickers
function closePickers(e) {
  if (!e.target.closest('.field-picker-wrapper')) {
    Object.keys(showFieldPicker.value).forEach(k => {
      showFieldPicker.value[k] = false
    })
  }
}

// Get selected field info
function getSelectedFieldInfo(axisId, axis) {
  const state = axisState.value[axisId]
  if (!state) return null
  
  if (axis.fieldType === 'metric') {
    const metric = metricTypes.find(m => m.id === state.metric)
    if (metric?.needsField && state.metricField) {
      return elasticStore.fields.find(f => f.name === state.metricField)
    }
    return null
  }
  
  return elasticStore.fields.find(f => f.name === state.field)
}

// Global click handler to close dropdowns
function handleGlobalClick(event) {
  // Check if click is outside all dropdowns
  const isInsideDropdown = event.target.closest('.field-picker-dropdown')
  const isInsideButton = event.target.closest('.field-picker-wrapper button')
  
  if (!isInsideDropdown && !isInsideButton) {
    Object.keys(showFieldPicker.value).forEach(key => {
      showFieldPicker.value[key] = false
    })
  }
}

// Clear axis state for axes that don't apply to the current chart type
watch(() => vegaStore.selectedType, (newType, oldType) => {
  if (newType && newType !== oldType) {
    const currentChartAxes = axisConfig[newType] || []
    const validAxisIds = new Set(currentChartAxes.map(a => a.id))
    
    // Clear any axes that aren't valid for this chart type
    // This prevents stale data from causing errors
    Object.keys(axisState.value).forEach(axisId => {
      if (!validAxisIds.has(axisId)) {
        const state = axisState.value[axisId]
        // Reset the field/metric for axes not used by this chart
        if (state && state.field) {
          state.field = null
        }
        if (state && state.metricField) {
          state.metricField = null
        }
      }
    })
    
    console.log(`[UnifiedDataPanel] Chart type changed to ${newType}, cleared unused axes`)
    
    // Sync axisState from vegaStore.config after chart type change
    // and trigger re-aggregation if fields are configured
    nextTick(() => syncAxisStateFromConfig(true))
  }
})

// Sync axisState from vegaStore.config (for when config is updated externally, e.g., from ChartAlternatives)
function syncAxisStateFromConfig(triggerAggregation = false) {
  const chartType = vegaStore.selectedType
  const currentChartAxes = axisConfig[chartType] || []
  const config = vegaStore.config
  
  if (!currentChartAxes.length) return
  
  let synced = false
  const syncedFields = []
  
  for (const axis of currentChartAxes) {
    const configKey = axis.configKey
    const configValue = config[configKey]
    
    if (configValue) {
      // Find the field info from elastic store
      const fieldInfo = elasticStore.fields.find(f => f.name === configValue)
      
      if (axis.fieldType === 'metric') {
        // For metric axes, the config value is the metric field name
        const currentMetricField = axisState.value[axis.id]?.metricField
        
        // Skip syncing if config value is an aggregated version of the current field
        // This prevents overwriting "products.base_price" with "sum_products_base_price"
        // which would cause field name accumulation on re-aggregation
        const isAggregatedVersion = currentMetricField && (
          // Check if configValue is aggregationType_currentField (e.g., sum_products_base_price)
          configValue.endsWith(currentMetricField.replace(/\./g, '_')) ||
          // Check common aggregation prefixes
          ['sum_', 'avg_', 'min_', 'max_', 'count_', 'median_'].some(prefix => 
            configValue.startsWith(prefix) && 
            configValue.includes(currentMetricField.replace(/\./g, '_'))
          )
        )
        
        // Also skip _count - it's a special aggregation result, not a source field
        const isCountField = configValue === '_count'
        
        if (currentMetricField !== configValue && !isAggregatedVersion && !isCountField) {
          axisState.value[axis.id] = {
            ...axisState.value[axis.id],
            metricField: configValue
          }
          synced = true
          syncedFields.push({axisId:axis.id,configKey,configValue,type:'metric'})
        }
      } else {
        // For bucket/other axes, the config value is the field name
        const currentField = axisState.value[axis.id]?.field
        // Check if config value is just a sanitized version of current field (dots replaced with underscores)
        // If so, don't overwrite - keep the original ES field name
        const isSanitizedVersion = currentField && configValue === currentField.replace(/\./g, '_')
        // Skip _composite_key - it's an internal field for multi-level buckets
        // The UI should keep showing the original user-selected field
        const isInternalCompositeKey = configValue === '_composite_key'
        if (currentField !== configValue && !isSanitizedVersion && !isInternalCompositeKey) {
          axisState.value[axis.id] = {
            ...axisState.value[axis.id],
            field: configValue,
            aggregation: fieldInfo?.category === 'date' ? 'date_histogram' : 'terms'
          }
          synced = true
          syncedFields.push({axisId:axis.id,configKey,configValue,type:'bucket'})
        }
      }
    }
  }
  
  if (synced) {
    
    // If we synced and should re-aggregate, do it
    if (triggerAggregation && isConfigComplete.value) {
      // Use nextTick to ensure state is updated
      nextTick(() => {
        checkAndRunAggregation()
      })
    }
  }
}

// Track last chart type to detect switches
let lastChartType = vegaStore.selectedType

// Watch for external config changes and sync axisState
watch(() => vegaStore.config, (newConfig) => {
  // Check if chart type changed
  const chartTypeChanged = vegaStore.selectedType !== lastChartType
  lastChartType = vegaStore.selectedType
  
  // Debounce to avoid rapid updates, and trigger re-aggregation if chart type changed
  setTimeout(() => syncAxisStateFromConfig(chartTypeChanged), 50)
}, { deep: true })

onMounted(() => {
  aggregationStore.fetchAggregationTypes()
  aggregationStore.fetchDateIntervals()
  document.addEventListener('click', handleGlobalClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
})
</script>

<template>
  <div class="space-y-4" @click="closePickers">
    <!-- Status Bar -->
    <div class="flex items-center justify-between gap-3">
      <!-- Status indicators -->
      <div class="flex items-center gap-3">
        <!-- Config status -->
        <div
          class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium"
          :class="isConfigComplete
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-slate-700/50 text-slate-400'"
        >
          <Check v-if="isConfigComplete" class="w-3.5 h-3.5" />
          <AlertTriangle v-else class="w-3.5 h-3.5" />
          {{ isConfigComplete ? 'Ready' : 'Incomplete' }}
        </div>

        <!-- Data status -->
        <div
          v-if="aggregationStore.aggregatedData.length > 0"
          class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-ocean-500/20 text-ocean-400"
        >
          <Check class="w-3.5 h-3.5" />
          {{ aggregationStore.aggregatedData.length }} points
        </div>
      </div>

      <!-- Reset button -->
      <button
        v-if="axisState.x?.field || axisState.y?.metric !== 'count'"
        @click="resetConfig"
        class="flex items-center gap-1 text-xs text-slate-400 hover:text-coral-400 transition-colors"
      >
        <RotateCcw class="w-3 h-3" />
        Reset
      </button>
    </div>

    <!-- Axis Configuration Cards -->
    <div class="space-y-3">
      <div 
        v-for="axis in chartAxes"
        :key="axis.id"
        class="border rounded-xl overflow-hidden transition-all duration-200"
        :class="[
          expandedAxes[axis.id] 
            ? 'border-ocean-500/50 bg-slate-800/40' 
            : 'border-slate-700/50 bg-slate-800/20'
        ]"
      >
        <!-- Axis Header -->
        <button
          @click="expandedAxes[axis.id] = !expandedAxes[axis.id]"
          class="w-full flex items-center justify-between p-3 hover:bg-slate-800/40 transition-colors"
        >
          <div class="flex items-center gap-3">
            <!-- Axis indicator -->
            <div 
              class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
              :class="[
                axis.fieldType === 'bucket' ? 'bg-emerald-500/20 text-emerald-400' :
                axis.fieldType === 'metric' ? 'bg-blue-500/20 text-blue-400' :
                'bg-purple-500/20 text-purple-400'
              ]"
            >
              {{ axis.id.toUpperCase() }}
            </div>
            <div class="text-left">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-white">{{ axis.name }}</span>
                <span v-if="axis.required" class="text-coral-400 text-xs">*</span>
              </div>
              <p class="text-xs text-slate-500">{{ axis.description }}</p>
            </div>
          </div>
          
          <!-- Status -->
          <div class="flex items-center gap-2">
            <span 
              v-if="getSelectedFieldInfo(axis.id, axis)"
              class="text-xs text-ocean-300 truncate max-w-[100px]"
            >
              {{ getSelectedFieldInfo(axis.id, axis)?.name || axisState[axis.id]?.field }}
            </span>
            <span 
              v-else-if="axis.fieldType === 'metric' && axisState[axis.id]?.metric === 'count'"
              class="text-xs text-blue-300"
            >
              Count
            </span>
            <ChevronDown 
              class="w-4 h-4 text-slate-400 transition-transform"
              :class="{ 'rotate-180': expandedAxes[axis.id] }"
            />
          </div>
        </button>

        <!-- Axis Content -->
        <div v-if="expandedAxes[axis.id]" class="p-3 pt-0 space-y-3">
          <!-- Metric type selector (for metric axes) -->
          <div v-if="axis.fieldType === 'metric'" class="space-y-2">
            <label class="form-label text-xs">Aggregation</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="metric in metricTypes"
                :key="metric.id"
                @click="selectMetric(axis.id, metric)"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
                :class="[
                  axisState[axis.id]?.metric === metric.id
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/60 border border-transparent'
                ]"
              >
                {{ metric.name }}
              </button>
            </div>
          </div>

          <!-- Field picker (for buckets, numeric, or metrics that need a field) -->
          <div 
            v-if="axis.fieldType === 'bucket' || 
                  axis.fieldType === 'numeric' ||
                  (axis.fieldType === 'metric' && metricTypes.find(m => m.id === axisState[axis.id]?.metric)?.needsField)"
            class="field-picker-wrapper relative"
          >
            <label class="form-label text-xs">
              {{ axis.fieldType === 'bucket' ? 'Field' : (axis.fieldType === 'numeric' ? 'Numeric Field' : 'Field to aggregate') }}
            </label>
            <div class="flex items-center gap-1.5">
              <button
                @click.stop="toggleFieldPicker(axis.id, $event)"
                class="flex-1 flex items-center justify-between p-2.5 rounded-xl border transition-all text-left text-sm"
                :class="[
                  axisState[axis.id]?.field || axisState[axis.id]?.metricField
                    ? 'bg-slate-700/50 border-ocean-500/30 text-white'
                    : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:border-slate-600'
                ]"
              >
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <component
                    v-if="getSelectedFieldInfo(axis.id, axis)"
                    :is="getFieldIcon(getSelectedFieldInfo(axis.id, axis))"
                    :class="['w-4 h-4 flex-shrink-0', getFieldTypeColor(getSelectedFieldInfo(axis.id, axis))]"
                  />
                  <Box v-else class="w-4 h-4 flex-shrink-0 text-slate-500" />
                  <span
                    class="truncate"
                    :title="axis.fieldType === 'metric'
                      ? (axisState[axis.id]?.metricField || '')
                      : (axisState[axis.id]?.field || axisState[axis.id]?.numericField || '')"
                  >
                    {{
                      axis.fieldType === 'metric'
                        ? (axisState[axis.id]?.metricField || 'Select field...')
                        : (axisState[axis.id]?.field || axisState[axis.id]?.numericField || 'Select field...')
                    }}
                  </span>
                </div>
                <ChevronDown class="w-4 h-4" :class="{ 'rotate-180': showFieldPicker[axis.id] }" />
              </button>
              <!-- Clear button -->
              <button
                v-if="axisState[axis.id]?.field || axisState[axis.id]?.metricField"
                @click.stop="clearField(axis.id)"
                class="p-2.5 rounded-xl border border-slate-700/50 bg-slate-800/40 text-slate-400 hover:text-coral-400 hover:border-coral-500/30 transition-all"
                title="Clear field"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            <!-- Field dropdown - using Teleport to escape overflow:hidden containers -->
            <Teleport to="body">
              <div 
                v-if="showFieldPicker[axis.id]"
                class="field-picker-dropdown fixed z-[9999] flex flex-col bg-slate-800 border border-slate-700 rounded-xl shadow-2xl"
                :style="getDropdownPosition(axis.id)"
                @click.stop
              >
                <div class="p-2 border-b border-slate-700 flex-shrink-0">
                  <div class="relative">
                    <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      :ref="el => { if (el && showFieldPicker[axis.id]) el.focus() }"
                      v-model="fieldSearch[axis.id]"
                      type="text"
                      placeholder="Search..."
                      class="w-full pl-8 pr-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-ocean-500"
                    />
                  </div>
                </div>
                <div class="flex-1 overflow-y-auto p-1">
                  <div v-if="getFieldsForAxisWrapper(axis).length === 0" class="p-3 text-center text-sm text-slate-500">
                    No fields found
                  </div>
                  <button
                    v-for="field in getFieldsForAxisWrapper(axis)"
                    :key="field.name"
                    @click="selectField(axis.id, field)"
                    class="field-item-btn w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors text-sm relative group"
                    :class="[
                      (axis.fieldType === 'metric' ? axisState[axis.id]?.metricField : axisState[axis.id]?.field) === field.name
                        ? 'bg-ocean-500/20 text-ocean-300'
                        : 'hover:bg-slate-700/50 text-slate-300'
                    ]"
                  >
                    <component :is="getFieldIcon(field)" :class="['w-3.5 h-3.5 flex-shrink-0', getFieldTypeColor(field)]" />
                    <span class="flex-1 truncate">{{ field.name }}</span>
                    <span class="text-xs text-slate-500 flex-shrink-0">{{ field.type }}</span>
                    <!-- Custom tooltip -->
                    <span 
                      v-if="field.name.length > 25"
                      class="field-tooltip absolute left-0 -top-8 px-2 py-1 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg"
                    >
                      {{ field.name }}
                    </span>
                  </button>
                </div>
              </div>
            </Teleport>
          </div>

          <!-- Custom Display Label -->
          <div 
            v-if="axisState[axis.id]?.field || axisState[axis.id]?.metricField || (axis.fieldType === 'metric' && axisState[axis.id]?.metric === 'count')"
            class="mt-2"
          >
            <label class="form-label text-xs flex items-center gap-1">
              <Type class="w-3 h-3" />
              Display Label
            </label>
            <input
              type="text"
              :value="axisState[axis.id]?.label || ''"
              @input="updateAxisLabel(axis.id, $event.target.value)"
              :placeholder="getDefaultLabel(axis)"
              class="form-input py-1.5 text-xs"
            />
          </div>

          <!-- Bucket-specific options - Sentence Builder Style -->
          <div v-if="axis.fieldType === 'bucket' && axisState[axis.id]?.aggregation === 'terms' && (vegaStore.selectedType !== 'sankey' || axis.id === 'source')" class="mt-3 space-y-2">
            
            <!-- Sentence line 1: "Show top [N] categories" -->
            <div class="flex items-center gap-1.5 flex-wrap text-sm text-slate-300">
              <span class="text-slate-400">Show top</span>
              <input
                type="number"
                :value="axisState[axis.id]?.options?.size || 25"
                @input="updateAxisOption(axis.id, 'size', parseInt($event.target.value) || 25)"
                min="1"
                max="10000"
                class="inline-input w-14 text-center"
              />
              <span class="text-slate-400">{{ vegaStore.selectedType === 'sankey' ? 'pairs' : 'values' }}</span>
            </div>
            
            <!-- Sentence line 2: "ordered by [Count ▼] [↓ desc]" -->
            <div class="flex items-center gap-1.5 flex-wrap text-sm text-slate-300">
              <span class="text-slate-400">ordered by</span>
              <select
                :value="axisState[axis.id]?.options?.orderBy || '_count'"
                @change="updateAxisOption(axis.id, 'orderBy', $event.target.value)"
                class="inline-select"
              >
                <option value="_count">Count</option>
                <option value="_key">Name</option>
                <option v-if="hasNumericMetric" value="custom_metric">Metric</option>
              </select>
              
              <!-- Custom metric inline: "of [Sum ▼] of [field ▼]" -->
              <template v-if="axisState[axis.id]?.options?.orderBy === 'custom_metric'">
                <span class="text-slate-500">(</span>
                <select
                  :value="axisState[axis.id]?.options?.orderMetricType || 'sum'"
                  @change="updateAxisOption(axis.id, 'orderMetricType', $event.target.value)"
                  class="inline-select"
                >
                  <option value="sum">Sum</option>
                  <option value="avg">Avg</option>
                  <option value="min">Min</option>
                  <option value="max">Max</option>
                </select>
                <span class="text-slate-400">of</span>
                <select
                  :value="axisState[axis.id]?.options?.orderMetricField || ''"
                  @change="updateAxisOption(axis.id, 'orderMetricField', $event.target.value)"
                  class="inline-select min-w-[80px]"
                >
                  <option value="">field...</option>
                  <option v-for="field in elasticStore.aggregatableNumericFields" :key="field.name" :value="field.name">
                    {{ field.name.length > 15 ? field.name.slice(0, 15) + '…' : field.name }}
                  </option>
                </select>
                <span class="text-slate-500">)</span>
              </template>
              
              <!-- Direction toggle button -->
              <button
                @click="toggleOrderDirection(axis.id)"
                class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-700/50 hover:bg-slate-600/50 transition-colors"
                :title="(axisState[axis.id]?.options?.orderDirection || 'desc') === 'desc' ? 'Descending (click to change)' : 'Ascending (click to change)'"
              >
                <component 
                  :is="(axisState[axis.id]?.options?.orderDirection || 'desc') === 'desc' ? TrendingDown : TrendingUp" 
                  class="w-3.5 h-3.5"
                />
                <span class="text-xs">{{ (axisState[axis.id]?.options?.orderDirection || 'desc') === 'desc' ? 'desc' : 'asc' }}</span>
              </button>
            </div>
            
            <!-- Sankey note -->
            <p v-if="vegaStore.selectedType === 'sankey'" class="text-xs text-slate-500">
              Top source→target combinations
            </p>
          </div>
          
          <!-- Multi-Level Bucket Aggregations (Kibana-style sub-grouping) -->
          <!-- Show for the first bucket axis that has a field selected -->
          <div 
            v-if="supportsMultiLevelBuckets && axis.fieldType === 'bucket' && isPrimaryBucketAxis(axis, chartAxes) && axisState[axis.id]?.field"
            class="mt-3 pt-3 border-t border-slate-700/30"
          >
            <div class="flex items-center justify-between mb-2">
              <label class="form-label text-xs flex items-center gap-1.5">
                <Layers class="w-3 h-3" />
                Sub-groupings
              </label>
              <span class="text-xs text-slate-500">{{ additionalBucketLevels.length }} / 3</span>
            </div>
            
            <!-- Existing sub-levels -->
            <div v-if="additionalBucketLevels.length > 0" class="space-y-1.5 mb-2">
              <div 
                v-for="(level, idx) in additionalBucketLevels" 
                :key="level.id || idx"
                class="flex items-center gap-2 p-2 bg-slate-800/40 rounded-lg group"
              >
                <!-- Reorder buttons -->
                <div class="flex flex-col gap-0.5">
                  <button 
                    @click="moveBucketLevelUp(idx)"
                    :disabled="idx === 0"
                    class="p-0.5 text-slate-500 hover:text-ocean-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move up"
                  >
                    <ArrowUp class="w-3 h-3" />
                  </button>
                  <button 
                    @click="moveBucketLevelDown(idx)"
                    :disabled="idx >= additionalBucketLevels.length - 1"
                    class="p-0.5 text-slate-500 hover:text-ocean-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move down"
                  >
                    <ArrowDown class="w-3 h-3" />
                  </button>
                </div>
                <div class="flex-1 min-w-0">
                  <span class="text-xs text-slate-300 truncate block">{{ level.field }}</span>
                  <span class="text-xs text-slate-500">{{ level.type }}</span>
                </div>
                <button 
                  @click="removeBucketLevel(idx)" 
                  class="p-1 text-slate-500 hover:text-red-400 opacity-50 group-hover:opacity-100 transition-opacity"
                  title="Remove"
                >
                  <X class="w-3 h-3" />
                </button>
              </div>
            </div>
            
            <!-- Add sub-grouping button -->
            <div v-if="additionalBucketLevels.length < 3" class="relative">
              <button
                v-if="!showSubGroupPicker"
                @click="showSubGroupPicker = true"
                class="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs text-ocean-400 hover:text-ocean-300 hover:bg-ocean-500/10 border border-dashed border-slate-600 hover:border-ocean-500/50 rounded-lg transition-all"
              >
                <Plus class="w-3 h-3" />
                Add sub-grouping
              </button>
              
              <!-- Sub-group field picker -->
              <div v-else class="bg-slate-800 border border-slate-600 rounded-lg p-2 space-y-2">
                <div class="flex items-center gap-2">
                  <Search class="w-3 h-3 text-slate-400" />
                  <input
                    v-model="subGroupSearch"
                    type="text"
                    placeholder="Search fields..."
                    class="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                    ref="subGroupSearchInput"
                  />
                  <button @click="showSubGroupPicker = false; subGroupSearch = ''" class="text-slate-400 hover:text-white">
                    <X class="w-3 h-3" />
                  </button>
                </div>
                <div class="max-h-32 overflow-y-auto space-y-0.5">
                  <button
                    v-for="field in subGroupFields.slice(0, 10)"
                    :key="field.name"
                    @click="addBucketLevel(field)"
                    class="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700/50 rounded transition-colors text-left"
                  >
                    <component :is="getFieldIcon(field)" :class="['w-3 h-3', getFieldTypeColor(field)]" />
                    <span class="truncate">{{ field.name }}</span>
                  </button>
                  <p v-if="subGroupFields.length === 0" class="text-xs text-slate-500 text-center py-2">
                    No fields available
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Date histogram options -->
          <div v-if="axis.fieldType === 'bucket' && axisState[axis.id]?.aggregation === 'date_histogram'" class="space-y-2">
            <div class="flex gap-2">
              <div class="flex-1">
                <label class="form-label text-xs flex items-center gap-1">
                  <Clock class="w-3 h-3" />
                  Time Interval
                </label>
                <select
                  :value="axisState[axis.id]?.options?.interval || 'auto'"
                  @change="updateAxisOption(axis.id, 'interval', $event.target.value)"
                  class="form-select py-1.5 text-xs"
                >
                  <optgroup label="Automatic">
                    <option value="auto">Auto (recommended)</option>
                  </optgroup>
                  <optgroup label="Calendar Intervals">
                    <option value="minute">Per Minute</option>
                    <option value="hour">Hourly</option>
                    <option value="day">Daily</option>
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                    <option value="quarter">Quarterly</option>
                    <option value="year">Yearly</option>
                  </optgroup>
                  <optgroup label="Fixed Intervals">
                    <option value="1s">1 Second</option>
                    <option value="5s">5 Seconds</option>
                    <option value="30s">30 Seconds</option>
                    <option value="1m">1 Minute</option>
                    <option value="5m">5 Minutes</option>
                    <option value="15m">15 Minutes</option>
                    <option value="30m">30 Minutes</option>
                    <option value="1h">1 Hour</option>
                    <option value="3h">3 Hours</option>
                    <option value="6h">6 Hours</option>
                    <option value="12h">12 Hours</option>
                    <option value="1d">1 Day</option>
                    <option value="7d">7 Days</option>
                  </optgroup>
                </select>
              </div>
              <div class="w-32">
                <label class="form-label text-xs">Timezone</label>
                <select
                  :value="axisState[axis.id]?.options?.timeZone || 'UTC'"
                  @change="updateAxisOption(axis.id, 'timeZone', $event.target.value)"
                  class="form-select py-1.5 text-xs"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">US Eastern</option>
                  <option value="America/Chicago">US Central</option>
                  <option value="America/Denver">US Mountain</option>
                  <option value="America/Los_Angeles">US Pacific</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                  <option value="Asia/Shanghai">Shanghai</option>
                  <option value="Australia/Sydney">Sydney</option>
                </select>
              </div>
            </div>
            <div class="flex gap-2">
              <div class="flex-1">
                <label class="form-label text-xs">Min Doc Count</label>
                <input
                  type="number"
                  min="0"
                  :value="axisState[axis.id]?.options?.minDocCount ?? 0"
                  @input="updateAxisOption(axis.id, 'minDocCount', parseInt($event.target.value) || 0)"
                  class="form-input py-1.5 text-xs"
                  placeholder="0"
                />
              </div>
              <div class="flex-1">
                <label class="form-label text-xs">Date Format</label>
                <select
                  :value="axisState[axis.id]?.options?.format || 'yyyy-MM-dd'"
                  @change="updateAxisOption(axis.id, 'format', $event.target.value)"
                  class="form-select py-1.5 text-xs"
                >
                  <option value="yyyy-MM-dd'T'HH:mm:ss">Full ISO</option>
                  <option value="yyyy-MM-dd HH:mm">Date & Time</option>
                  <option value="yyyy-MM-dd">Date Only</option>
                  <option value="yyyy-MM">Month</option>
                  <option value="yyyy">Year</option>
                  <option value="HH:mm">Time Only</option>
                  <option value="EEE">Day Name</option>
                  <option value="MMM yyyy">Month Year</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div v-if="isConfigComplete" class="space-y-3">
      <!-- Run button -->
      <button
        @click="runAggregation"
        :disabled="!isConfigComplete || isLoading"
        class="btn-primary w-full flex items-center justify-center gap-2 py-2.5 disabled:opacity-50"
      >
        <Play v-if="!isLoading" class="w-4 h-4" />
        <div v-else class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        {{ isLoading ? 'Running...' : 'Generate Chart' }}
      </button>
    </div>

    <!-- Error -->
    <div 
      v-if="error"
      class="p-3 bg-red-500/10 border border-red-500/30 rounded-xl"
    >
      <div class="flex items-start gap-2">
        <AlertTriangle class="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
        <div class="flex-1">
          <p class="text-sm text-red-400">{{ error }}</p>
        </div>
        <button @click="error = null" class="text-slate-400 hover:text-white">
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.field-picker-wrapper {
  position: relative;
}

/* Inline sentence builder styles */
.inline-input {
  @apply px-2 py-1 text-sm bg-slate-800/80 border border-slate-600 rounded-md text-ocean-300 font-medium;
  @apply focus:outline-none focus:ring-1 focus:ring-ocean-500 focus:border-ocean-500;
  @apply transition-colors;
}

.inline-input::-webkit-inner-spin-button,
.inline-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.inline-input[type='number'] {
  -moz-appearance: textfield;
}

.inline-select {
  @apply px-2 py-1 text-sm bg-slate-800/80 border border-slate-600 rounded-md text-ocean-300 font-medium;
  @apply focus:outline-none focus:ring-1 focus:ring-ocean-500 focus:border-ocean-500;
  @apply transition-colors cursor-pointer appearance-none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.25rem center;
  background-repeat: no-repeat;
  background-size: 1rem 1rem;
  padding-right: 1.5rem;
}

.inline-select:hover {
  @apply border-slate-500 bg-slate-700/80;
}
</style>


