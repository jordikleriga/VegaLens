<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAggregationStore } from '@/stores/aggregation'
import { useElasticStore } from '@/stores/elastic'
import { 
  Layers, 
  Plus, 
  Trash2, 
  ChevronDown, 
  Calculator,
  Calendar,
  Hash,
  Type,
  ToggleLeft,
  MapPin,
  Box,
  Play,
  Eye,
  RotateCcw,
  Search,
  X,
  AlertTriangle,
  Check,
  ArrowRight,
  BarChart3
} from 'lucide-vue-next'

const emit = defineEmits(['data-updated'])

const aggregationStore = useAggregationStore()
const elasticStore = useElasticStore()

// UI State
const showPreview = ref(false)
const queryPreview = ref(null)
const aggError = ref(null)
const fieldSearch = ref('')
const showFieldPicker = ref(false)
const showMetricFieldPicker = ref(false)
const metricFieldSearch = ref('')

// Get icon for field type
function getFieldIcon(field) {
  const icons = {
    number: Hash,
    string: Type,
    date: Calendar,
    geo: MapPin,
    boolean: ToggleLeft,
    other: Box
  }
  return icons[field.category] || Box
}

// Get field type color
function getFieldTypeColor(field) {
  const colors = {
    number: 'text-blue-400',
    string: 'text-emerald-400',
    date: 'text-amber-400',
    geo: 'text-purple-400',
    boolean: 'text-pink-400',
    other: 'text-slate-400'
  }
  return colors[field.category] || 'text-slate-400'
}

// Bucket (X-axis) compatible fields
const bucketFields = computed(() => {
  let fields = elasticStore.aggregatableFields
  
  if (fieldSearch.value) {
    const search = fieldSearch.value.toLowerCase()
    fields = fields.filter(f => f.name.toLowerCase().includes(search))
  }
  
  return fields
})

// Metric (Y-axis) compatible fields - numeric only
const metricFields = computed(() => {
  let fields = elasticStore.aggregatableNumericFields
  
  if (metricFieldSearch.value) {
    const search = metricFieldSearch.value.toLowerCase()
    fields = fields.filter(f => f.name.toLowerCase().includes(search))
  }
  
  return fields
})

// Selected bucket field info
const selectedBucketField = computed(() => {
  const fieldName = aggregationStore.currentConfig.bucketAgg?.field
  if (!fieldName) return null
  return elasticStore.fields.find(f => f.name === fieldName)
})

// Primary metric info (the main Y-axis metric)
const primaryMetric = computed(() => {
  const metrics = aggregationStore.currentConfig.metrics || []
  return metrics[0] || null
})

// Selected metric field info
const selectedMetricField = computed(() => {
  if (!primaryMetric.value?.field) return null
  return elasticStore.fields.find(f => f.name === primaryMetric.value.field)
})

// Metric type options
const metricTypes = [
  { id: 'count', name: 'Count', description: 'Number of documents', needsField: false },
  { id: 'sum', name: 'Sum', description: 'Total of values', needsField: true },
  { id: 'avg', name: 'Average', description: 'Mean value', needsField: true },
  { id: 'median', name: 'Median', description: 'Middle value', needsField: true },
  { id: 'min', name: 'Minimum', description: 'Lowest value', needsField: true },
  { id: 'max', name: 'Maximum', description: 'Highest value', needsField: true },
  { id: 'cardinality', name: 'Unique Count', description: 'Distinct values', needsField: true }
]

// Current metric type info
const currentMetricType = computed(() => {
  const typeId = primaryMetric.value?.type || 'count'
  return metricTypes.find(t => t.id === typeId) || metricTypes[0]
})

// Whether the current configuration is ready to run
const canRun = computed(() => {
  const bucket = aggregationStore.currentConfig.bucketAgg
  const metric = primaryMetric.value
  
  if (!bucket?.field) return false
  
  // If metric needs a field, check it's set
  if (metric && currentMetricType.value?.needsField && !metric.field) {
    return false
  }
  
  return true
})

// Summary of current configuration
const configSummary = computed(() => {
  const bucket = aggregationStore.currentConfig.bucketAgg
  const metric = primaryMetric.value
  
  if (!bucket?.field) return null
  
  const bucketName = bucket.field.split('.').pop()
  const metricName = metric?.type === 'count' 
    ? 'Count' 
    : `${currentMetricType.value?.name || 'Value'} of ${metric?.field?.split('.').pop() || '?'}`
  
  return {
    x: bucketName,
    y: metricName
  }
})

