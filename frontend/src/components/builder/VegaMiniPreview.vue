<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import embed from 'vega-embed'
import { BarChart3 } from 'lucide-vue-next'

const props = defineProps({
  chartType: {
    type: String,
    required: true
  },
  width: {
    type: Number,
    default: 140
  },
  height: {
    type: Number,
    default: 90
  },
  useLive: {
    type: Boolean,
    default: false
  },
  spec: {
    type: Object,
    default: null
  }
})

const containerRef = ref(null)
const imageLoaded = ref(false)
const imageError = ref(false)
let vegaView = null

// Thumbnail URL
const thumbnailUrl = computed(() => `/thumbnails/${props.chartType}.svg`)

// Handle image load error - fallback to icon
function handleImageError() {
  imageError.value = true
}

function handleImageLoad() {
  imageLoaded.value = true
}

// Render live Vega preview (used for hover popups with real spec)
async function renderLivePreview() {
  if (!containerRef.value || !props.useLive) return
  
  // Use provided spec or generate mini spec
  const spec = props.spec || getMiniSpec(props.chartType)
  if (!spec) return
  
  try {
    if (vegaView) {
      vegaView.finalize()
      vegaView = null
    }
    
    containerRef.value.innerHTML = ''
    
    const result = await embed(containerRef.value, spec, {
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
        view: { stroke: null }
      },
      renderer: 'svg',
      width: props.width,
      height: props.height
    })
    
    vegaView = result.view
  } catch (err) {
    console.error('Mini preview render error:', err)
    imageError.value = true
  }
}

// Mini specs for live rendering (simplified versions)
function getMiniSpec(chartType) {
  const miniSpecs = {
    bar: {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: props.width - 20,
      height: props.height - 20,
      padding: 10,
      background: 'transparent',
      data: {
        values: [
          { x: 'A', y: 28 }, { x: 'B', y: 55 }, { x: 'C', y: 43 },
          { x: 'D', y: 91 }, { x: 'E', y: 67 }
        ]
      },
      mark: { type: 'bar', cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3 },
      encoding: {
        x: { field: 'x', type: 'nominal', axis: null },
        y: { field: 'y', type: 'quantitative', axis: null },
        color: { value: '#0ea5e9' }
      },
      config: { view: { stroke: null } }
    },
    line: {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: props.width - 20,
      height: props.height - 20,
      padding: 10,
      background: 'transparent',
      data: {
        values: [
          { x: 0, y: 20 }, { x: 1, y: 35 }, { x: 2, y: 28 },
          { x: 3, y: 55 }, { x: 4, y: 43 }, { x: 5, y: 67 }
        ]
      },
      mark: { type: 'line', strokeWidth: 3, point: true },
      encoding: {
        x: { field: 'x', type: 'quantitative', axis: null },
        y: { field: 'y', type: 'quantitative', axis: null },
        color: { value: '#22c55e' }
      },
      config: { view: { stroke: null } }
    },
    pie: {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: props.height - 20,
      height: props.height - 20,
      padding: 10,
      background: 'transparent',
      data: {
        values: [
          { category: 'A', value: 35 },
          { category: 'B', value: 25 },
          { category: 'C', value: 20 },
          { category: 'D', value: 20 }
        ]
      },
      mark: { type: 'arc' },
      encoding: {
        theta: { field: 'value', type: 'quantitative' },
        color: { field: 'category', type: 'nominal', legend: null, scale: { scheme: 'tableau10' } }
      },
      config: { view: { stroke: null } }
    }
  }
  
  return miniSpecs[chartType] || null
}

onMounted(() => {
  if (props.useLive) {
    renderLivePreview()
  }
})

onUnmounted(() => {
  if (vegaView) {
    vegaView.finalize()
    vegaView = null
  }
})

watch(() => props.chartType, () => {
  imageLoaded.value = false
  imageError.value = false
  if (props.useLive) {
    renderLivePreview()
  }
})

watch(() => props.spec, () => {
  if (props.useLive && props.spec) {
    renderLivePreview()
  }
}, { deep: true })
</script>

<template>
  <div 
    class="mini-preview-container"
    :style="{ width: `${width}px`, height: `${height}px` }"
  >
    <!-- Static SVG thumbnail (default) -->
    <template v-if="!useLive">
      <img 
        v-if="!imageError"
        :src="thumbnailUrl"
        :alt="chartType"
        class="w-full h-full object-contain transition-opacity duration-200"
        :class="{ 'opacity-0': !imageLoaded, 'opacity-100': imageLoaded }"
        @load="handleImageLoad"
        @error="handleImageError"
      />
      
      <!-- Fallback icon -->
      <div 
        v-if="imageError || !imageLoaded"
        class="absolute inset-0 flex items-center justify-center bg-slate-800/30"
      >
        <BarChart3 class="w-8 h-8 text-slate-500" />
      </div>
    </template>
    
    <!-- Live Vega render (for hover previews) -->
    <div 
      v-else
      ref="containerRef"
      class="w-full h-full flex items-center justify-center"
    />
  </div>
</template>

<style scoped>
.mini-preview-container {
  @apply relative overflow-hidden;
}

.mini-preview-container img {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}
</style>

