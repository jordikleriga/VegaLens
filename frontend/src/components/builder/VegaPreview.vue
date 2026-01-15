<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import embed from 'vega-embed'
import { BarChart3, AlertCircle, RefreshCw } from 'lucide-vue-next'

const props = defineProps({
  spec: {
    type: Object,
    default: null
  },
  height: {
    type: Number,
    default: 550
  }
})

const containerRef = ref(null)
const error = ref(null)
const loading = ref(false)
let vegaView = null

async function renderChart() {
  if (!containerRef.value || !props.spec) return
  
  // Skip if spec has error metadata from failed generation
  if (props.spec._error) {
    error.value = props.spec._error
    return
  }
  
  // Skip if spec is missing required data
  if (!props.spec.data && !props.spec.layer) {
    error.value = 'No data configured for visualization'
    return
  }

  loading.value = true
  error.value = null

  try {
    // Clean up previous view
    if (vegaView) {
      vegaView.finalize()
      vegaView = null
    }

    // Clear container
    containerRef.value.innerHTML = ''

    // Convert reactive proxy to plain object (required for vega-embed's structuredClone)
    const plainSpec = JSON.parse(JSON.stringify(props.spec))
    
    // Embed new chart
    const result = await embed(containerRef.value, plainSpec, {
      actions: false,
      theme: 'dark',
      config: {
        background: 'transparent',
        axis: {
          labelColor: '#94a3b8',
          titleColor: '#e2e8f0',
          gridColor: '#334155',
          domainColor: '#475569'
        },
        legend: {
          labelColor: '#94a3b8',
          titleColor: '#e2e8f0'
        },
        title: {
          color: '#f1f5f9'
        },
        mark: {
          color: '#0ea5e9'
        }
      },
      renderer: 'canvas'
    })

    vegaView = result.view
  } catch (err) {
    console.error('Vega render error:', err)
    
    // Parse common Vega errors into user-friendly messages
    let errorMessage = err.message
    
    // Invalid field reference
    if (errorMessage.includes('Invalid field reference') || errorMessage.includes('datum')) {
      const fieldMatch = errorMessage.match(/'([^']+)'/) || errorMessage.match(/\{([^}]+)\}/)
      const fieldName = fieldMatch ? fieldMatch[1] : 'unknown'
      errorMessage = `Field "${fieldName}" not found in data. Check that your X-Axis and Y-Axis fields are correctly mapped to fields in your data source.`
    }
    
    // Encoding errors
    if (errorMessage.includes('encoding')) {
      errorMessage = `Chart encoding error. Make sure you've selected valid fields for all required axes.`
    }
    
    // Data errors
    if (errorMessage.includes('data') && errorMessage.includes('undefined')) {
      errorMessage = `No data available. Run an aggregation first or ensure your data source has records.`
    }
    
    error.value = errorMessage
  } finally {
    loading.value = false
  }
}

watch(() => props.spec, async () => {
  await nextTick()
  renderChart()
}, { deep: true })

onMounted(() => {
  if (props.spec) {
    renderChart()
  }
})

onUnmounted(() => {
  if (vegaView) {
    vegaView.finalize()
  }
})
</script>

<template>
  <div class="relative" :style="{ minHeight: `${height}px` }">
    <!-- Loading State -->
    <div 
      v-if="loading" 
      class="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm rounded-xl z-10"
    >
      <RefreshCw class="w-8 h-8 text-ocean-400 animate-spin" />
    </div>

    <!-- Error State -->
    <div 
      v-if="error" 
      class="absolute inset-0 flex flex-col items-center justify-center bg-red-500/5 border border-red-500/30 rounded-xl p-6"
    >
      <AlertCircle class="w-12 h-12 text-red-400 mb-4" />
      <h4 class="text-lg font-semibold text-red-400 mb-2">Rendering Error</h4>
      <p class="text-sm text-slate-400 text-center max-w-md mb-4">{{ error }}</p>
      <div class="flex gap-2">
        <button 
          @click="error = null"
          class="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          Dismiss
        </button>
        <button 
          @click="renderChart"
          class="px-4 py-2 text-sm bg-ocean-600 hover:bg-ocean-500 text-white rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div 
      v-else-if="!spec" 
      class="flex flex-col items-center justify-center h-full py-16"
    >
      <div class="w-20 h-20 rounded-2xl bg-slate-800/60 flex items-center justify-center mb-6">
        <BarChart3 class="w-10 h-10 text-slate-500" />
      </div>
      <h4 class="text-lg font-semibold text-white mb-2">No Preview Available</h4>
      <p class="text-sm text-slate-400 text-center max-w-md">
        Complete the configuration to generate a visualization preview.
        Select an index, choose a chart type, and configure the required fields.
      </p>
    </div>

    <!-- Chart Container -->
    <div 
      ref="containerRef" 
      class="vega-container"
      :class="{ 'opacity-0': !spec || loading || error }"
    ></div>
  </div>
</template>

<style scoped>
.vega-container {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.vega-container :deep(.vega-embed) {
  width: 100%;
}

.vega-container :deep(.vega-embed .chart-wrapper) {
  width: 100%;
}

.vega-container :deep(canvas) {
  max-width: 100%;
  border-radius: 0.75rem;
}

/* Dark theme overrides for Vega actions */
.vega-container :deep(.vega-actions) {
  position: absolute;
  top: 8px;
  right: 8px;
}

.vega-container :deep(.vega-actions a) {
  background: rgba(15, 23, 42, 0.8);
  color: #94a3b8;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  text-decoration: none;
  margin-left: 4px;
  transition: all 0.2s;
}

.vega-container :deep(.vega-actions a:hover) {
  background: rgba(15, 23, 42, 0.95);
  color: #e2e8f0;
}
</style>