// Handlers
function selectBucketField(field) {
  // Determine bucket type based on field
  let type = 'terms'
  if (field.category === 'date') {
    type = 'date_histogram'
  } else if (field.category === 'number') {
    type = 'histogram'
  }
  
  aggregationStore.setBucketAggregation({
    type,
    field: field.name,
    options: getDefaultOptions(type)
  })
  
  showFieldPicker.value = false
  fieldSearch.value = ''
  
  // If no metric is set, default to count
  if (!primaryMetric.value) {
    aggregationStore.addMetric({ type: 'count', field: '', alias: '' })
  }
}

function selectMetricType(type) {
  const metric = primaryMetric.value || { type: 'count', field: '', alias: '' }
  
  if (aggregationStore.currentConfig.metrics.length === 0) {
    aggregationStore.addMetric({ type: type.id, field: '', alias: '' })
  } else {
    aggregationStore.updateMetric(0, { 
      ...metric, 
      type: type.id,
      field: type.needsField ? metric.field : ''
    })
  }
}

function selectMetricField(field) {
  const metric = primaryMetric.value || { type: 'avg', field: '', alias: '' }
  
  if (aggregationStore.currentConfig.metrics.length === 0) {
    aggregationStore.addMetric({ type: 'avg', field: field.name, alias: '' })
  } else {
    aggregationStore.updateMetric(0, { ...metric, field: field.name })
  }
  
  showMetricFieldPicker.value = false
  metricFieldSearch.value = ''
}

function getDefaultOptions(type) {
  switch (type) {
    case 'terms':
      return { size: 25, order: 'desc' }
    case 'date_histogram':
      return { interval: 'auto', format: 'yyyy-MM-dd', min_doc_count: 0 }
    case 'histogram':
      return { interval: 10, min_doc_count: 0 }
    default:
      return {}
  }
}

function updateBucketOption(key, value) {
  aggregationStore.setBucketAggregation({
    ...aggregationStore.currentConfig.bucketAgg,
    options: {
      ...aggregationStore.currentConfig.bucketAgg?.options,
      [key]: value
    }
  })
}

// Execute aggregation
async function executeAggregation() {
  if (!elasticStore.currentIndex || !canRun.value) return
  
  aggError.value = null
  
  try {
    const result = await aggregationStore.executeAggregation(elasticStore.currentIndex)
    emit('data-updated', result.data)
    // Note: Auto-mapping of fields is now handled in BuilderView.vue
  } catch (err) {
    console.error('Aggregation failed:', err)
    aggError.value = err.response?.data?.message || err.message || 'Aggregation failed'
    if (err.response?.data?.suggestion) {
      aggError.value += ` ${err.response.data.suggestion}`
    }
  }
}


// Show query preview
async function showQueryPreview() {
  if (!elasticStore.currentIndex) return
  
  try {
    queryPreview.value = await aggregationStore.previewQuery(elasticStore.currentIndex)
    showPreview.value = true
  } catch (err) {
    console.error('Preview failed:', err)
  }
}

// Reset all aggregation settings
function resetAggregation() {
  aggregationStore.reset()
  aggError.value = null
  fieldSearch.value = ''
  metricFieldSearch.value = ''
  emit('data-updated', [])
}

// Refresh fields from Elasticsearch
async function refreshFields() {
  if (elasticStore.currentIndex) {
    await elasticStore.fetchMapping(elasticStore.currentIndex)
  }
}

onMounted(() => {
  aggregationStore.fetchAggregationTypes()
  aggregationStore.fetchDateIntervals()
})

// Close pickers when clicking outside
function closeFieldPicker(e) {
  if (!e.target.closest('.field-picker-container')) {
    showFieldPicker.value = false
  }
  if (!e.target.closest('.metric-field-picker-container')) {
    showMetricFieldPicker.value = false
  }
}
</script>

