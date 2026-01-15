<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useElasticStore } from '@/stores/elastic'
import { useVegaStore } from '@/stores/vega'
import { useAggregationStore } from '@/stores/aggregation'
import { useResizablePanel } from '@/composables/useResizablePanel'
import { 
  ChevronRight, 
  Eye,
  Settings2,
  Database,
  Palette,
  Code,
  RefreshCw,
  Layers,
  AlertCircle,
  BarChart3,
  LineChart,
  PieChart,
  Activity,
  Grid3X3,
  Circle,
  Square,
  Gauge,
  Hash,
  Box,
  Cloud,
  ArrowRightLeft,
  CircleDot,
  Radar,
  Filter,
  GitCommit,
  Waves,
  Mountain,
  LayoutGrid,
  Target,
  TrendingUp,
  Download,
  GripVertical
} from 'lucide-vue-next'

import DataSourcePanel from '@/components/builder/DataSourcePanel.vue'
import VisualizationTypePicker from '@/components/builder/VisualizationTypePicker.vue'
import ConfigurationPanel from '@/components/builder/ConfigurationPanel.vue'
import VegaPreview from '@/components/builder/VegaPreview.vue'
import SpecEditor from '@/components/builder/SpecEditor.vue'
import ResizeHandle from '@/components/ui/ResizeHandle.vue'
// TODO: Re-enable when ChartAlternatives feature is complete
// import ChartAlternatives from '@/components/builder/ChartAlternatives.vue'

const route = useRoute()
const elasticStore = useElasticStore()
const vegaStore = useVegaStore()
const aggregationStore = useAggregationStore()

// Resizable panel
const { 
  panelWidth, 
  isResizing, 
  startResize, 
  startResizeTouch 
} = useResizablePanel({
  initialWidth: 384,
  minWidth: 320,
  maxWidth: 550,
  storageKey: 'builder-config-panel-width'
})


const currentStep = ref(1)
const activeTab = ref('preview')
const aggregatedData = ref([])
let generateTimeout = null // Debounce timer

// Chart types that have specialized field mapping in UnifiedDataPanel
// These have complex field mapping that should NEVER be overwritten
const SPECIALIZED_CHART_TYPES = new Set([
  'sankey',
  'wordcloud', 
  'waterfall',
  'rolling_average',
  'ternary',
  'comet',
  'heatlane',
  'radar',
  'bubble',
  'scatter',
  'boxplot',
  'histogram',
  'binned_heatmap',
  'dual_axis',
  'population_pyramid',
  'lasagna',
  'trellis_area',
  'bullet'
])

// Flag to track if we've already done field mapping for this data set
let lastMappedDataHash = null

// Required fields for each chart type - used for validation
const CHART_REQUIRED_FIELDS = {
  bar: ['xField', 'yField'],
  line: ['xField', 'yField'],
  area: ['xField', 'yField'],
  pie: ['categoryField', 'valueField'],
  donut: ['categoryField', 'valueField'],
  scatter: ['xField', 'yField'],
  bubble: ['xField', 'yField', 'sizeField'],
  heatmap: ['xField', 'yField', 'valueField'],
  binned_heatmap: ['xField', 'yField'],
  histogram: ['field'],
  treemap: ['categoryField', 'valueField'],
  gauge: ['valueField'],
  metric: ['valueField'],
  boxplot: ['categoryField', 'valueField'],
  wordcloud: ['textField'],
  sankey: ['sourceField', 'targetField', 'valueField'],
  radial: ['categoryField', 'valueField'],
  waterfall: ['labelField', 'valueField'],
  rolling_average: ['xField', 'yField'],
  ternary: ['labelField', 'topField', 'leftField', 'rightField'],
  comet: ['categoryField', 'timeField', 'valueField'],
  heatlane: ['valueField'],
  dual_axis: ['xField', 'yField1', 'yField2'],
  population_pyramid: ['categoryField', 'valueField', 'groupField'],
  lasagna: ['xField', 'yField', 'valueField'],
  trellis_area: ['xField', 'yField', 'facetField'],
  bullet: ['titleField', 'measuresField', 'rangesField'],
  radar: ['keyField', 'valueField'],
  table: []
}

// Check if all required fields are already set for a chart type
function areRequiredFieldsSet(chartType) {
  const required = CHART_REQUIRED_FIELDS[chartType] || []
  const config = vegaStore.config
  return required.every(field => config[field] && config[field] !== '')
}

