<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { 
  ChevronLeft, 
  ChevronRight, 
  Shuffle, 
  History, 
  ArrowLeft,
  ArrowRight
} from 'lucide-vue-next'
import { useVegaStore } from '@/stores/vega'
import { useElasticStore } from '@/stores/elastic'
import VegaMiniPreview from './VegaMiniPreview.vue'

const emit = defineEmits(['change'])

const vegaStore = useVegaStore()
const elasticStore = useElasticStore()

// ============================================
// SEMANTIC FIELD MAPPING (bidirectional)
// ============================================

// All field keys that represent a "category/x-axis" concept
const CATEGORY_FIELDS = ['xField', 'categoryField', 'textField', 'stageField', 'axisField', 'labelField']

// All field keys that represent a "value/y-axis" concept  
const VALUE_FIELDS = ['yField', 'valueField', 'sizeField', 'metricField']

// All field keys that represent grouping/color
const GROUP_FIELDS = ['colorField', 'seriesField', 'groupField']

// Flow chart fields
const SOURCE_FIELDS = ['sourceField', 'fromField']
const TARGET_FIELDS = ['targetField', 'toField']

// ============================================
// HISTORY MANAGEMENT
// ============================================

const chartHistory = ref([])
const historyIndex = ref(-1)
const isNavigating = ref(false)

// Get current mapped fields as a simple object
function getCurrentFieldValues() {
  const fieldValues = {}
  const config = vegaStore.config
  const schema = vegaStore.configSchema
  
  if (schema?.fields) {
    for (const field of schema.fields) {
      // Use field.name (not field.key) - this is how vega store accesses config
      const fieldName = field.name || field.key
      const value = config[fieldName]
      if (value) {
        fieldValues[fieldName] = value
      }
    }
  }
  
  return fieldValues
}

function saveToHistory() {
  if (isNavigating.value) return
  
  const fieldValues = getCurrentFieldValues()
  
  // Don't save if no fields are mapped
  if (Object.keys(fieldValues).length === 0) return
  
  const snapshot = {
    chartType: vegaStore.selectedType,
    fieldValues: { ...fieldValues },
    timestamp: Date.now()
  }
  
  // Check if current chart matches the entry at historyIndex
  const currentEntry = chartHistory.value[historyIndex.value]
  if (currentEntry?.chartType === snapshot.chartType) {
    // Just update the field values, don't truncate or add new entry
    currentEntry.fieldValues = snapshot.fieldValues
    return
  }
  
  // Check if we're adding a new chart type (not navigating back)
  const lastEntry = chartHistory.value[chartHistory.value.length - 1]
  if (lastEntry?.chartType === snapshot.chartType) {
    // Update existing last entry's field values
    lastEntry.fieldValues = snapshot.fieldValues
    return
  }
  
  // Only truncate forward history if we're truly adding a new different chart
  if (historyIndex.value < chartHistory.value.length - 1) {
    chartHistory.value = chartHistory.value.slice(0, historyIndex.value + 1)
  }
  
  chartHistory.value.push(snapshot)
  historyIndex.value = chartHistory.value.length - 1
  
  if (chartHistory.value.length > 15) {
    chartHistory.value.shift()
    historyIndex.value--
  }
}