<template>
  <div class="space-y-6" @click="closeFieldPicker">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <BarChart3 class="w-5 h-5 text-ocean-400" />
        <span class="font-medium text-white">Build Aggregation</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="refreshFields"
          class="p-1.5 text-slate-400 hover:text-ocean-400 transition-colors"
          title="Refresh fields"
        >
          <RotateCcw class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="aggregationStore.currentConfig.bucketAgg?.field"
          @click="resetAggregation"
          class="flex items-center gap-1 text-xs text-slate-400 hover:text-coral-400 transition-colors"
        >
          <X class="w-3 h-3" />
          Reset
        </button>
      </div>
    </div>

    <!-- X-Axis (Bucket) Selection -->
    <div class="space-y-3">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400">X</div>
        <span class="text-sm font-medium text-white">Group By (Categories)</span>
      </div>
      
      <div class="field-picker-container relative">
        <button
          @click.stop="showFieldPicker = !showFieldPicker"
          :class="[
            'w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left',
            selectedBucketField
              ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
              : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:border-slate-600'
          ]"
        >
          <div class="flex items-center gap-2">
            <component 
              v-if="selectedBucketField" 
              :is="getFieldIcon(selectedBucketField)" 
              :class="['w-4 h-4', getFieldTypeColor(selectedBucketField)]" 
            />
            <Layers v-else class="w-4 h-4 text-slate-500" />
            <span>{{ selectedBucketField?.name || 'Select a field to group by...' }}</span>
          </div>
          <ChevronDown :class="['w-4 h-4 transition-transform', showFieldPicker ? 'rotate-180' : '']" />
        </button>

        <!-- Field Picker Dropdown -->
        <div 
          v-if="showFieldPicker"
          class="absolute z-50 mt-2 w-full max-h-80 overflow-hidden bg-slate-800 border border-slate-700 rounded-xl shadow-xl"
          @click.stop
        >
          <div class="p-2 border-b border-slate-700">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                v-model="fieldSearch"
                type="text"
                placeholder="Search fields..."
                class="w-full pl-9 pr-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-ocean-500"
              />
            </div>
          </div>
          <div class="max-h-60 overflow-y-auto p-2">
            <div v-if="bucketFields.length === 0" class="p-4 text-center text-sm text-slate-500">
              No aggregatable fields found
            </div>
            <button
              v-for="field in bucketFields"
              :key="field.name"
              @click="selectBucketField(field)"
              :class="[
                'w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors',
                selectedBucketField?.name === field.name
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'hover:bg-slate-700/50 text-slate-300'
              ]"
            >
              <component :is="getFieldIcon(field)" :class="['w-4 h-4', getFieldTypeColor(field)]" />
              <div class="flex-1 min-w-0">
                <div class="text-sm truncate">{{ field.name }}</div>
                <div class="text-xs text-slate-500">{{ field.type }}</div>
              </div>
              <Check v-if="selectedBucketField?.name === field.name" class="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </div>
      </div>

      <!-- Bucket options -->
      <div 
        v-if="aggregationStore.currentConfig.bucketAgg?.type === 'terms'"
        class="flex gap-3 pl-8"
      >
        <div class="flex-1">
          <label class="form-label text-xs">Top N</label>
          <input
            type="number"
            :value="aggregationStore.currentConfig.bucketAgg?.options?.size || 25"
            @input="updateBucketOption('size', parseInt($event.target.value))"
            min="1"
            max="10000"
            class="form-input py-1.5 text-sm"
          />
        </div>
        <div class="flex-1">
          <label class="form-label text-xs">Order</label>
          <select
            :value="aggregationStore.currentConfig.bucketAgg?.options?.order || 'desc'"
            @change="updateBucketOption('order', $event.target.value)"
            class="form-select py-1.5 text-sm"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Arrow -->
    <div class="flex justify-center">
      <ArrowRight class="w-5 h-5 text-slate-600 rotate-90" />
    </div>

    <!-- Y-Axis (Metric) Selection -->
    <div class="space-y-3">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">Y</div>
        <span class="text-sm font-medium text-white">Measure (Value)</span>
      </div>

      <!-- Metric Type -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="type in metricTypes"
          :key="type.id"
          @click="selectMetricType(type)"
          :class="[
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
            primaryMetric?.type === type.id || (!primaryMetric && type.id === 'count')
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/60 border border-transparent'
          ]"
        >
          {{ type.name }}
        </button>
      </div>

      <!-- Metric Field (if needed) -->
      <div 
        v-if="currentMetricType.needsField"
        class="metric-field-picker-container relative"
      >
        <label class="form-label text-xs">Field to {{ currentMetricType.name.toLowerCase() }}</label>
        <button
          @click.stop="showMetricFieldPicker = !showMetricFieldPicker"
          :class="[
            'w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left',
            selectedMetricField
              ? 'bg-blue-500/10 border-blue-500/30 text-white'
              : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:border-slate-600'
          ]"
        >
          <div class="flex items-center gap-2">
            <component 
              v-if="selectedMetricField" 
              :is="getFieldIcon(selectedMetricField)" 
              :class="['w-4 h-4', getFieldTypeColor(selectedMetricField)]" 
            />
            <Hash v-else class="w-4 h-4 text-slate-500" />
            <span>{{ selectedMetricField?.name || 'Select a numeric field...' }}</span>
          </div>
          <ChevronDown :class="['w-4 h-4 transition-transform', showMetricFieldPicker ? 'rotate-180' : '']" />
        </button>

        <!-- Metric Field Picker -->
        <div 
          v-if="showMetricFieldPicker"
          class="absolute z-50 mt-2 w-full max-h-60 overflow-hidden bg-slate-800 border border-slate-700 rounded-xl shadow-xl"
          @click.stop
        >
          <div class="p-2 border-b border-slate-700">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                v-model="metricFieldSearch"
                type="text"
                placeholder="Search numeric fields..."
                class="w-full pl-9 pr-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-ocean-500"
              />
            </div>
          </div>
          <div class="max-h-48 overflow-y-auto p-2">
            <div v-if="metricFields.length === 0" class="p-4 text-center text-sm text-slate-500">
              No numeric fields found
            </div>
            <button
              v-for="field in metricFields"
              :key="field.name"
              @click="selectMetricField(field)"
              :class="[
                'w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors',
                selectedMetricField?.name === field.name
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'hover:bg-slate-700/50 text-slate-300'
              ]"
            >
              <Hash class="w-4 h-4 text-blue-400" />
              <div class="flex-1 min-w-0">
                <div class="text-sm truncate">{{ field.name }}</div>
                <div class="text-xs text-slate-500">{{ field.type }}</div>
              </div>
              <Check v-if="selectedMetricField?.name === field.name" class="w-4 h-4 text-blue-400" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary -->
    <div 
      v-if="configSummary"
      class="p-4 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-slate-700/50 rounded-xl"
    >
      <div class="flex items-center gap-3 text-sm">
        <span class="text-slate-400">Chart will show:</span>
        <span class="font-medium text-white">
          <span class="text-blue-300">{{ configSummary.y }}</span>
          <span class="text-slate-500 mx-2">by</span>
          <span class="text-emerald-300">{{ configSummary.x }}</span>
        </span>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-3">
      <button
        @click="executeAggregation"
        :disabled="!canRun || aggregationStore.loading"
        class="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 disabled:opacity-50"
      >
        <Play v-if="!aggregationStore.loading" class="w-4 h-4" />
        <div v-else class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        {{ aggregationStore.loading ? 'Running...' : 'Run Aggregation' }}
      </button>
      <button
        @click="showQueryPreview"
        :disabled="!canRun"
        class="btn-secondary px-4 py-2.5 disabled:opacity-50"
        title="Preview Elasticsearch Query"
      >
        <Eye class="w-4 h-4" />
      </button>
    </div>

    <!-- Error Display -->
    <div 
      v-if="aggError"
      class="p-4 bg-red-500/10 border border-red-500/30 rounded-xl"
    >
      <div class="flex items-start gap-3">
        <AlertTriangle class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div class="flex-1">
          <p class="text-sm font-medium text-red-400">Aggregation Failed</p>
          <p class="text-xs text-slate-400 mt-1">{{ aggError }}</p>
        </div>
        <button @click="aggError = null" class="text-slate-400 hover:text-white">
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Results Preview -->
    <div 
      v-if="aggregationStore.aggregatedData.length > 0"
      class="p-4 bg-slate-800/40 rounded-xl space-y-3"
    >
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-white">
          Results ({{ aggregationStore.aggregatedData.length }} rows)
        </span>
        <span class="text-xs text-slate-500">
          Fields: {{ Object.keys(aggregationStore.aggregatedData[0] || {}).join(', ') }}
        </span>
      </div>
      <div class="max-h-32 overflow-auto text-xs font-mono text-slate-300">
        <pre>{{ JSON.stringify(aggregationStore.aggregatedData.slice(0, 3), null, 2) }}</pre>
        <p v-if="aggregationStore.aggregatedData.length > 3" class="text-slate-500 mt-2">
          ... and {{ aggregationStore.aggregatedData.length - 3 }} more rows
        </p>
      </div>
    </div>

    <!-- Query Preview Modal -->
    <Teleport to="body">
      <div 
        v-if="showPreview"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="showPreview = false"
      >
        <div class="glass-card p-6 w-full max-w-2xl max-h-[80vh] overflow-auto m-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-white">Elasticsearch Query Preview</h3>
            <button @click="showPreview = false" class="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
          <pre class="text-sm font-mono text-slate-300 bg-slate-800/60 p-4 rounded-xl overflow-auto">{{ JSON.stringify(queryPreview, null, 2) }}</pre>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.field-picker-container,
.metric-field-picker-container {
  position: relative;
}
</style>
