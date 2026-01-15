<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useVegaStore } from '@/stores/vega'
import { useElasticStore } from '@/stores/elastic'
import { useAggregationStore } from '@/stores/aggregation'
import { Settings2, ChevronDown, Check, Info, Database, Palette, Sliders } from 'lucide-vue-next'
import UnifiedDataPanel from './UnifiedDataPanel.vue'
import ColorConfigPanel from './ColorConfigPanel.vue'

const emit = defineEmits(['data-updated', 'color-changed'])

const vegaStore = useVegaStore()
const elasticStore = useElasticStore()
const aggregationStore = useAggregationStore()

const activeTab = ref('data')
const expandedSections = ref(['style'])

// Initialize colorConfig from store or use defaults
const colorConfig = ref({
  scheme: 'category10',
  singleColor: '#0ea5e9',
  opacity: 1,
  strokeColor: '#ffffff',
  strokeWidth: 1,
  useGradient: false,
  gradientStart: '#0ea5e9',
  gradientEnd: '#f97316',
  customColors: null
})

// Initialize from store if available
onMounted(() => {
  if (vegaStore.config.colorConfig) {
    colorConfig.value = { ...colorConfig.value, ...vegaStore.config.colorConfig }
  } else {
    vegaStore.updateConfig('colorConfig', colorConfig.value)
  }
})

const tabs = [
  { id: 'data', name: 'Data', icon: Database },
  { id: 'style', name: 'Style', icon: Sliders },
  { id: 'colors', name: 'Colors', icon: Palette }
]

function toggleSection(section) {
  const idx = expandedSections.value.indexOf(section)
  if (idx === -1) {
    expandedSections.value.push(section)
  } else {
    expandedSections.value.splice(idx, 1)
  }
}

// Get style fields from schema (non-field selectors)
const styleFields = computed(() => {
  if (!vegaStore.configSchema) return []
  
  return vegaStore.configSchema.fields.filter(f => 
    ['select', 'boolean', 'number', 'text', 'thresholds'].includes(f.type) &&
    !['xField', 'yField', 'colorField', 'sizeField', 'categoryField', 'valueField'].includes(f.name)
  )
})

function updateField(fieldName, value) {
  vegaStore.updateConfig(fieldName, value)
}

function getFieldValue(fieldName) {
  return vegaStore.config[fieldName]
}

function handleAggregatedData(data) {
  emit('data-updated', data)
}

// Sync color config with vega store
watch(colorConfig, (newConfig) => {
  console.debug('[ConfigurationPanel] Color config updated:', newConfig)
  vegaStore.updateConfig('colorConfig', { ...newConfig })
}, { deep: true, immediate: false })
</script>