const steps = [
  { id: 1, name: 'Data Source', icon: Database },
  { id: 2, name: 'Chart Type', icon: Palette },
  { id: 3, name: 'Configure', icon: Settings2 }
]

const canProceedToStep2 = computed(() => elasticStore.currentIndex !== null)
const canProceedToStep3 = computed(() => vegaStore.selectedType !== null)
const canGenerate = computed(() => vegaStore.isConfigComplete)
const validationResult = ref(null)
const isValidating = ref(false)

// Run full validation diagnostics
async function runDiagnostics() {
  if (!vegaStore.selectedType) {
    console.warn('[BuilderView] Cannot run diagnostics - no chart type selected')
    return
  }
  
  isValidating.value = true
  
  try {
    const result = await vegaStore.validateConfig(chartData.value)
    validationResult.value = result
    
    console.log('[BuilderView] Validation result:', {
      chartType: vegaStore.selectedType,
      canGenerate: result.canGenerate,
      errors: result.errors,
      warnings: result.warnings,
      schema: result.schema
    })
    
    if (!result.canGenerate && result.errors?.length > 0) {
      console.error('[BuilderView] Cannot generate chart. Issues found:', result.errors)
    }
    
    return result
  } catch (err) {
    console.error('[BuilderView] Diagnostics failed:', err)
    validationResult.value = { valid: false, errors: [{ message: err.message }] }
  } finally {
    isValidating.value = false
  }
}

// Determine which data source to use
const chartData = computed(() => {
  if (aggregationStore.aggregatedData.length > 0) {
    return aggregationStore.aggregatedData
  }
  return elasticStore.sampleData
})

const dataSourceInfo = computed(() => {
  if (aggregationStore.aggregatedData.length > 0) {
    return {
      type: 'aggregated',
      count: aggregationStore.aggregatedData.length,
      label: 'Aggregated Data'
    }
  }
  return {
    type: 'raw',
    count: elasticStore.sampleData.length,
    label: 'Sample Data'
  }
})

async function generatePreview() {
  console.log('[BuilderView] generatePreview called')

  if (!canGenerate.value) {
    const validation = vegaStore.configValidation
    console.warn('[BuilderView] Cannot generate - validation failed:', {
      chartType: vegaStore.selectedType,
      missingFields: validation.missing,
      messages: validation.messages,
      currentConfig: validation.currentConfig,
      requiredFields: validation.requiredFields
    })
    return
  }

  if (chartData.value.length === 0) {
    console.warn('[BuilderView] Cannot generate - no data')
    return
  }

  console.log('[BuilderView] Generating preview with:', {
    chartType: vegaStore.selectedType,
    dataPoints: chartData.value.length,
    config: { ...vegaStore.config }
  })

  try {
    await vegaStore.generateSpec(chartData.value)
    console.log('[BuilderView] Preview generated successfully')
  } catch (err) {
    console.error('[BuilderView] Preview generation failed:', err)
  }
}

// Debounced version to prevent rapid fire during config changes
function debouncedGeneratePreview() {
  if (generateTimeout) clearTimeout(generateTimeout)
  generateTimeout = setTimeout(() => {
    generatePreview()
  }, 300)
}

function handleAggregatedData(data) {
  aggregatedData.value = data

  console.log('[BuilderView] handleAggregatedData called with', data?.length, 'records')

  if (data && data.length > 0) {
    // Map fields to the actual data keys (resolves sanitized field names)
    // This must complete BEFORE generating the preview
    resetConfigFieldsToAggregatedData(data)

    // Use nextTick + timeout to ensure Vue processes all config updates
    // before attempting to generate the preview
    nextTick(() => {
      setTimeout(() => {
        console.log('[BuilderView] Checking canGenerate:', canGenerate.value, 'isConfigComplete:', vegaStore.isConfigComplete)
        if (canGenerate.value) {
          console.log('[BuilderView] Field mapping complete, generating preview')
          generatePreview()
        } else {
          console.warn('[BuilderView] Cannot generate preview - config incomplete. Missing fields:', vegaStore.configValidation)
        }
      }, 150)
    })
  }
}

// Handle color configuration changes - regenerate chart with new colors
function handleColorChanged() {
  console.log('[BuilderView] Color config changed, regenerating preview')
  if (canGenerate.value && chartData.value.length > 0) {
    debouncedGeneratePreview()
  }
}