function goToHistoryEntry(index) {
  if (index < 0 || index >= chartHistory.value.length) return
  
  isNavigating.value = true
  const entry = chartHistory.value[index]
  
  // Track if we've handled the restoration
  let handled = false
  
  // Function to check if schema matches target chart type
  function isSchemaForHistoryChart(schema, targetChartType) {
    if (!schema?.fields) return false
    
    const schemaFieldNames = schema.fields.map(f => f.name || f.key)
    
    // Use UNIQUE distinguishing fields that only exist in specific chart types
    const chartSignatures = {
      bar: { required: ['xField', 'yField'], excluded: ['categoryField', 'sourceField'] },
      line: { required: ['xField', 'yField'], excluded: ['categoryField', 'sourceField'] },
      area: { required: ['xField', 'yField'], excluded: ['categoryField', 'sourceField'] },
      scatter: { required: ['xField', 'yField'], excluded: ['categoryField', 'sourceField'] },
      pie: { required: ['categoryField', 'valueField', 'sortSlices'], excluded: ['xField', 'innerRadius', 'stageField'] },
      donut: { required: ['categoryField', 'valueField', 'innerRadius', 'centerText'], excluded: ['xField'] },
      funnel: { required: ['stageField', 'stageGap'], excluded: ['xField', 'sourceField', 'innerRadius'] },
      treemap: { required: ['categoryField', 'valueField', 'treemapLayout'], excluded: ['xField', 'stageField'] },
      radial: { required: ['categoryField', 'valueField', 'innerRadius', 'padAngle'], excluded: ['xField', 'centerText', 'treemapLayout'] },
      waterfall: { required: ['showTotal', 'showConnectors'], excluded: ['xField', 'innerRadius'] },
      sankey: { required: ['sourceField', 'targetField'], excluded: ['xField', 'categoryField'] },
      chord: { required: ['sourceField', 'targetField', 'chordOpacity'], excluded: ['xField', 'categoryField'] },
      heatmap: { required: ['xField', 'yField', 'valueField'], excluded: ['categoryField'] },
      bubble: { required: ['xField', 'yField', 'sizeField'], excluded: ['categoryField'] },
      gauge: { required: ['valueField'], excluded: ['xField', 'categoryField', 'sourceField', 'stageField'] },
      bullet: { required: ['titleField', 'measuresField', 'rangesField'], excluded: ['xField', 'categoryField'] },
      comet: { required: ['categoryField', 'timeField', 'valueField', 'trailSizeMin'], excluded: ['xField'] },
      radar: { required: ['keyField', 'valueField', 'fillOpacity', 'strokeWidth'], excluded: ['xField', 'innerRadius'] },
      pareto: { required: ['categoryField', 'valueField', 'show80Line', 'showLine'], excluded: ['xField', 'stageField'] },
    }
    
    const signature = chartSignatures[targetChartType]
    
    if (signature) {
      const hasAllRequired = signature.required.every(f => schemaFieldNames.includes(f))
      const hasNoExcluded = signature.excluded.every(f => !schemaFieldNames.includes(f))
      return hasAllRequired && hasNoExcluded
    }
    
    return vegaStore.selectedType === targetChartType
  }
  
  // Function to restore fields
  function restoreFields(schema) {
    if (handled) return
    
    // Verify schema is for the correct chart type
    if (!isSchemaForHistoryChart(schema, entry.chartType)) {
      return
    }
    
    handled = true
    
    // Restore each field value
    Object.entries(entry.fieldValues).forEach(([key, value]) => {
      vegaStore.updateConfig(key, value)
    })
    
    historyIndex.value = index
    emit('change', entry.chartType)
    
    // Keep isNavigating true longer to prevent watch from saving stale state
    setTimeout(() => {
      isNavigating.value = false
    }, 600)
  }
  
  // First, switch chart type
  vegaStore.selectType(entry.chartType)
  
  // Watch for schema changes - primary mechanism
  const unwatch = watch(
    () => vegaStore.configSchema,
    (newSchema) => {
      if (!handled && newSchema?.fields) {
        restoreFields(newSchema)
        if (handled) unwatch()
      }
    },
    { immediate: true }
  )
  
  // Timeout fallback
  setTimeout(() => {
    unwatch()
    if (!handled) {
      isNavigating.value = false
    }
  }, 2000)
}

function goBack() {
  if (canGoBack.value) goToHistoryEntry(historyIndex.value - 1)
}

function goForward() {
  if (canGoForward.value) goToHistoryEntry(historyIndex.value + 1)
}

