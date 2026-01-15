<script setup>
import { ref, computed, watch } from 'vue'
import { useAggregationStore } from '@/stores/aggregation'
import { useVegaStore } from '@/stores/vega'
import { Palette, ChevronDown, Check, Pipette, Sparkles } from 'lucide-vue-next'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:modelValue', 'color-changed'])

const aggregationStore = useAggregationStore()
const vegaStore = useVegaStore()

const expandedSection = ref('scheme')
const customColors = ref([])
const showColorPicker = ref(false)
const activeColorIndex = ref(-1)

const colorConfig = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// Current color scheme info
const currentScheme = computed(() => {
  const schemeId = colorConfig.value.scheme
  for (const category of Object.values(aggregationStore.colorSchemes)) {
    const found = category.find(s => s.id === schemeId)
    if (found) return found
  }
  return null
})

// Update color configuration and trigger chart regeneration
function updateConfig(key, value) {
  const newConfig = {
    ...props.modelValue,
    [key]: value
  }
  emit('update:modelValue', newConfig)
  // Also update vega store directly for immediate effect
  vegaStore.updateConfig('colorConfig', newConfig)
  // Signal that colors changed to trigger regeneration
  emit('color-changed')
}

function selectScheme(schemeId) {
  console.log('[ColorConfigPanel] Selecting scheme:', schemeId)
  // Update both properties in a single emit to avoid stale props issue
  const newConfig = {
    ...props.modelValue,
    scheme: schemeId,
    customColors: null
  }
  emit('update:modelValue', newConfig)
  // Update both colorConfig and colorScheme for backward compatibility
  vegaStore.updateConfig('colorConfig', newConfig)
  vegaStore.updateConfig('colorScheme', schemeId)
  // Signal that colors changed to trigger regeneration
  emit('color-changed')
}

function selectPresetColor(color) {
  if (activeColorIndex.value >= 0) {
    const newColors = [...customColors.value]
    newColors[activeColorIndex.value] = color
    customColors.value = newColors
    updateConfig('customColors', newColors)
  } else {
    updateConfig('singleColor', color)
  }
  showColorPicker.value = false
}

function addCustomColor() {
  customColors.value.push('#0ea5e9')
  updateConfig('customColors', customColors.value)
}

function removeCustomColor(index) {
  customColors.value.splice(index, 1)
  updateConfig('customColors', customColors.value)
}

function openColorPicker(index = -1) {
  activeColorIndex.value = index
  showColorPicker.value = true
}

// Initialize from modelValue
watch(() => props.modelValue.customColors, (val) => {
  if (val) customColors.value = [...val]
}, { immediate: true })
</script>