// Auto-map config fields from aggregated data (one-time operation per data set)
// This does NOT prevent user changes or re-rendering - it only handles initial field mapping
function resetConfigFieldsToAggregatedData(data) {
  if (!data || data.length === 0 || !vegaStore.configSchema) {
    console.log('[BuilderView] resetConfigFieldsToAggregatedData: No data or schema')
    return
  }

  const chartType = vegaStore.selectedType
  const sample = data[0]
  const availableFields = Object.keys(sample)

  // Create a hash of the current data + chart type
  const dataHash = `${chartType}:${availableFields.sort().join(',')}`

  console.log('[BuilderView] resetConfigFieldsToAggregatedData:', { chartType, dataHash, lastMappedDataHash })

  // Skip if we've already auto-mapped this exact data set
  if (lastMappedDataHash === dataHash) {
    console.log('[BuilderView] Skipping - same data hash')
    return // Silent skip - no need to log
  }

  // Skip if required fields are already set (user or UnifiedDataPanel already configured them)
  if (areRequiredFieldsSet(chartType)) {
    console.log('[BuilderView] Skipping - required fields already set. Current config:', vegaStore.config)
    lastMappedDataHash = dataHash
    return // Fields already configured, don't overwrite
  }

  // For specialized chart types, let UnifiedDataPanel handle the mapping
  if (SPECIALIZED_CHART_TYPES.has(chartType)) {
    console.log('[BuilderView] Skipping - specialized chart type')
    return // UnifiedDataPanel will set the fields
  }
  
  // Mark this data set as mapped
  lastMappedDataHash = dataHash
  
  // Preserve user-selected optional fields before clearing
  const preservedColorField = vegaStore.config.colorField
  
  // Clear old field configs for standard chart types
  vegaStore.clearFieldConfigs()
  
  // Get bucket and metric field names
  const bucketConfig = aggregationStore.currentConfig.bucketAgg
  const metricConfig = aggregationStore.currentConfig.metrics?.[0]
  
  console.log('Resetting config fields:', { chartType, availableFields, bucketConfig, preservedColorField })
  
  // Handle Sankey charts specially (multi_terms aggregation)
  if (chartType === 'sankey') {
    const multiTermsFields = bucketConfig?.options?.fields || []
    const sourceField = multiTermsFields[0] || availableFields.find(f => f !== '_count' && typeof sample[f] !== 'number')
    const targetField = multiTermsFields[1] || availableFields.find(f => f !== sourceField && f !== '_count' && typeof sample[f] !== 'number')
    const valueField = availableFields.includes('_count') ? '_count' : availableFields.find(f => typeof sample[f] === 'number')
    
    console.log('Sankey field mapping:', { sourceField, targetField, valueField })
    
    if (sourceField) vegaStore.updateConfig('sourceField', sourceField)
    if (targetField) vegaStore.updateConfig('targetField', targetField)
    if (valueField) vegaStore.updateConfig('valueField', valueField)
    return
  }
  
  // Handle Wordcloud charts
  if (chartType === 'wordcloud') {
    const textField = bucketConfig?.field || availableFields.find(f => f !== '_count' && typeof sample[f] !== 'number')
    const sizeField = availableFields.includes('_count') ? '_count' : availableFields.find(f => typeof sample[f] === 'number')
    
    if (textField) vegaStore.updateConfig('textField', textField)
    if (sizeField) vegaStore.updateConfig('sizeField', sizeField)
    return
  }
  
  // Handle Waterfall charts
  if (chartType === 'waterfall') {
    const labelField = bucketConfig?.field || availableFields.find(f => f !== '_count' && typeof sample[f] !== 'number')
    const amountField = availableFields.includes('_count') ? '_count' : availableFields.find(f => typeof sample[f] === 'number')
    
    console.log('Waterfall field mapping:', { labelField, valueField: amountField })
    
    if (labelField) vegaStore.updateConfig('labelField', labelField)
    if (amountField) vegaStore.updateConfig('valueField', amountField)
    return
  }
  
  // Handle Rolling Average charts
  if (chartType === 'rolling_average') {
    const xField = bucketConfig?.field || availableFields.find(f => f !== '_count' && typeof sample[f] !== 'number')
    const yField = availableFields.includes('_count') ? '_count' : availableFields.find(f => typeof sample[f] === 'number')
    
    console.log('Rolling Average field mapping:', { xField, yField })
    
    if (xField) vegaStore.updateConfig('xField', xField)
    if (yField) vegaStore.updateConfig('yField', yField)
    return
  }
  
  // Handle Ternary charts
  if (chartType === 'ternary') {
    const labelField = bucketConfig?.field || availableFields.find(f => f !== '_count' && typeof sample[f] !== 'number')
    // Find numeric fields for the three vertices
    const numericFields = availableFields.filter(f => typeof sample[f] === 'number' && f !== '_count')
    
    console.log('Ternary field mapping:', { labelField, numericFields })
    
    if (labelField) vegaStore.updateConfig('labelField', labelField)
    if (numericFields[0]) vegaStore.updateConfig('topField', numericFields[0])
    if (numericFields[1]) vegaStore.updateConfig('leftField', numericFields[1])
    if (numericFields[2]) vegaStore.updateConfig('rightField', numericFields[2])
    return
  }
  
  // Handle Comet charts
  if (chartType === 'comet') {
    // Find string fields for category and time
    const stringFields = availableFields.filter(f => f !== '_count' && typeof sample[f] !== 'number')
    const categoryField = stringFields[0] || availableFields[0]
    const timeField = stringFields[1] || stringFields[0]
    const valueField = availableFields.includes('_count') ? '_count' : availableFields.find(f => typeof sample[f] === 'number')
    
    console.log('Comet field mapping:', { categoryField, timeField, valueField })
    
    if (categoryField) vegaStore.updateConfig('categoryField', categoryField)
    if (timeField) vegaStore.updateConfig('timeField', timeField)
    if (valueField) vegaStore.updateConfig('valueField', valueField)
    return
  }
  
  // Handle Heat Lane charts
  if (chartType === 'heatlane') {
    // Find a numeric field for the distribution
    const numericField = availableFields.find(f => typeof sample[f] === 'number' && f !== '_count')
    const valueField = numericField || availableFields.find(f => typeof sample[f] === 'number')
    
    console.log('Heat Lane field mapping:', { valueField })
    
    if (valueField) vegaStore.updateConfig('valueField', valueField)
    return
  }
  
  // Handle Bubble charts (requires xField, yField, sizeField)
  if (chartType === 'bubble') {
    // Find all numeric fields
    const numericFields = availableFields.filter(f => typeof sample[f] === 'number')
    
    console.debug('[BuilderView] Bubble chart field mapping:', {
      availableFields,
      numericFields,
      sampleData: sample
    })
    
    // For bubble charts from aggregation:
    // - xField: first numeric metric
    // - yField: second numeric metric or _count
    // - sizeField: _count or another numeric field
    let xField, yField, sizeField
    
    if (numericFields.length >= 3) {
      // We have 3+ numeric fields - ideal for bubble
      xField = numericFields.find(f => f !== '_count') || numericFields[0]
      yField = numericFields.find(f => f !== xField && f !== '_count') || numericFields[1]
      sizeField = numericFields.find(f => f !== xField && f !== yField) || '_count' || numericFields[2]
    } else if (numericFields.length >= 2) {
      // We have at least 2 numeric fields - good for bubble
      xField = numericFields.find(f => f !== '_count') || numericFields[0]
      yField = numericFields.find(f => f !== xField && f !== '_count') || numericFields.find(f => f !== xField) || '_count'
      sizeField = numericFields.includes('_count') ? '_count' : numericFields.find(f => f !== xField && f !== yField) || yField
    } else if (numericFields.length === 1) {
      // Only one numeric field - use count for size
      const categoryField = availableFields.find(f => f !== '_count' && typeof sample[f] !== 'number')
      xField = categoryField || numericFields[0]
      yField = numericFields[0]
      sizeField = numericFields.includes('_count') ? '_count' : numericFields[0]
    } else {
      // Fallback
      console.warn('[BuilderView] Bubble chart needs numeric fields - falling back to first available')
      xField = availableFields[0]
      yField = availableFields[1] || availableFields[0]
      sizeField = availableFields[2] || availableFields[0]
    }
    
    console.debug('[BuilderView] Bubble chart mapped fields:', { xField, yField, sizeField })
    
    console.log('Bubble chart field mapping:', { xField, yField, sizeField, preservedColorField })
    
    // Set required fields
    if (xField) vegaStore.updateConfig('xField', xField)
    if (yField) vegaStore.updateConfig('yField', yField)
    if (sizeField) vegaStore.updateConfig('sizeField', sizeField)
    // Restore user's color selection if it was set
    if (preservedColorField) vegaStore.updateConfig('colorField', preservedColorField)
    return
  }
  
  // Handle Scatter charts similarly
  if (chartType === 'scatter') {
    const numericFields = availableFields.filter(f => typeof sample[f] === 'number')
    
    const xField = numericFields[0] || availableFields[0]
    const yField = numericFields[1] || numericFields[0]
    
    console.log('Scatter chart field mapping:', { xField, yField, preservedColorField })
    
    // Set required fields
    if (xField) vegaStore.updateConfig('xField', xField)
    if (yField) vegaStore.updateConfig('yField', yField)
    // Restore user's color selection if it was set
    if (preservedColorField) vegaStore.updateConfig('colorField', preservedColorField)
    return
  }
  
  // Handle Binned Heatmap charts
  if (chartType === 'binned_heatmap') {
    const numericFields = availableFields.filter(f => typeof sample[f] === 'number')
    
    const xField = numericFields[0]
    const yField = numericFields[1] || numericFields[0]
    
    console.log('Binned Heatmap field mapping:', { xField, yField })
    
    if (xField) vegaStore.updateConfig('xField', xField)
    if (yField) vegaStore.updateConfig('yField', yField)
    return
  }
  
  // Handle Dual Axis charts - fields already set by UnifiedDataPanel
  if (chartType === 'dual_axis') {
    console.log('Dual Axis - keeping fields from UnifiedDataPanel:', { 
      xField: vegaStore.config.xField, 
      yField1: vegaStore.config.yField1, 
      yField2: vegaStore.config.yField2 
    })
    return
  }
  
  // Handle Population Pyramid - fields already set by UnifiedDataPanel
  if (chartType === 'population_pyramid') {
    console.log('Population Pyramid - keeping fields from UnifiedDataPanel:', { 
      categoryField: vegaStore.config.categoryField, 
      valueField: vegaStore.config.valueField, 
      groupField: vegaStore.config.groupField 
    })
    return
  }
  
  // Handle Lasagna Plot - fields already set by UnifiedDataPanel
  if (chartType === 'lasagna') {
    console.log('Lasagna - keeping fields from UnifiedDataPanel:', { 
      xField: vegaStore.config.xField, 
      yField: vegaStore.config.yField, 
      valueField: vegaStore.config.valueField 
    })
    return
  }
  
  // Handle Trellis Area - fields already set by UnifiedDataPanel
  if (chartType === 'trellis_area') {
    console.log('Trellis Area - keeping fields from UnifiedDataPanel:', { 
      xField: vegaStore.config.xField, 
      yField: vegaStore.config.yField, 
      facetField: vegaStore.config.facetField 
    })
    return
  }
  
  // Handle Bullet Chart - fields already set by UnifiedDataPanel
  if (chartType === 'bullet') {
    console.log('Bullet - keeping fields from UnifiedDataPanel:', { 
      titleField: vegaStore.config.titleField, 
      measuresField: vegaStore.config.measuresField, 
      rangesField: vegaStore.config.rangesField 
    })
    return
  }
  
  // Standard X/Y charts
  // Identify bucket field (grouping field for X-axis)
  const bucketField = bucketConfig?.field || availableFields.find(f => 
    f !== '_count' && typeof sample[f] !== 'number'
  )
  
  // Identify metric field (aggregated value for Y-axis)  
  let metricField = null
  if (metricConfig && metricConfig.type !== 'count' && metricConfig.field) {
    const expectedName = `${metricConfig.type}_${metricConfig.field}`
    if (availableFields.includes(expectedName)) {
      metricField = expectedName
    }
  }
  if (!metricField) {
    metricField = availableFields.find(f => f !== bucketField && typeof sample[f] === 'number')
  }
  if (!metricField && availableFields.includes('_count')) {
    metricField = '_count'
  }
  
  // Resolve preserved color field to actual data key (handles sanitized names)
  // e.g., "customer_gender.keyword" -> "customer_gender_keyword"
  let resolvedColorField = null
  if (preservedColorField) {
    const sanitizedColorField = preservedColorField.replace(/\./g, '_')
    if (availableFields.includes(preservedColorField)) {
      resolvedColorField = preservedColorField
    } else if (availableFields.includes(sanitizedColorField)) {
      resolvedColorField = sanitizedColorField
    } else if (availableFields.includes(preservedColorField.replace(/\.keyword$/, ''))) {
      resolvedColorField = preservedColorField.replace(/\.keyword$/, '')
    }
  }
  
  console.log('Standard field mapping:', { bucketField, metricField, preservedColorField, resolvedColorField })
  
  // Reset field configurations to use available fields
  // Preserve user-selected optional fields like colorField
  const fieldMappings = {
    xField: bucketField,
    categoryField: bucketField,
    textField: bucketField,
    yField: metricField,
    valueField: metricField,
    sizeField: null, // Reset optional fields that aren't user-selected
    colorField: resolvedColorField || null // Preserve user's color selection (resolved to data key)
  }
  
  // Update config for each field type
  const schema = vegaStore.configSchema
  for (const field of schema.fields) {
    if (field.type === 'field' && fieldMappings.hasOwnProperty(field.name)) {
      const newValue = fieldMappings[field.name] || ''
      if (newValue) {
        vegaStore.updateConfig(field.name, newValue)
      }
    }
  }
}