const canGoBack = computed(() => historyIndex.value > 0)
const canGoForward = computed(() => historyIndex.value < chartHistory.value.length - 1)

function getChartName(chartType) {
  return vegaStore.visualizationTypes?.find(t => t.id === chartType)?.name || chartType
}

// ============================================
// CHECK IF FIELDS ARE MAPPED
// ============================================

const hasMappedFields = computed(() => {
  const config = vegaStore.config
  const schema = vegaStore.configSchema
  
  if (!schema?.fields) return false
  
  // Check if at least one required field is mapped
  for (const field of schema.fields) {
    const fieldName = field.name || field.key
    if (field.required && config[fieldName]) {
      return true
    }
  }
  
  // Also check common field names
  const commonNames = ['xField', 'yField', 'categoryField', 'valueField', 'textField']
  for (const name of commonNames) {
    if (config[name]) return true
  }
  
  return false
})

// ============================================
// CAROUSEL STATE
// ============================================

const currentIndex = ref(0)
const currentType = computed(() => vegaStore.selectedType)

// ============================================
// CHART SUGGESTIONS
// ============================================

const CHART_GROUPS = {
  categoryValue: ['bar', 'pie', 'donut', 'treemap', 'radial', 'funnel', 'waterfall', 'pareto'],
  timeSeries: ['line', 'area', 'streamgraph', 'horizon', 'rolling_average'],
  distribution: ['histogram', 'boxplot', 'density'],
  matrix: ['heatmap', 'sankey', 'chord'],
  correlation: ['scatter', 'bubble'],
  kpi: ['metric', 'gauge', 'bullet'],
  categoryOnly: ['wordcloud', 'radar']
}

const compatibleCharts = computed(() => {
  if (!currentType.value) return []
  if (!hasMappedFields.value) return [] // Don't show until fields are mapped
  
  const allTypes = vegaStore.visualizationTypes || []
  if (!allTypes.length) return []
  
  const currentChartCategory = allTypes.find(t => t.id === currentType.value)?.category
  const suggestions = []
  
  // Get charts from same category first
  const sameCategory = allTypes
    .filter(t => t.id !== currentType.value && t.category === currentChartCategory)
    .slice(0, 4)
  
  for (const chart of sameCategory) {
    suggestions.push({
      ...chart,
      matchReason: 'Same category'
    })
  }
  
  // Add from related groups based on current chart category
  const seen = new Set([currentType.value, ...sameCategory.map(c => c.id)])
  let relevantGroups = []
  
  if (currentChartCategory === 'Comparison') {
    relevantGroups = ['categoryValue', 'distribution']
  } else if (currentChartCategory === 'Trends') {
    relevantGroups = ['timeSeries', 'categoryValue']
  } else if (currentChartCategory === 'Composition') {
    relevantGroups = ['categoryValue']
  } else if (currentChartCategory === 'Distribution') {
    relevantGroups = ['distribution', 'correlation']
  } else if (currentChartCategory === 'Flow') {
    relevantGroups = ['matrix', 'categoryValue']
  } else {
    relevantGroups = ['categoryValue', 'timeSeries']
  }
  
  for (const group of relevantGroups) {
    const charts = CHART_GROUPS[group] || []
    for (const chartId of charts) {
      if (seen.has(chartId)) continue
      seen.add(chartId)
      
      const chartInfo = allTypes.find(t => t.id === chartId)
      if (chartInfo) {
        suggestions.push({
          ...chartInfo,
          matchReason: getGroupReason(group)
        })
      }
    }
  }
  
  return suggestions.slice(0, 8)
})

function getGroupReason(group) {
  const reasons = {
    categoryValue: 'Compare categories',
    timeSeries: 'Show trends',
    distribution: 'Analyze distribution',
    matrix: 'Show relationships',
    correlation: 'Find correlations',
    kpi: 'Highlight value',
    categoryOnly: 'Visualize categories'
  }
  return reasons[group] || 'Alternative view'
}

