<script setup>
import { ref, computed, watch } from 'vue'
import { useVegaStore } from '@/stores/vega'
import { useElasticStore } from '@/stores/elastic'
import { useAggregationStore } from '@/stores/aggregation'
import { Copy, Check, Download, Code, AlertCircle, Database, Layers, RefreshCw } from 'lucide-vue-next'

const props = defineProps({
  spec: {
    type: Object,
    default: null
  }
})

const vegaStore = useVegaStore()
const elasticStore = useElasticStore()
const aggregationStore = useAggregationStore()

const copied = ref(false)
const editedSpec = ref('')
const parseError = ref(null)
const specMode = ref('kibana') // 'preview' or 'kibana'
const kibanaSpec = ref(null)
const loadingKibana = ref(false)

/**
 * Format Kibana spec as HJSON with helpful comments
 * HJSON is JSON with comments, which Kibana's Vega editor supports
 */
function formatKibanaSpecWithComments(spec) {
  if (!spec) return ''

  // Convert to JSON string first
  let json = JSON.stringify(spec, null, 2)

  // Add comments for Kibana-specific fields
  // These comments help users understand the special Kibana placeholders
  json = json.replace(
    /("data"\s*:\s*\{[\s\S]*?"url"\s*:\s*\{[\s\S]*?)("%context%"\s*:\s*true)/,
    '$1// Apply dashboard context filters (time range, filters) to this visualization\n      $2'
  )

  json = json.replace(
    /("%timefield%"\s*:\s*"[^"]*")/,
    '// Filter using the time picker (upper right corner). Change this to match your timestamp field or comment out if no timefield needed.\n      $1'
  )

  return json
}

const formattedSpec = computed(() => {
  if (specMode.value === 'kibana' && kibanaSpec.value) {
    // Kibana spec formatted as HJSON with helpful comments
    return formatKibanaSpecWithComments(kibanaSpec.value)
  }
  if (!props.spec) return ''
  return JSON.stringify(props.spec, null, 2)
})

watch(formattedSpec, (newVal) => {
  editedSpec.value = newVal
  parseError.value = null
}, { immediate: true })

// Watch for spec mode changes to load Kibana spec (immediate: true to trigger on initial load)
watch(specMode, async (mode) => {
  if (mode === 'kibana' && !kibanaSpec.value) {
    await loadKibanaSpec()
  }
}, { immediate: true })

async function loadKibanaSpec() {
  if (!vegaStore.selectedType || !elasticStore.currentIndex) return

  loadingKibana.value = true
  try {
    kibanaSpec.value = await vegaStore.generateKibanaSpec({
      index: elasticStore.currentIndex,
      timeField: '@timestamp',
      aggregation: aggregationStore.hasAggregation ? aggregationStore.currentConfig : null
    })
  } catch (err) {
    console.error('Failed to load Kibana spec:', err)
  } finally {
    loadingKibana.value = false
  }
}

// Force refresh Kibana spec (clears cache and regenerates)
async function refreshKibanaSpec() {
  kibanaSpec.value = null
  await loadKibanaSpec()
}

// Refresh Kibana spec when aggregation changes
watch(() => aggregationStore.currentConfig, () => {
  if (specMode.value === 'kibana') {
    kibanaSpec.value = null
    loadKibanaSpec()
  }
}, { deep: true })

// Refresh Kibana spec when chart type changes
watch(() => vegaStore.selectedType, () => {
  if (specMode.value === 'kibana' && vegaStore.selectedType) {
    console.log('[SpecEditor] Chart type changed, regenerating Kibana spec')
    kibanaSpec.value = null
    loadKibanaSpec()
  }
})

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(editedSpec.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

function downloadSpec() {
  const blob = new Blob([editedSpec.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vega-spec-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function validateAndUpdate() {
  try {
    const parsed = JSON.parse(editedSpec.value)
    parseError.value = null
    // Update the store with edited spec
    vegaStore.generatedSpec = parsed
  } catch (err) {
    parseError.value = err.message
  }
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Mode Toggle -->
    <div class="flex items-center gap-2 mb-4 p-1 bg-slate-800/60 rounded-xl">
      <button
        @click="specMode = 'kibana'"
        class="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all"
        :class="specMode === 'kibana' 
          ? 'bg-purple-500/20 text-purple-300' 
          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'"
      >
        <Layers class="w-4 h-4" />
        Kibana Spec
        <span class="text-xs opacity-70">(with query)</span>
      </button>
      <button
        @click="specMode = 'preview'"
        class="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all"
        :class="specMode === 'preview' 
          ? 'bg-ocean-500/20 text-ocean-300' 
          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'"
      >
        <Database class="w-4 h-4" />
        Preview Spec
        <span class="text-xs opacity-70">(with data)</span>
      </button>
    </div>

    <!-- Toolbar -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <Code class="w-5 h-5" :class="specMode === 'kibana' ? 'text-purple-400' : 'text-ocean-400'" />
        <span class="font-medium text-white">
          {{ specMode === 'kibana' ? 'Kibana Vega Specification' : 'Vega Specification' }}
        </span>
        <span 
          v-if="specMode === 'kibana'" 
          class="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-300"
        >
          Uses ES Query
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="specMode === 'kibana'"
          @click="refreshKibanaSpec"
          :disabled="loadingKibana"
          class="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Regenerate Kibana spec"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loadingKibana }" />
          Refresh
        </button>
        <button
          @click="copyToClipboard"
          class="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors"
          :class="copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'"
        >
          <Check v-if="copied" class="w-4 h-4" />
          <Copy v-else class="w-4 h-4" />
          {{ copied ? 'Copied!' : 'Copy' }}
        </button>
        <button
          @click="downloadSpec"
          :disabled="!spec && specMode === 'preview'"
          class="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download class="w-4 h-4" />
          Download
        </button>
      </div>
    </div>

    <!-- Parse Error -->
    <div 
      v-if="parseError"
      class="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3"
    >
      <AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
      <div>
        <p class="text-sm font-medium text-red-400">Invalid JSON</p>
        <p class="text-xs text-slate-400 mt-1">{{ parseError }}</p>
      </div>
    </div>

    <!-- Empty State -->
    <div 
      v-if="!spec" 
      class="flex-1 flex flex-col items-center justify-center bg-slate-800/30 rounded-xl border border-slate-700/50"
    >
      <Code class="w-12 h-12 text-slate-500 mb-4" />
      <p class="text-slate-400">No specification generated yet</p>
      <p class="text-sm text-slate-500 mt-1">Complete the configuration to see the Vega spec</p>
    </div>

    <!-- Editor -->
    <div v-else class="flex-1 relative">
      <textarea
        v-model="editedSpec"
        @blur="validateAndUpdate"
        class="w-full h-full min-h-[400px] p-4 bg-slate-800/60 border border-slate-700/50 rounded-xl font-mono text-sm text-slate-300 resize-none focus:outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500/20"
        spellcheck="false"
      ></textarea>
      
      <!-- Line numbers overlay hint -->
      <div class="absolute bottom-4 right-4 text-xs text-slate-500">
        {{ specMode === 'kibana' ? 'HJSON' : 'JSON' }} · {{ editedSpec.split('\n').length }} lines
      </div>
    </div>

    <!-- Mode-specific Note -->
    <div 
      class="mt-4 p-4 rounded-xl"
      :class="specMode === 'kibana' 
        ? 'bg-purple-500/10 border border-purple-500/30' 
        : 'bg-ocean-500/10 border border-ocean-500/30'"
    >
      <div class="flex items-start gap-3">
        <div 
          class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          :class="specMode === 'kibana' ? 'bg-purple-500/20' : 'bg-ocean-500/20'"
        >
          <Layers v-if="specMode === 'kibana'" class="w-4 h-4 text-purple-400" />
          <Database v-else class="w-4 h-4 text-ocean-400" />
        </div>
        <div v-if="specMode === 'kibana'">
          <p class="text-sm font-medium text-purple-300">Kibana Vega Format</p>
          <p class="text-xs text-slate-400 mt-1">
            This spec queries Elasticsearch directly using <code class="text-purple-300">body.aggs</code>. 
            Copy and paste into Kibana's Vega visualization. 
            The <code class="text-purple-300">%context%</code> and <code class="text-purple-300">%timefield%</code> 
            variables will be replaced by Kibana at runtime.
          </p>
        </div>
        <div v-else>
          <p class="text-sm font-medium text-ocean-300">Preview Format</p>
          <p class="text-xs text-slate-400 mt-1">
            This spec has embedded data for local preview. 
            Switch to <strong>Kibana Spec</strong> to get a version with an Elasticsearch query 
            that you can use directly in Kibana.
          </p>
        </div>
      </div>
    </div>

    <!-- Loading Overlay for Kibana Spec -->
    <div 
      v-if="loadingKibana && specMode === 'kibana'"
      class="absolute inset-0 bg-slate-900/80 flex items-center justify-center rounded-xl"
    >
      <div class="flex flex-col items-center gap-3">
        <div class="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-sm text-purple-300">Generating Kibana spec...</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
textarea {
  tab-size: 2;
}

/* Custom scrollbar for textarea */
textarea::-webkit-scrollbar {
  width: 8px;
}

textarea::-webkit-scrollbar-track {
  background: transparent;
}

textarea::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 4px;
}

textarea::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>