function goToStep(step) {
  if (step === 2 && !canProceedToStep2.value) return
  if (step === 3 && !canProceedToStep3.value) return
  currentStep.value = step
}

// Map chart types to icons
const chartIconMap = {
  bar: BarChart3,
  line: LineChart,
  area: Activity,
  pie: PieChart,
  donut: CircleDot,
  scatter: Circle,
  heatmap: Grid3X3,
  histogram: BarChart3,
  treemap: Square,
  gauge: Gauge,
  metric: Hash,
  boxplot: Box,
  wordcloud: Cloud,
  sankey: ArrowRightLeft,
  radial: CircleDot,
  radar: Radar,
  funnel: Filter,
  sparkline: Activity,
  error_bars: GitCommit,
  horizon: Layers,
  circle_packing: Circle,
  streamgraph: Waves,
  density: Mountain,
  marimekko: LayoutGrid,
  bullet: Target,
  rolling_average: TrendingUp,
  dual_axis: LineChart,
  trellis_area: Activity,
  lasagna: Grid3X3,
  comet: GitCommit,
  population_pyramid: BarChart3,
  ternary: PieChart,
  bubble: Circle,
  binned_heatmap: Grid3X3,
  heatlane: BarChart3,
  waterfall: BarChart3
}

function getChartIcon(chartType) {
  return chartIconMap[chartType] || BarChart3
}