// ============================================
// FIELD TRANSFER LOGIC
// ============================================

function findFieldValue(sourceFields, fieldValues) {
  for (const key of sourceFields) {
    if (fieldValues[key]) return fieldValues[key]
  }
  return null
}

function switchToChart(chartType) {
  // Save current state first
  saveToHistory()
  
  // Get current field values before switching
  const currentFieldValues = getCurrentFieldValues()
  
  // Extract semantic values BEFORE switching chart type
  const categoryValue = findFieldValue(CATEGORY_FIELDS, currentFieldValues)
  const valueFieldValue = findFieldValue(VALUE_FIELDS, currentFieldValues)
  const groupValue = findFieldValue(GROUP_FIELDS, currentFieldValues)
  const sourceValue = findFieldValue(SOURCE_FIELDS, currentFieldValues)
  const targetValue = findFieldValue(TARGET_FIELDS, currentFieldValues)
  
  // Switch chart type - this triggers async schema fetch
  vegaStore.selectType(chartType.id)
  
  // Track if we've handled the schema
  let handled = false
  
  // Function to check if schema matches target chart type
  function isSchemaForChart(schema, targetChartId) {
    if (!schema?.fields) return false
    
    const schemaFieldNames = schema.fields.map(f => f.name || f.key)
    
    // Use UNIQUE distinguishing fields that only exist in specific chart types
    // Format: { required: fields that MUST exist, excluded: fields that MUST NOT exist }
    const chartSignatures = {
      // X/Y charts have xField, NOT categoryField
      bar: { required: ['xField', 'yField'], excluded: ['categoryField', 'sourceField'] },
      line: { required: ['xField', 'yField'], excluded: ['categoryField', 'sourceField'] },
      area: { required: ['xField', 'yField'], excluded: ['categoryField', 'sourceField'] },
      scatter: { required: ['xField', 'yField'], excluded: ['categoryField', 'sourceField'] },
      
      // Pie-family charts have categoryField, NOT xField
      pie: { required: ['categoryField', 'valueField', 'sortSlices'], excluded: ['xField', 'innerRadius', 'stageField'] },
      donut: { required: ['categoryField', 'valueField', 'innerRadius', 'centerText'], excluded: ['xField'] },
      
      // Funnel has stageField - unique identifier
      funnel: { required: ['stageField', 'stageGap'], excluded: ['xField', 'sourceField', 'innerRadius'] },
      
      // Treemap has treemapLayout - unique identifier
      treemap: { required: ['categoryField', 'valueField', 'treemapLayout'], excluded: ['xField', 'stageField'] },
      
      // Radial has innerRadius + padAngle, no centerText (unlike donut)
      radial: { required: ['categoryField', 'valueField', 'innerRadius', 'padAngle'], excluded: ['xField', 'centerText', 'treemapLayout'] },
      
      // Waterfall has showTotal/showConnectors - unique to waterfall
      waterfall: { required: ['showTotal', 'showConnectors'], excluded: ['xField', 'innerRadius'] },
      
      // Flow charts have sourceField/targetField
      sankey: { required: ['sourceField', 'targetField'], excluded: ['xField', 'categoryField'] },
      chord: { required: ['sourceField', 'targetField', 'chordOpacity'], excluded: ['xField', 'categoryField'] },
      
      // Heatmap has all three: xField, yField, valueField
      heatmap: { required: ['xField', 'yField', 'valueField'], excluded: ['categoryField'] },
      
      // Bubble has sizeField
      bubble: { required: ['xField', 'yField', 'sizeField'], excluded: ['categoryField'] },
      
      // Gauge has specific gauge fields
      gauge: { required: ['valueField'], excluded: ['xField', 'categoryField', 'sourceField', 'stageField'] },
      
      // Bullet has titleField, measuresField, rangesField - unique identifiers
      bullet: { required: ['titleField', 'measuresField', 'rangesField'], excluded: ['xField', 'categoryField'] },
      
      // Comet has timeField + trailSizeMin/Max - unique
      comet: { required: ['categoryField', 'timeField', 'valueField', 'trailSizeMin'], excluded: ['xField'] },
      
      // Radar has keyField + fillOpacity + strokeWidth - unique combination
      radar: { required: ['keyField', 'valueField', 'fillOpacity', 'strokeWidth'], excluded: ['xField', 'innerRadius'] },
      
      // Pareto has show80Line - unique identifier
      pareto: { required: ['categoryField', 'valueField', 'show80Line', 'showLine'], excluded: ['xField', 'stageField'] },
    }
    
    const signature = chartSignatures[targetChartId]
    
    if (signature) {
      // Check ALL required fields exist
      const hasAllRequired = signature.required.every(f => schemaFieldNames.includes(f))
      // Check NONE of the excluded fields exist
      const hasNoExcluded = signature.excluded.every(f => !schemaFieldNames.includes(f))
      
      return hasAllRequired && hasNoExcluded
    }
    
    // For unknown charts, assume schema is correct if selectedType matches
    return vegaStore.selectedType === targetChartId
  }

  // Function to apply field mappings
  function applyFieldMappings(schema) {
    if (handled || !schema?.fields) return
    
    // CRITICAL: Verify schema is for the TARGET chart, not the previous chart
    if (!isSchemaForChart(schema, chartType.id)) {
      return // Don't apply - wait for correct schema
    }
    
    handled = true
    
    // Map fields to new chart
    for (const field of schema.fields) {
      const fieldName = field.name || field.key
      let valueToSet = null
      
      // Check which semantic group this field belongs to
      // Include fallback logic: sourceValue can be used for categoryField if no direct category exists
      if (CATEGORY_FIELDS.includes(fieldName)) {
        // Priority: categoryValue > sourceValue (flow charts' source is a category)
        valueToSet = categoryValue || sourceValue
      } else if (VALUE_FIELDS.includes(fieldName) && valueFieldValue) {
        valueToSet = valueFieldValue
      } else if (GROUP_FIELDS.includes(fieldName)) {
        // Priority: groupValue > targetValue (flow charts' target can be a grouping)
        valueToSet = groupValue || targetValue
      } else if (SOURCE_FIELDS.includes(fieldName)) {
        // Priority: sourceValue > categoryValue (for flow charts from category charts)
        valueToSet = sourceValue || categoryValue
      } else if (TARGET_FIELDS.includes(fieldName)) {
        // Priority: targetValue > groupValue (for flow charts from grouped charts)
        valueToSet = targetValue || groupValue
      }
      
      if (valueToSet) {
        vegaStore.updateConfig(fieldName, valueToSet)
      }
    }
    
    // Save new state after mapping
    setTimeout(() => saveToHistory(), 150)
    emit('change', chartType.id)
  }
  
  // Watch for schema changes - this is the primary mechanism
  let unwatchFn = null
  unwatchFn = watch(
    () => vegaStore.configSchema,
    (newSchema) => {
      if (!handled && newSchema?.fields) {
        applyFieldMappings(newSchema)
        // Only unwatch if we successfully applied (use nextTick to avoid accessing before init)
        if (handled && unwatchFn) {
          nextTick(() => unwatchFn?.())
        }
      }
    },
    { immediate: true } // Check immediately in case schema is already loaded
  )
  
  // Timeout fallback
  setTimeout(() => {
    if (unwatchFn) unwatchFn()
    if (!handled) {
      console.warn('[ChartAlternatives] Schema timeout - applying with current schema')
      // Last resort: apply with whatever schema we have
      if (vegaStore.configSchema?.fields) {
        handled = true // Force handled to prevent further attempts
        applyFieldMappings(vegaStore.configSchema)
      }
    }
  }, 2000)
}