<template>
  <div class="glass-card p-5 space-y-4 min-h-[875px] flex flex-col">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
        <Settings2 class="w-4 h-4 text-emerald-400" />
      </div>
      <div>
        <h3 class="font-semibold text-white text-sm">Configure Chart</h3>
        <p class="text-xs text-slate-400">Set up your visualization</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 p-1 bg-slate-800/60 rounded-lg">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all duration-200"
        :class="[
          activeTab === tab.id 
            ? 'bg-ocean-500/20 text-ocean-300' 
            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        ]"
      >
        <component :is="tab.icon" class="w-3.5 h-3.5" />
        <span>{{ tab.name }}</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="vegaStore.loading.schema" class="py-8 flex justify-center">
      <div class="w-6 h-6 border-2 border-ocean-400 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <!-- Tab Content -->
    <div v-else class="flex-1 max-h-[750px] overflow-y-auto scrollbar-hide pr-1">
      <!-- Data Tab - Unified Panel -->
      <div v-show="activeTab === 'data'" class="space-y-3">
        <!-- Title Field -->
        <div>
          <label class="form-label text-xs mb-0.5">Chart Title</label>
          <input
            :value="vegaStore.config.title"
            @input="updateField('title', $event.target.value)"
            type="text"
            placeholder="Enter chart title..."
            class="form-input py-1.5 text-sm"
          />
        </div>

        <!-- Unified Data Configuration -->
        <UnifiedDataPanel @data-updated="handleAggregatedData" />
      </div>

      <!-- Style Tab -->
      <div v-show="activeTab === 'style'" class="space-y-3">
        <!-- Style Options from Schema -->
        <div 
          v-if="styleFields.length > 0"
          class="border border-slate-700/50 rounded-xl overflow-hidden"
        >
          <button
            @click="toggleSection('style')"
            class="w-full flex items-center justify-between p-3 hover:bg-slate-800/40 transition-colors"
          >
            <span class="text-sm font-medium text-white">Chart Options</span>
            <ChevronDown 
              class="w-4 h-4 text-slate-400 transition-transform duration-200"
              :class="{ 'rotate-180': expandedSections.includes('style') }"
            />
          </button>

          <div v-if="expandedSections.includes('style')" class="p-3 pt-0 space-y-2">
            <div v-for="field in styleFields" :key="field.name">
              <!-- Select -->
              <template v-if="field.type === 'select'">
                <label class="form-label text-xs mb-0.5">{{ field.label }}</label>
                <select
                  :value="getFieldValue(field.name) ?? field.default"
                  @change="updateField(field.name, $event.target.value)"
                  class="form-select py-1.5 text-sm"
                >
                  <option 
                    v-for="option in field.options" 
                    :key="option" 
                    :value="option"
                  >
                    {{ option }}
                  </option>
                </select>
              </template>

              <!-- Boolean (Toggle) -->
              <template v-else-if="field.type === 'boolean'">
                <label class="flex items-center justify-between cursor-pointer py-0.5">
                  <span class="text-xs text-slate-300">{{ field.label }}</span>
                  <button
                    @click="updateField(field.name, !getFieldValue(field.name))"
                    class="relative w-10 h-5 rounded-full transition-colors duration-200"
                    :class="getFieldValue(field.name) ? 'bg-ocean-500' : 'bg-slate-600'"
                  >
                    <span 
                      class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200"
                      :class="{ 'translate-x-5': getFieldValue(field.name) }"
                    ></span>
                  </button>
                </label>
              </template>

              <!-- Number -->
              <template v-else-if="field.type === 'number'">
                <label class="form-label text-xs mb-0.5">{{ field.label }}</label>
                <input
                  :value="getFieldValue(field.name) ?? field.default"
                  @input="updateField(field.name, parseFloat($event.target.value))"
                  type="number"
                  :min="field.min"
                  :max="field.max"
                  :step="field.step || 1"
                  class="form-input py-1.5 text-sm"
                />
              </template>

              <!-- Text -->
              <template v-else-if="field.type === 'text'">
                <label class="form-label text-xs mb-0.5">{{ field.label }}</label>
                <input
                  :value="getFieldValue(field.name) ?? field.default"
                  @input="updateField(field.name, $event.target.value)"
                  type="text"
                  class="form-input py-1.5 text-sm"
                />
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Colors Tab -->
      <div v-show="activeTab === 'colors'">
        <ColorConfigPanel v-model="colorConfig" @color-changed="emit('color-changed')" />
      </div>
    </div>

    <!-- Status Indicators -->
    <div class="space-y-2 mt-auto">
      <!-- Validation Status -->
      <div 
        v-if="vegaStore.configSchema"
        class="p-2.5 rounded-lg flex items-center gap-2"
        :class="vegaStore.isConfigComplete ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30'"
      >
        <Check 
          v-if="vegaStore.isConfigComplete" 
          class="w-4 h-4 text-emerald-400" 
        />
        <Info v-else class="w-4 h-4 text-amber-400" />
        <span 
          class="text-xs"
          :class="vegaStore.isConfigComplete ? 'text-emerald-400' : 'text-amber-400'"
        >
          {{ vegaStore.isConfigComplete ? 'Ready to render' : 'Configure data to generate chart' }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 500px;
}
</style>