onMounted(async () => {
  await elasticStore.checkConnection()
  if (elasticStore.connected) {
    await elasticStore.fetchIndices()
  }
  await vegaStore.fetchVisualizationTypes()
  
  // Check for step query param (e.g., from Library)
  const stepParam = route.query.step
  if (stepParam === '3' && elasticStore.currentIndex && vegaStore.selectedType) {
    currentStep.value = 3
    return
  }
  
  // Check for type query param
  const typeParam = route.query.type
  if (typeParam && vegaStore.visualizationTypes.find(t => t.id === typeParam)) {
    await vegaStore.selectType(typeParam)
    if (elasticStore.currentIndex) {
      currentStep.value = 3
    } else {
      currentStep.value = 2
    }
  } else if (elasticStore.currentIndex) {
    // If an index is already loaded (e.g., coming from Data Explorer), skip to step 2
    currentStep.value = 2
  }
})

// Reset the mapping hash when chart type changes to allow fresh mapping
watch(() => vegaStore.selectedType, (newType, oldType) => {
  if (newType !== oldType) {
    lastMappedDataHash = null
    console.debug(`[BuilderView] Chart type changed from ${oldType} to ${newType}, resetting mapping hash`)
  }
})

// Reset the mapping hash when index changes
watch(() => elasticStore.currentIndex, (newIndex, oldIndex) => {
  if (newIndex !== oldIndex) {
    lastMappedDataHash = null
    console.debug(`[BuilderView] Index changed, resetting mapping hash`)
  }
})