// Navigation
function navigate(direction) {
  const len = compatibleCharts.value.length
  if (len === 0) return
  
  if (direction === 'left') {
    currentIndex.value = (currentIndex.value - 1 + len) % len
  } else {
    currentIndex.value = (currentIndex.value + 1) % len
  }
}

const visibleCharts = computed(() => compatibleCharts.value)

// Watch for changes to save to history
watch([currentType, () => vegaStore.config], () => {
  if (!isNavigating.value && hasMappedFields.value) {
    // Debounce history saves
    setTimeout(() => {
      if (!isNavigating.value) saveToHistory()
    }, 500)
  }
  currentIndex.value = 0
}, { deep: true })
</script>

<template>
  <div v-if="compatibleCharts.length > 0 || chartHistory.length > 1" class="chart-alternatives">
    <!-- History Navigation -->
    <div v-if="chartHistory.length > 1" class="history-bar mb-3 flex items-center gap-2">
      <div class="flex items-center gap-1">
        <button
          @click="goBack"
          :disabled="!canGoBack"
          class="p-1.5 rounded-lg transition-all duration-200"
          :class="canGoBack 
            ? 'bg-slate-800/50 hover:bg-ocean-500/20 text-slate-300 hover:text-ocean-300' 
            : 'bg-slate-800/20 text-slate-600 cursor-not-allowed'"
          title="Go back"
        >
          <ArrowLeft class="w-4 h-4" />
        </button>
        <button
          @click="goForward"
          :disabled="!canGoForward"
          class="p-1.5 rounded-lg transition-all duration-200"
          :class="canGoForward 
            ? 'bg-slate-800/50 hover:bg-ocean-500/20 text-slate-300 hover:text-ocean-300' 
            : 'bg-slate-800/20 text-slate-600 cursor-not-allowed'"
          title="Go forward"
        >
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>
      
      <!-- History breadcrumb -->
      <div class="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1">
        <History class="w-3 h-3 text-slate-500 flex-shrink-0" />
        <button
          v-for="(entry, idx) in chartHistory"
          :key="entry.timestamp"
          @click="goToHistoryEntry(idx)"
          class="px-2 py-0.5 rounded text-[10px] font-medium transition-all whitespace-nowrap"
          :class="idx === historyIndex
            ? 'bg-ocean-500/30 text-ocean-300 border border-ocean-500/50' 
            : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white border border-transparent'"
        >
          {{ getChartName(entry.chartType) }}
        </button>
      </div>
    </div>

    <!-- Alternatives -->
    <div v-if="compatibleCharts.length > 0">
      <div class="flex items-center gap-2 text-xs text-slate-400 mb-2">
        <Shuffle class="w-3.5 h-3.5" />
        <span>Try alternatives</span>
      </div>
      
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="chart in visibleCharts"
          :key="chart.id"
          @click="switchToChart(chart)"
          class="alternative-card group flex-shrink-0 w-14 rounded-lg border border-slate-700/50 
                 bg-slate-800/30 hover:bg-slate-700/50 hover:border-ocean-500/50 
                 transition-all duration-200 overflow-hidden"
          :title="chart.matchReason"
        >
          <div class="aspect-square p-1 bg-slate-900/50">
            <VegaMiniPreview 
              :chart-type="chart.id" 
              :width="48" 
              :height="48"
              :use-live="false"
              class="w-full h-full"
            />
          </div>
          <div class="px-1 py-0.5 text-center">
            <span class="text-[9px] text-slate-400 group-hover:text-white truncate block leading-tight">
              {{ chart.name }}
            </span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-alternatives {
  padding-top: 0.75rem;
  border-top: 1px solid rgb(51 65 85 / 0.3);
}

.alternative-card:hover {
  transform: translateY(-1px);
}

.history-bar {
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgb(51 65 85 / 0.2);
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