<template>
  <div class="space-y-6">
    <!-- Section: Color Scheme -->
    <div class="border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        @click="expandedSection = expandedSection === 'scheme' ? '' : 'scheme'"
        class="w-full flex items-center justify-between p-4 hover:bg-slate-800/40 transition-colors"
      >
        <div class="flex items-center gap-3">
          <Palette class="w-5 h-5 text-ocean-400" />
          <span class="font-medium text-white">Color Scheme</span>
        </div>
        <ChevronDown 
          class="w-5 h-5 text-slate-400 transition-transform duration-200"
          :class="{ 'rotate-180': expandedSection === 'scheme' }"
        />
      </button>

      <div v-if="expandedSection === 'scheme'" class="p-4 pt-0 space-y-4">
        <!-- Categorical Schemes -->
        <div>
          <label class="form-label text-xs text-slate-400">Categorical</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="scheme in aggregationStore.colorSchemes.categorical"
              :key="scheme.id"
              @click="selectScheme(scheme.id)"
              class="p-3 rounded-lg border transition-all duration-200"
              :class="[
                colorConfig.scheme === scheme.id 
                  ? 'border-ocean-400 bg-ocean-500/10' 
                  : 'border-slate-700/50 hover:border-slate-600'
              ]"
            >
              <div class="flex gap-0.5 mb-2">
                <div
                  v-for="(color, idx) in scheme.colors?.slice(0, 6)"
                  :key="idx"
                  class="w-4 h-4 rounded-sm first:rounded-l last:rounded-r"
                  :style="{ backgroundColor: color }"
                ></div>
              </div>
              <span class="text-xs text-slate-300">{{ scheme.name }}</span>
            </button>
          </div>
        </div>

        <!-- Sequential Schemes -->
        <div>
          <label class="form-label text-xs text-slate-400">Sequential</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="scheme in aggregationStore.colorSchemes.sequential"
              :key="scheme.id"
              @click="selectScheme(scheme.id)"
              class="p-2 rounded-lg border transition-all duration-200 text-center"
              :class="[
                colorConfig.scheme === scheme.id 
                  ? 'border-ocean-400 bg-ocean-500/10' 
                  : 'border-slate-700/50 hover:border-slate-600'
              ]"
            >
              <div 
                class="h-3 rounded mb-1"
                :class="`bg-gradient-to-r from-${scheme.id}-100 to-${scheme.id}-600`"
                :style="{ 
                  background: `linear-gradient(to right, 
                    var(--scheme-${scheme.id}-light, #e0f2fe), 
                    var(--scheme-${scheme.id}-dark, #0369a1))` 
                }"
              ></div>
              <span class="text-xs text-slate-300">{{ scheme.name }}</span>
            </button>
          </div>
        </div>

        <!-- Diverging Schemes -->
        <div>
          <label class="form-label text-xs text-slate-400">Diverging</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="scheme in aggregationStore.colorSchemes.diverging"
              :key="scheme.id"
              @click="selectScheme(scheme.id)"
              class="p-2 rounded-lg border transition-all duration-200 text-center"
              :class="[
                colorConfig.scheme === scheme.id 
                  ? 'border-ocean-400 bg-ocean-500/10' 
                  : 'border-slate-700/50 hover:border-slate-600'
              ]"
            >
              <span class="text-xs text-slate-300">{{ scheme.name }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Section: Single Color -->
    <div class="border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        @click="expandedSection = expandedSection === 'single' ? '' : 'single'"
        class="w-full flex items-center justify-between p-4 hover:bg-slate-800/40 transition-colors"
      >
        <div class="flex items-center gap-3">
          <div 
            class="w-5 h-5 rounded-full border-2 border-slate-600"
            :style="{ backgroundColor: colorConfig.singleColor || '#0ea5e9' }"
          ></div>
          <span class="font-medium text-white">Primary Color</span>
        </div>
        <ChevronDown 
          class="w-5 h-5 text-slate-400 transition-transform duration-200"
          :class="{ 'rotate-180': expandedSection === 'single' }"
        />
      </button>

      <div v-if="expandedSection === 'single'" class="p-4 pt-0">
        <label class="form-label text-xs text-slate-400">Quick Select</label>
        <div class="grid grid-cols-6 gap-2 mb-4">
          <button
            v-for="color in aggregationStore.presetColors"
            :key="color"
            @click="updateConfig('singleColor', color)"
            class="w-8 h-8 rounded-lg border-2 transition-all duration-200 hover:scale-110"
            :class="colorConfig.singleColor === color ? 'border-white' : 'border-transparent'"
            :style="{ backgroundColor: color }"
          ></button>
        </div>

        <div class="flex gap-2">
          <input
            :value="colorConfig.singleColor || '#0ea5e9'"
            @input="updateConfig('singleColor', $event.target.value)"
            type="color"
            class="w-12 h-10 rounded-lg cursor-pointer"
          />
          <input
            :value="colorConfig.singleColor || '#0ea5e9'"
            @input="updateConfig('singleColor', $event.target.value)"
            type="text"
            class="form-input flex-1 py-2 text-sm font-mono"
            placeholder="#0ea5e9"
          />
        </div>
      </div>
    </div>

    <!-- Section: Custom Palette -->
    <div class="border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        @click="expandedSection = expandedSection === 'custom' ? '' : 'custom'"
        class="w-full flex items-center justify-between p-4 hover:bg-slate-800/40 transition-colors"
      >
        <div class="flex items-center gap-3">
          <Sparkles class="w-5 h-5 text-coral-400" />
          <span class="font-medium text-white">Custom Palette</span>
        </div>
        <ChevronDown 
          class="w-5 h-5 text-slate-400 transition-transform duration-200"
          :class="{ 'rotate-180': expandedSection === 'custom' }"
        />
      </button>

      <div v-if="expandedSection === 'custom'" class="p-4 pt-0 space-y-4">
        <p class="text-xs text-slate-400">
          Create a custom color palette for your visualization.
        </p>

        <div class="flex flex-wrap gap-2">
          <div
            v-for="(color, index) in customColors"
            :key="index"
            class="relative group"
          >
            <button
              @click="openColorPicker(index)"
              class="w-10 h-10 rounded-lg border-2 border-slate-600 hover:border-ocean-400 transition-colors"
              :style="{ backgroundColor: color }"
            ></button>
            <button
              @click="removeCustomColor(index)"
              class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ×
            </button>
          </div>

          <button
            @click="addCustomColor"
            class="w-10 h-10 rounded-lg border-2 border-dashed border-slate-600 hover:border-ocean-400 flex items-center justify-center text-slate-400 hover:text-ocean-400 transition-colors"
          >
            +
          </button>
        </div>

        <button
          v-if="customColors.length > 0"
          @click="updateConfig('customColors', customColors); updateConfig('scheme', null)"
          class="btn-secondary w-full py-2 text-sm"
        >
          Apply Custom Palette
        </button>
      </div>
    </div>

    <!-- Section: Color Options -->
    <div class="border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        @click="expandedSection = expandedSection === 'options' ? '' : 'options'"
        class="w-full flex items-center justify-between p-4 hover:bg-slate-800/40 transition-colors"
      >
        <div class="flex items-center gap-3">
          <Pipette class="w-5 h-5 text-purple-400" />
          <span class="font-medium text-white">Color Options</span>
        </div>
        <ChevronDown 
          class="w-5 h-5 text-slate-400 transition-transform duration-200"
          :class="{ 'rotate-180': expandedSection === 'options' }"
        />
      </button>

      <div v-if="expandedSection === 'options'" class="p-4 pt-0 space-y-4">
        <!-- Opacity -->
        <div>
          <label class="form-label text-xs flex justify-between">
            <span>Opacity</span>
            <span class="text-slate-400">{{ Math.round((colorConfig.opacity || 1) * 100) }}%</span>
          </label>
          <input
            type="range"
            :value="colorConfig.opacity || 1"
            @input="updateConfig('opacity', parseFloat($event.target.value))"
            min="0.1"
            max="1"
            step="0.05"
            class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <!-- Stroke Color -->
        <div>
          <label class="form-label text-xs">Stroke / Border Color</label>
          <div class="flex gap-2">
            <input
              :value="colorConfig.strokeColor || '#ffffff'"
              @input="updateConfig('strokeColor', $event.target.value)"
              type="color"
              class="w-12 h-10 rounded-lg cursor-pointer"
            />
            <input
              :value="colorConfig.strokeColor || '#ffffff'"
              @input="updateConfig('strokeColor', $event.target.value)"
              type="text"
              class="form-input flex-1 py-2 text-sm font-mono"
            />
          </div>
        </div>

        <!-- Stroke Width -->
        <div>
          <label class="form-label text-xs flex justify-between">
            <span>Stroke Width</span>
            <span class="text-slate-400">{{ colorConfig.strokeWidth || 1 }}px</span>
          </label>
          <input
            type="range"
            :value="colorConfig.strokeWidth || 1"
            @input="updateConfig('strokeWidth', parseInt($event.target.value))"
            min="0"
            max="5"
            step="1"
            class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <!-- Gradient Toggle -->
        <label class="flex items-center justify-between cursor-pointer">
          <span class="text-sm text-slate-300">Use Gradient Fill</span>
          <button
            @click="updateConfig('useGradient', !colorConfig.useGradient)"
            class="relative w-11 h-6 rounded-full transition-colors duration-200"
            :class="colorConfig.useGradient ? 'bg-ocean-500' : 'bg-slate-600'"
          >
            <span 
              class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200"
              :class="{ 'translate-x-5': colorConfig.useGradient }"
            ></span>
          </button>
        </label>

        <!-- Gradient Colors (if enabled) -->
        <div v-if="colorConfig.useGradient" class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label text-xs">Gradient Start</label>
            <input
              :value="colorConfig.gradientStart || '#0ea5e9'"
              @input="updateConfig('gradientStart', $event.target.value)"
              type="color"
              class="w-full h-10 rounded-lg cursor-pointer"
            />
          </div>
          <div>
            <label class="form-label text-xs">Gradient End</label>
            <input
              :value="colorConfig.gradientEnd || '#f97316'"
              @input="updateConfig('gradientEnd', $event.target.value)"
              type="color"
              class="w-full h-10 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Color Picker Modal -->
    <Teleport to="body">
      <div 
        v-if="showColorPicker"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="showColorPicker = false"
      >
        <div class="glass-card p-6 w-80">
          <h3 class="font-semibold text-white mb-4">Select Color</h3>
          <div class="grid grid-cols-6 gap-2 mb-4">
            <button
              v-for="color in aggregationStore.presetColors"
              :key="color"
              @click="selectPresetColor(color)"
              class="w-8 h-8 rounded-lg hover:scale-110 transition-transform"
              :style="{ backgroundColor: color }"
            ></button>
          </div>
          <input
            type="color"
            @change="selectPresetColor($event.target.value)"
            class="w-full h-12 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #0ea5e9;
  cursor: pointer;
}

input[type="range"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #0ea5e9;
  cursor: pointer;
  border: none;
}
</style>