// Auto-generate preview when config changes (debounced to prevent rapid fire)
// This ensures the chart ALWAYS re-renders when user changes any field
watch(() => vegaStore.config, () => {
  if (canGenerate.value && chartData.value.length > 0) {
    debouncedGeneratePreview()
  }
}, { deep: true })

// Also watch for changes in chart data (aggregation results)
// This ensures the chart re-renders when new metrics are selected
// Note: handleAggregatedData already calls generatePreview after field mapping,
// so we should skip triggering here - the event handler will handle the preview
// This watcher is only for changes NOT from aggregation (e.g., direct data manipulation)
watch(chartData, (newData, oldData) => {
  // Don't trigger preview from this watcher - let handleAggregatedData handle it
  // This prevents race conditions where preview generates before field mapping completes
  // The handleAggregatedData function already calls generatePreview after proper field mapping
}, { deep: true })
</script>

<template>
  <div 
    class="builder-layout animate-fade-in"
    :class="{ 'is-resizing': isResizing }"
  >
    <!-- Left Panel: Configuration -->
    <div 
      class="config-panel flex-shrink-0 space-y-6 overflow-visible"
      :style="{ width: `${panelWidth}px` }"
    >
      <!-- Steps -->
      <div class="glass-card p-4">
        <div class="flex items-center justify-between">
          <template v-for="(step, index) in steps" :key="step.id">
            <button
              @click="goToStep(step.id)"
              class="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200"
              :class="[
                currentStep === step.id 
                  ? 'bg-ocean-500/20 text-ocean-300' 
                  : step.id < currentStep 
                    ? 'text-emerald-400 cursor-pointer' 
                    : 'text-slate-500 cursor-not-allowed'
              ]"
            >
              <div 
                class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                :class="[
                  currentStep === step.id 
                    ? 'bg-ocean-500 text-white' 
                    : step.id < currentStep 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-slate-700/50 text-slate-500'
                ]"
              >
                {{ step.id }}
              </div>
              <span class="text-sm font-medium hidden lg:block">{{ step.name }}</span>
            </button>
            <ChevronRight 
              v-if="index < steps.length - 1" 
              class="w-4 h-4 text-slate-600" 
            />
          </template>
        </div>
      </div>

      <!-- Step Content -->
      <Transition name="slide" mode="out-in">
        <DataSourcePanel 
          v-if="currentStep === 1" 
          key="step1"
          @next="currentStep = 2"
        />
        <VisualizationTypePicker 
          v-else-if="currentStep === 2" 
          key="step2"
          @next="currentStep = 3"
        />
        <ConfigurationPanel 
          v-else-if="currentStep === 3" 
          key="step3"
          @data-updated="handleAggregatedData"
          @color-changed="handleColorChanged"
        />
      </Transition>

    </div>

    <!-- Resize Handle -->
    <ResizeHandle 
      :is-resizing="isResizing"
      @mousedown="startResize"
      @touchstart="startResizeTouch"
      class="resize-handle-wrapper"
    />

    <!-- Right Panel: Preview -->
    <div class="preview-panel flex-1 space-y-4 relative">
      <!-- Preview Tabs -->
      <div class="glass-card p-2 flex items-center gap-2">
        <!-- Selected Chart Type Indicator -->
        <div 
          v-if="vegaStore.selectedType"
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-coral-500/20 to-ocean-500/20 border border-coral-500/30"
        >
          <component 
            :is="getChartIcon(vegaStore.selectedType)" 
            class="w-4 h-4 text-coral-400" 
          />
          <span class="text-sm font-medium text-white">
            {{ vegaStore.visualizationTypes.find(t => t.id === vegaStore.selectedType)?.name || vegaStore.selectedType }}
          </span>
        </div>

        <div class="w-px h-6 bg-slate-700/50 mx-1"></div>

        <button
          @click="activeTab = 'preview'"
          class="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200"
          :class="activeTab === 'preview' ? 'bg-ocean-500/20 text-ocean-300' : 'text-slate-400 hover:text-white'"
        >
          <Eye class="w-4 h-4" />
          Preview
        </button>
        <button
          @click="activeTab = 'spec'"
          class="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200"
          :class="activeTab === 'spec' ? 'bg-ocean-500/20 text-ocean-300' : 'text-slate-400 hover:text-white'"
        >
          <Code class="w-4 h-4" />
          Vega Spec
        </button>
        
        <!-- Aggregated Data Indicator (only show when aggregated) -->
        <div class="flex-1 flex items-center justify-center">
          <div 
            v-if="dataSourceInfo.type === 'aggregated'"
            class="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm bg-ocean-500/20 text-ocean-300"
          >
            <Layers class="w-4 h-4" />
            {{ dataSourceInfo.label }} ({{ dataSourceInfo.count }} records)
          </div>
        </div>
        
        <!-- Validation Status Indicator -->
        <div v-if="!canGenerate && vegaStore.selectedType" class="relative group flex items-center">
          <div class="flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-amber-500/20 text-amber-300">
            <AlertCircle class="w-3 h-3" />
            Missing Fields
          </div>
          <!-- Tooltip with details -->
          <div class="absolute bottom-full right-0 mb-2 hidden group-hover:block z-50">
            <div class="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl min-w-[200px]">
              <div class="text-xs font-medium text-slate-300 mb-2">Required fields missing:</div>
              <ul class="text-xs text-amber-300 space-y-1">
                <li v-for="msg in vegaStore.configValidation.messages" :key="msg" class="flex items-center gap-1">
                  <span class="w-1 h-1 bg-amber-400 rounded-full"></span>
                  {{ msg }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Diagnose Button -->
        <button
          v-if="vegaStore.selectedType"
          @click="runDiagnostics"
          :disabled="isValidating"
          class="flex items-center gap-2 px-4 py-1.5 text-sm text-slate-400 hover:text-white border border-slate-600 rounded-lg hover:border-slate-500 transition-colors"
          title="Run full validation diagnostics"
        >
          <Settings2 class="w-4 h-4" :class="{ 'animate-spin': isValidating }" />
          Diagnose
        </button>

        <button
          @click="generatePreview"
          :disabled="!canGenerate || vegaStore.loading.spec"
          class="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          :title="!canGenerate ? 'Missing required fields: ' + vegaStore.configValidation.missing.join(', ') : 'Generate chart'"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': vegaStore.loading.spec }" />
          Refresh
        </button>

      </div>

      <!-- Validation Result Panel (shown when diagnose is run) -->
      <Transition name="fade">
        <div v-if="validationResult" class="mb-4 p-4 rounded-lg border" :class="validationResult.canGenerate ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'">
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-sm font-medium" :class="validationResult.canGenerate ? 'text-green-300' : 'text-red-300'">
              {{ validationResult.canGenerate ? '✓ Ready to Generate' : '✗ Cannot Generate' }}
            </h4>
            <button @click="validationResult = null" class="text-slate-400 hover:text-white text-xs">Dismiss</button>
          </div>
          
          <div v-if="validationResult.errors?.length > 0" class="space-y-1">
            <div v-for="(error, idx) in validationResult.errors" :key="idx" class="text-xs text-red-300">
              • {{ error.message }}
            </div>
          </div>
          
          <div v-if="validationResult.warnings?.length > 0" class="space-y-1 mt-2">
            <div v-for="(warning, idx) in validationResult.warnings" :key="idx" class="text-xs text-amber-300">
              ⚠ {{ warning.message }}
            </div>
          </div>
          
          <div class="mt-2 text-xs text-slate-400">
            <span>Required: {{ validationResult.schema?.requiredFields?.map(f => f.label).join(', ') }}</span>
          </div>
        </div>
      </Transition>

      <!-- Preview/Spec Content -->
      <div 
        class="glass-card p-6 min-h-[600px] bg-slate-900/50"
      >
        <Transition name="fade" mode="out-in">
          <VegaPreview 
            v-if="activeTab === 'preview'" 
            key="preview"
            :spec="vegaStore.generatedSpec"
            :height="550"
          />
          <SpecEditor 
            v-else 
            key="spec"
            :spec="vegaStore.generatedSpec"
          />
        </Transition>
        
        <!-- TODO: Re-enable when ChartAlternatives feature is complete -->
        <!-- <ChartAlternatives 
          v-if="activeTab === 'preview' && vegaStore.selectedType"
          @change="generatePreview"
        /> -->
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Layout */
.builder-layout {
  @apply flex gap-4;
}

.builder-layout.is-resizing {
  @apply select-none;
}

.builder-layout.is-resizing * {
  pointer-events: none;
}

.builder-layout.is-resizing .resize-handle-wrapper {
  pointer-events: auto;
}

.config-panel {
  min-width: 320px;
  max-width: 550px;
}

.resize-handle-wrapper {
  @apply hidden md:flex;
}

.preview-panel {
  min-width: 400px;
}

/* Transitions */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .builder-layout {
    @apply flex-col gap-4;
  }
  
  .config-panel {
    width: 100% !important;
    max-width: 100%;
  }
  
  .preview-panel {
    min-width: 100%;
  }
}
</style>
